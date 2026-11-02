-- ABOUTME: #159 catalog fingerprint, read-only. Output lines (fixed grammar):
--   POLICYSET <table|cmd|roles|permissive|name;...>   the policies on the three tables (names and shape, sorted)
--   POLICYBODIES <md5>   the three tables' policy bodies (qual / with check), so rollback can be compared exactly
--   OTHERPOLICIES <n> <md5>   every policy on every OTHER table, bodies included
--   GRANTS <md5>   table privileges on the three tables
--   COLUMNS <md5>  columns of the three tables
--   TRIGGERS <md5> triggers on the three tables
\set ON_ERROR_STOP on
select 'POLICYSET ' || string_agg(format('%s|%s|%s|%s|%s', tablename, cmd, array_to_string(roles, ','), permissive, policyname), ';' order by tablename, cmd, policyname) as line
  from pg_policies where schemaname = 'public' and tablename in ('career_quiz_attempts', 'user_feedback', 'blog_settings')
union all
select 'POLICYBODIES ' || md5(string_agg(format('%s|%s|%s|%s', tablename, policyname, coalesce(qual, '-'), coalesce(with_check, '-')), ';' order by tablename, policyname))
  from pg_policies where schemaname = 'public' and tablename in ('career_quiz_attempts', 'user_feedback', 'blog_settings')
union all
select 'OTHERPOLICIES ' || count(*) || ' ' || md5(string_agg(format('%s|%s|%s|%s|%s|%s|%s|%s', schemaname, tablename, policyname, permissive, array_to_string(roles, ','), cmd, coalesce(qual, '-'), coalesce(with_check, '-')), ';' order by schemaname, tablename, policyname))
  from pg_policies where not (schemaname = 'public' and tablename in ('career_quiz_attempts', 'user_feedback', 'blog_settings'))
union all
select 'GRANTS ' || md5(string_agg(format('%s|%s|%s', table_name, grantee, privilege_type), ';' order by table_name, grantee, privilege_type))
  from information_schema.role_table_grants where table_schema = 'public' and table_name in ('career_quiz_attempts', 'user_feedback', 'blog_settings')
union all
select 'COLUMNS ' || md5(string_agg(format('%s|%s|%s|%s|%s', table_name, column_name, data_type, is_nullable, coalesce(column_default, '-')), ';' order by table_name, ordinal_position))
  from information_schema.columns where table_schema = 'public' and table_name in ('career_quiz_attempts', 'user_feedback', 'blog_settings')
union all
select 'TRIGGERS ' || md5(coalesce(string_agg(format('%s|%s', tgrelid::regclass, pg_get_triggerdef(oid)), ';' order by tgrelid::regclass::text, tgname), ''))
  from pg_trigger where not tgisinternal and tgrelid in ('public.career_quiz_attempts'::regclass, 'public.user_feedback'::regclass, 'public.blog_settings'::regclass);
