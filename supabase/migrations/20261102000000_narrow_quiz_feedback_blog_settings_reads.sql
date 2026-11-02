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
--    authenticated: was anyone, including anon (exposes notification_email). Now the same roles that may author
--    posts (20260731000000_tighten_blog_posts_rls: admin or instructor), who reach /admin/blog
--    and whose BlogPostForm reads auto_generate_excerpts. The admin write policy is unchanged.
--    Instructors keep FULL-ROW read, notification_email included: BlogPostForm's select('*') authoring path is
--    preserved. This is not admin-only email isolation; that would be a separate change.
--
-- Replacement, not addition: each DROP is a plain DROP POLICY (no IF EXISTS), so a live name that differs from
-- the snapshot fails the migration instead of leaving the old wide policy as an OR peer of the new one. After
-- this file, the only permissive SELECT/ALL policies on the three tables are the ones named here plus
-- "Admins can manage blog settings" (unchanged). Untouched: feedback INSERT and UPDATE, blog admin writes, and
-- every assistant/other-table policy.
-- Role semantics: get_user_roles reads public.user_roles (SECURITY DEFINER, default ARRAY['student']) as redefined
-- by 20251006020000_proper_security_fix_with_user_roles.sql; has_admin_access (20250621123219) is
-- 'admin' = ANY(get_user_roles(uid)), so it inherits that. The June 2025 get_user_roles read profiles.roles and
-- is superseded. The live bodies were not re-verified on 2026-11-02; check against the retained live report.

-- 1. career_quiz_attempts
DROP POLICY "Users can view their own quiz attempts" ON public.career_quiz_attempts;
CREATE POLICY "Users can view their own quiz attempts"
ON public.career_quiz_attempts
FOR SELECT
TO public
USING (
  (auth.uid() = user_id)
  OR (user_id IS NULL AND session_id = ((current_setting('request.headers'::text))::json ->> 'session-id'::text))
);

DROP POLICY "Users can insert their own quiz attempts" ON public.career_quiz_attempts;
CREATE POLICY "Users can insert their own quiz attempts"
ON public.career_quiz_attempts
FOR INSERT
TO public
WITH CHECK (
  (auth.uid() = user_id)
  OR (user_id IS NULL AND session_id = ((current_setting('request.headers'::text))::json ->> 'session-id'::text))
);

-- 2. user_feedback
DROP POLICY "Users can view feedback" ON public.user_feedback;
CREATE POLICY "Users can view feedback"
ON public.user_feedback
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id)
  OR public.has_admin_access(auth.uid())
);

-- 3. blog_settings
DROP POLICY "Anyone can view blog settings" ON public.blog_settings;
CREATE POLICY "Blog authors can view blog settings"
ON public.blog_settings
FOR SELECT
TO authenticated
USING (
  public.has_admin_access(auth.uid())
  OR 'instructor' = ANY(public.get_user_roles(auth.uid()))
);
