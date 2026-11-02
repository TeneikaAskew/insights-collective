-- ABOUTME: #159 committed synthetic BASELINE for the preservation row hash, on the disposable loopback stack only.
-- Fixture model: these b159... rows are COMMITTED (one transaction) before the OLD matrix, so the content hash taken before
-- the migration can be compared after apply, after rollback and after re-apply. They are never read by the matrix
-- (matrix.sql counts only its own c159... ids). The stack is destroyed by the job's always-cleanup.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values
  ('b1590000-0000-4000-8000-00000000000a', 'nr-base-a@local.test'),
  ('b1590000-0000-4000-8000-00000000000b', 'nr-base-b@local.test');
insert into public.profiles (id) values ('b1590000-0000-4000-8000-00000000000a'), ('b1590000-0000-4000-8000-00000000000b') on conflict (id) do nothing;
insert into public.career_quiz_attempts (id, user_id, session_id, created_at, top_recommended_path) values
  ('b1590000-0000-4000-8000-0000000000a1', 'b1590000-0000-4000-8000-00000000000a', 'nr-base-sess-a', '2026-01-01T00:00:00Z', 'analytics'),
  ('b1590000-0000-4000-8000-0000000000f1', null, 'nr-base-sess-x', '2026-01-01T00:00:00Z', 'ai_ml');
insert into public.user_feedback (id, page_path, is_useful, feedback_text, user_id, created_at) values
  ('b1590000-0000-4000-8000-0000000000a2', '/nr-base', true, 'kept', 'b1590000-0000-4000-8000-00000000000a', '2026-01-01T00:00:00Z'),
  ('b1590000-0000-4000-8000-0000000000f2', '/nr-base', false, null, null, '2026-01-01T00:00:00Z');
insert into public.blog_settings (id, notification_email) values ('b1590000-0000-4000-8000-0000000000e3', 'nr-base-notify@local.test');
commit;
select 'BASELINE ' || (select count(*) from public.career_quiz_attempts where id::text like 'b1590000-%')
  || ' ' || (select count(*) from public.user_feedback where id::text like 'b1590000-%')
  || ' ' || (select count(*) from public.blog_settings where id::text like 'b1590000-%') as line;
