-- ABOUTME: Read-only capture of the journey stack's Storage catalog in the storage-core pins grammar (STOCK at S1, then
-- ABOUTME: re-read at S3 and after each S4 probe). Catalog and config only: no object rows, no user data, no writes.
-- Free text is base64 of UTF-8 with the encoder's line breaks removed. Runs under psql -At (one record per row).
begin transaction read only;
select line from (
  select 0 as o, E'#storage-pins\tv1\tSTOCK' as line
  union all
  select 1, format(E'POLICY\t%s.%s\t%s\t%s\t%s\t%s\t%s\t%s', p.schemaname, p.tablename,
    translate(encode(convert_to(p.policyname, 'UTF8'), 'base64'), E'\n', ''), p.cmd, p.permissive,
    array_to_string(array(select r from unnest(p.roles) r order by r), ','),
    coalesce(translate(encode(convert_to(p.qual, 'UTF8'), 'base64'), E'\n', ''), '-'),
    coalesce(translate(encode(convert_to(p.with_check, 'UTF8'), 'base64'), E'\n', ''), '-'))
  from pg_policies p where p.schemaname = 'storage' and p.tablename in ('objects', 'buckets')
  union all
  select 2, format(E'RLS\tstorage.%s\t%s\t%s', c.relname, case when c.relrowsecurity then 't' else 'f' end,
    case when c.relforcerowsecurity then 't' else 'f' end)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'storage' and c.relname in ('objects', 'buckets')
  union all
  select 3, format(E'BUCKET\t%s\t%s\t%s\t%s', b.id, case when b.public then 't' else 'f' end, coalesce(b.file_size_limit::text, 'NULL'),
    coalesce(translate(encode(convert_to(array_to_string(b.allowed_mime_types, ','), 'UTF8'), 'base64'), E'\n', ''), 'NULL'))
  from storage.buckets b where b.id in ('course-documents', 'course-images', 'course-videos')
  union all
  select 4, format(E'GRANT\t%s.%s\t%s\t%s', g.table_schema, g.table_name, g.grantee, g.privilege_type)
  from information_schema.role_table_grants g where g.table_schema = 'storage' and g.table_name in ('objects', 'buckets')
  union all
  select 5, format(E'FUNC\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s', n.nspname, f.proname,
    coalesce(nullif(translate(encode(convert_to(pg_get_function_identity_arguments(f.oid), 'UTF8'), 'base64'), E'\n', ''), ''), '-'),
    md5(pg_get_functiondef(f.oid)), pg_get_userbyid(f.proowner), case when f.prosecdef then 't' else 'f' end, md5(coalesce(f.proacl::text, '')),
    case when has_function_privilege('authenticated', f.oid, 'EXECUTE') then 't' else 'f' end)
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
  where f.prokind = 'f' and (n.nspname = 'storage' or (n.nspname = 'public' and f.proname in
    ('can_access_course_materials', 'can_manage_course_materials', 'has_role', 'has_admin_access', 'get_user_roles')))
  union all
  select 6, format(E'MIGRATIONS\t%s\t%s', count(*), coalesce(max(id), 0)) from storage.migrations
) x order by o, line;
commit;
