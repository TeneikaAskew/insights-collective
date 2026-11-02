-- ABOUTME: #159 preservation: one content hash per table over EVERY row (baseline and anything else), read as postgres.
-- Read-only. Output: "ROWHASH <table> <rows> <md5>" for the three tables the migration touches.
\set ON_ERROR_STOP on
select 'ROWHASH career_quiz_attempts ' || count(*) || ' ' || md5(coalesce(string_agg(t::text, '|' order by t.id), '')) as line from public.career_quiz_attempts t
union all
select 'ROWHASH user_feedback ' || count(*) || ' ' || md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.user_feedback t
union all
select 'ROWHASH blog_settings ' || count(*) || ' ' || md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.blog_settings t;
