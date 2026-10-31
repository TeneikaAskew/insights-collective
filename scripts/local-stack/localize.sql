-- ABOUTME: Localizes external integrations on an AUTHENTIC local stack after the schema is applied:
-- ABOUTME: unschedules every cron job and points the vault secrets the functions read at loopback
-- ABOUTME: placeholders, so nothing in the local stack can reach a real destination. Idempotent.
-- Runs only through scripts/local-stack/bootstrap.sh, which has already verified the target is
-- loopback with managed roles present (never the live project).
do $$ begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job;
  end if;
end $$;
do $$
declare f record; m text[]; placed int := 0;
begin
  -- Every secret name the schema reads from vault.decrypted_secrets gets a loopback placeholder.
  for f in select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind in ('f','p') and pg_get_functiondef(p.oid) like '%decrypted_secrets%'
  loop
    for m in select regexp_matches(f.def, $re$name\s*=\s*'([^']+)'$re$, 'g') loop
      perform vault.create_secret('http://127.0.0.1:1/local-placeholder', m[1], 'local-stack placeholder (never a real destination)');
      placed := placed + 1;
    end loop;
  end loop;
  raise notice 'local-stack: % vault placeholder(s) set', placed;
end $$;
-- Storage buckets the application expects (names only; empty).
insert into storage.buckets (id, name, public)
values ('course-documents','course-documents', false), ('course-images','course-images', true), ('course-videos','course-videos', false)
on conflict (id) do nothing;
