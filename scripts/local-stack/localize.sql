-- ABOUTME: Localizes external integrations on an AUTHENTIC local stack after the schema is applied:
-- ABOUTME: unschedules every cron job, points every vault secret the functions read at a loopback
-- ABOUTME: placeholder (create once, update on repeat: Vault names are unique), creates empty buckets.
-- Runs only through scripts/local-stack/bootstrap.sh. Idempotent: a second run changes nothing.
do $$ begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job;
  end if;
end $$;
do $$
declare f record; m text[]; nm text; names text[] := '{}'; existing uuid; created int := 0; updated int := 0;
begin
  -- Collect DISTINCT secret names referenced by public functions (aggregates excluded).
  for f in select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind in ('f','p') and pg_get_functiondef(p.oid) like '%decrypted_secrets%'
  loop
    for m in select regexp_matches(f.def, $re$name\s*=\s*'([^']+)'$re$, 'g') loop
      if not (m[1] = any(names)) then names := names || m[1]; end if;
    end loop;
  end loop;
  foreach nm in array names loop
    select id into existing from vault.secrets where name = nm;
    if existing is null then
      perform vault.create_secret('http://127.0.0.1:1/local-placeholder', nm, 'local-stack placeholder (never a real destination)');
      created := created + 1;
    else
      perform vault.update_secret(existing, 'http://127.0.0.1:1/local-placeholder', nm, 'local-stack placeholder (never a real destination)');
      updated := updated + 1;
    end if;
  end loop;
  raise notice 'local-stack: % distinct vault name(s): % created, % updated', coalesce(array_length(names, 1), 0), created, updated;
end $$;
insert into storage.buckets (id, name, public)
values ('course-documents','course-documents', false), ('course-images','course-images', true), ('course-videos','course-videos', false)
on conflict (id) do nothing;
