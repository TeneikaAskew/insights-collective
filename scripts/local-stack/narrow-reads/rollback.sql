-- ABOUTME: #159 ROLLBACK for the disposable loopback stack ONLY (not a migration, never under supabase/migrations/).
-- Drops the four policies 20261102000000 creates and recreates the four snapshot policies with their exact snapshot
-- names, commands, roles and bodies (scripts/local-stack/schema/04_rls_policies.sql). It restores the wide exposure:
-- a recovery path for the test, not a fix. Plain DROP: a name mismatch fails instead of leaving an OR peer.
DROP POLICY "Users can view their own quiz attempts" ON public.career_quiz_attempts;
DROP POLICY "Users can insert their own quiz attempts" ON public.career_quiz_attempts;
DROP POLICY "Users can view feedback" ON public.user_feedback;
DROP POLICY "Blog authors can view blog settings" ON public.blog_settings;
create policy "Anyone can view blog settings" on public.blog_settings as permissive for SELECT to public using (true);
create policy "Users can insert their own quiz attempts" on public.career_quiz_attempts as permissive for INSERT to public with check (((auth.uid() = user_id) OR (session_id = ((current_setting('request.headers'::text))::json ->> 'session-id'::text))));
create policy "Users can view their own quiz attempts" on public.career_quiz_attempts as permissive for SELECT to public using (((auth.uid() = user_id) OR (session_id = ((current_setting('request.headers'::text))::json ->> 'session-id'::text))));
create policy "Users can view feedback" on public.user_feedback as permissive for SELECT to authenticated using (true);
