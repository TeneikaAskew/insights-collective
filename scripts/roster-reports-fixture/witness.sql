-- ABOUTME: Read-only witness of every fixture row (MANIFEST.tsv ids) plus fixture-scoped side tables. The acceptance run is
-- ABOUTME: read-only, so the pre and post witness must be byte-identical. One sorted line per row; no secrets.
select 'course ' || id || ' ' || md5(row(title, description, published, instructor_id, updated_at)::text) from public.courses where id::text like '7150a000-%'
union all select 'module ' || id || ' ' || md5(row(course_id, title, position, published, updated_at)::text) from public.modules where id::text like '7150a000-%'
union all select 'item ' || id || ' ' || md5(row(course_id, module_id, type, title, position, published, updated_at)::text) from public.content_items where id::text like '7150a000-%'
union all select 'enrollment ' || id || ' ' || md5(row(user_id, course_id, enrolled_at, completion_status)::text) from public.enrollments where course_id::text like '7150a000-%'
union all select 'progression ' || id || ' ' || md5(row(user_id, content_item_id, workflow_state, updated_at)::text) from public.content_item_progressions where content_item_id::text like '7150a000-%'
union all select 'profile ' || id || ' ' || md5(row(first_name, last_name)::text) from public.profiles where id::text like '7150a000-%'
union all select 'certificates ' || count(*) from public.certificates where course_id::text like '7150a000-%'
union all select 'notifications-fixture-users ' || count(*) from public.notifications where user_id::text like '7150a000-%'
order by 1;
