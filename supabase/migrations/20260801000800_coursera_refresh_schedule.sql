-- ABOUTME: Schedules the monthly Coursera catalog refresh. A discovery pass on the
-- ABOUTME: 1st enqueues the whole on-topic catalog, then a drain job works the queue
-- ABOUTME: down in Edge-Function-sized batches until it is empty.
--
-- Why two jobs instead of one
-- --------------------------
-- Edge Functions are wall-clock limited (150s). A full crawl is ~8,400 pages at a
-- deliberately gentle request rate, which is hours of work. So the schedule
-- separates "decide what to fetch" (once a month, cheap) from "fetch some of it"
-- (often, bounded). At 40 pages a tick every 5 minutes the queue drains in roughly
-- 18 hours, comfortably inside the month.
--
-- The drain job is a no-op when the queue is empty: coursera_kick_refresh checks for
-- pending work in SQL first and returns without making an HTTP call. That is what
-- makes a 5-minute schedule reasonable rather than 288 pointless invocations a day.
--
-- Configuration (required — the jobs no-op safely until this is done)
-- ------------------------------------------------------------------
--   select vault.create_secret(
--     'https://<project-ref>.supabase.co/functions/v1/coursera-refresh',
--     'coursera_refresh_url');
--   select vault.create_secret('<same value as COURSERA_REFRESH_SECRET>',
--     'coursera_refresh_secret');
--
-- And on the function side:
--   supabase secrets set COURSERA_REFRESH_SECRET=<value>
--   supabase functions deploy coursera-refresh

-- ── Callers ─────────────────────────────────────────────────────────────────

-- SECURITY DEFINER because cron runs as postgres but the vault read and the queue
-- count should not depend on the caller's rights. Takes no arguments and returns
-- nothing, so it cannot be repurposed into an arbitrary HTTP client.
create or replace function public.coursera_call_refresh(p_action text, p_batch integer default 40)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  -- 'status' is included so an operator can smoke-test the whole path — pg_net to
  -- function to Vault-backed auth — without triggering a crawl.
  if p_action not in ('process', 'enqueue-discover', 'enqueue-refresh', 'status') then
    raise exception 'unsupported action: %', p_action;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'coursera_refresh_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'coursera_refresh_secret';

  -- Missing configuration is a notice, not an error. A cron job that raises every
  -- five minutes fills the logs and tells you nothing you cannot see here.
  if v_url is null or v_secret is null then
    raise notice 'coursera refresh not configured (vault secrets coursera_refresh_url / coursera_refresh_secret); skipping';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-refresh-secret', v_secret
    ),
    body := jsonb_build_object('action', p_action, 'batch', p_batch),
    timeout_milliseconds := 150000
  ) into v_request_id;

  return v_request_id;
end;
$$;

comment on function public.coursera_call_refresh(text, integer) is
  'Invokes the coursera-refresh Edge Function via pg_net using credentials from Vault. Returns the pg_net request id, or null when unconfigured.';

-- Only drains when there is something to drain, so the 5-minute schedule costs
-- nothing while the queue is empty.
create or replace function public.coursera_kick_refresh()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending integer;
begin
  select count(*) into v_pending
    from public.coursera_crawl_queue
    where state = 'pending' and attempts < 3;

  if v_pending = 0 then
    return null;
  end if;

  return public.coursera_call_refresh('process', 40);
end;
$$;

comment on function public.coursera_kick_refresh() is
  'Drain one batch of the Coursera crawl queue, or do nothing if the queue is empty.';

-- These run as the cron superuser only. Revoke the default EXECUTE-to-public so an
-- authenticated browser session cannot trigger outbound crawls or read Vault
-- indirectly.
revoke all on function public.coursera_call_refresh(text, integer) from public, anon, authenticated;
revoke all on function public.coursera_kick_refresh() from public, anon, authenticated;

-- ── Schedule ────────────────────────────────────────────────────────────────

-- Unschedule first so re-running this migration does not stack duplicate jobs.
select cron.unschedule('coursera-discover-monthly')
  where exists (select 1 from cron.job where jobname = 'coursera-discover-monthly');
select cron.unschedule('coursera-drain-queue')
  where exists (select 1 from cron.job where jobname = 'coursera-drain-queue');

-- 1st of the month, 03:00 UTC. Enqueues every on-topic sitemap candidate.
select cron.schedule(
  'coursera-discover-monthly',
  '0 3 1 * *',
  $$select public.coursera_call_refresh('enqueue-discover')$$
);

-- Works the queue down. No-op while empty.
select cron.schedule(
  'coursera-drain-queue',
  '*/5 * * * *',
  $$select public.coursera_kick_refresh()$$
);

-- ── Operator view ───────────────────────────────────────────────────────────
--
-- Crawl progress without granting access to the queue table itself. Admin-only:
-- security_invoker means the underlying RLS still applies, and the queue has no
-- policy, so this returns nothing for non-service roles — it exists for operators
-- querying with elevated rights, and for a future admin RPC.
create or replace view public.coursera_crawl_progress
with (security_invoker = true) as
select
  state,
  source,
  count(*) as urls,
  min(enqueued_at) as oldest_enqueued_at,
  max(processed_at) as newest_processed_at
from public.coursera_crawl_queue
group by state, source;

comment on view public.coursera_crawl_progress is
  'Coursera crawl queue counts by state and source. Empty for browser roles by design — the queue table has no RLS policy.';
