-- ABOUTME: Read-only witness. SEED: exact deterministic projections of every MANIFEST.tsv row (compared line for line with
-- ABOUTME: expected-seed.txt and pre->post). CERT: fixture-course certificate rows. TELEMETRY: security_events per actor.
-- Claims are scoped to these rows: nothing here is a whole-database or whole-history claim.
select line from (
  select 'SEED course ' || id || ' ' || title || ' ' || (case when description ~ '^rr-association:[0-9a-f]{32}$' then 'ASSOC' else description end)
         || ' published=' || published || ' instructor=' || instructor_id as line from public.courses where id::text like '7150a000-%'
  union all select 'SEED module ' || id || ' course=' || course_id || ' ' || title || ' position=' || position || ' published=' || published from public.modules where id::text like '7150a000-%'
  union all select 'SEED item ' || id || ' course=' || course_id || ' module=' || module_id || ' ' || type || ' ' || title || ' position=' || position || ' published=' || published from public.content_items where id::text like '7150a000-%'
  union all select 'SEED user ' || id || ' ' || email || ' password=' || (encrypted_password is not null) from auth.users where id::text like '7150a000-%'
  union all select 'SEED profile ' || id || ' ' || coalesce(first_name, '-') || ' ' || coalesce(last_name, '-') from public.profiles where id::text like '7150a000-%'
  union all select 'SEED enrollment ' || id || ' user=' || user_id || ' course=' || course_id || ' age_days=' || floor(extract(epoch from (now() - enrolled_at)) / 86400)::int || ' completion_status=' || coalesce(completion_status::text, 'null') from public.enrollments where id::text like '7150a000-%' or course_id::text like '7150a000-%'
  union all select 'SEED progression ' || id || ' user=' || user_id || ' item=' || content_item_id || ' ' || coalesce(workflow_state, 'null') from public.content_item_progressions where id::text like '7150a000-%' or content_item_id::text like '7150a000-%'
  union all select 'CERT ' || id || ' user=' || user_id || ' course=' || course_id from public.certificates where course_id::text like '7150a000-%'
  union all select 'TELEMETRY actor=' || a.actor || ' security_events=' || (select count(*) from public.security_events s where s.user_id = a.id)
  from (values ('e2e00000-0000-4000-8000-000000000001'::uuid, 'admin'), ('e2e00000-0000-4000-8000-000000000002'::uuid, 'instructor'), ('e2e00000-0000-4000-8000-000000000003'::uuid, 'member')) as a(id, actor)
) w order by line collate "C";
