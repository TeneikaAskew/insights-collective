-- PREPARED ON A BRANCH. NOT APPLIED to any hosted database. Apply only through db-migrate.yml after review.
-- Security repair r2 (pr134/security-repair-plan-r1/INTENT-PROPOSAL-r2.md). Policies only: no table, column,
-- grant, function, row or role is created, changed or deleted. Each policy keeps its live command; quiz and
-- feedback keep their live names and role lists (scripts/local-stack/schema/04_rls_policies.sql). Only predicates narrow.
--
-- 1. career_quiz_attempts: the session-id branch now matches only anonymous rows (user_id IS NULL), so a
--    caller presenting a signed-in user's session id can no longer read or insert that user's rows.
--    Anonymous compatibility is preserved: an anonymous row with a matching session-id header still reads
--    and inserts exactly as before. Signed-in callers keep the auth.uid() = user_id branch unchanged.
-- 2. user_feedback SELECT: was every authenticated user reading every row (USING true). Now the row's owner
--    or an admin. The insert path (useFeedbackSubmission) does no read; INSERT/UPDATE policies unchanged.
-- 3. blog_settings SELECT, renamed from "Anyone can view blog settings" (no longer true), role list public ->
--    authenticated: was anyone, including anon (exposes notification_email). Now the same roles that may author posts (20260731000000_tighten_blog_posts_rls: admin or instructor), who reach /admin/blog
--    and whose BlogPostForm reads auto_generate_excerpts. The admin write policy is unchanged.

-- 1. career_quiz_attempts
DROP POLICY IF EXISTS "Users can view their own quiz attempts" ON public.career_quiz_attempts;
CREATE POLICY "Users can view their own quiz attempts"
ON public.career_quiz_attempts
FOR SELECT
TO public
USING (
  (auth.uid() = user_id)
  OR (user_id IS NULL AND session_id = ((current_setting('request.headers'::text))::json ->> 'session-id'::text))
);

DROP POLICY IF EXISTS "Users can insert their own quiz attempts" ON public.career_quiz_attempts;
CREATE POLICY "Users can insert their own quiz attempts"
ON public.career_quiz_attempts
FOR INSERT
TO public
WITH CHECK (
  (auth.uid() = user_id)
  OR (user_id IS NULL AND session_id = ((current_setting('request.headers'::text))::json ->> 'session-id'::text))
);

-- 2. user_feedback
DROP POLICY IF EXISTS "Users can view feedback" ON public.user_feedback;
CREATE POLICY "Users can view feedback"
ON public.user_feedback
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id)
  OR public.has_admin_access(auth.uid())
);

-- 3. blog_settings
DROP POLICY IF EXISTS "Anyone can view blog settings" ON public.blog_settings;
CREATE POLICY "Blog authors can view blog settings"
ON public.blog_settings
FOR SELECT
TO authenticated
USING (
  public.has_admin_access(auth.uid())
  OR 'instructor' = ANY(public.get_user_roles(auth.uid()))
);
