-- ABOUTME: Gives public.coursera_crawl_queue an explicit admin read policy. The table
-- ABOUTME: was created with RLS enabled and no policies at all, which denies every
-- ABOUTME: row to every browser role — correct in effect, but indistinguishable from a
-- ABOUTME: forgotten policy, and the schema gate rightly refuses to pass a live table
-- ABOUTME: in that state.
--
-- What was wrong with "no policies"
-- --------------------------------
-- The intent was service-role-only: the Edge Function bypasses RLS, and crawl state is
-- not something a browser should touch. RLS-on-with-no-policies does enforce that, but
-- it encodes the intent in an absence. Nothing distinguishes "deliberately closed" from
-- "someone enabled RLS and never came back", so an automated check cannot pass it, and
-- a future reader cannot tell either.
--
-- An explicit admin-only SELECT policy states the intent instead of implying it, and it
-- makes public.coursera_crawl_progress — which is security_invoker, and therefore
-- returned nothing to anyone — actually usable by the operators it was built for.
--
-- Writes stay closed. There are still no INSERT, UPDATE or DELETE policies, so every
-- role except the service role is denied. Do not add an anon policy here.

drop policy if exists "coursera_crawl_queue_admin_read" on public.coursera_crawl_queue;
create policy "coursera_crawl_queue_admin_read"
  on public.coursera_crawl_queue for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

comment on table public.coursera_crawl_queue is
  'Work list for the coursera-refresh Edge Function. Exists because Edge Functions are wall-clock limited and a full crawl is not: progress has to survive across invocations. Admin-readable for observability; writes are service-role only.';
