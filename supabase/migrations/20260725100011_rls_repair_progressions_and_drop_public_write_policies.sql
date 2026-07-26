-- Reconstructed for repo/prod parity from schema_migrations.statements.
-- Applied directly to the hosted project (version 20260725100011); backfilled so a
-- fresh db build reproduces prod. Already recorded on prod, so db push skips it.

-- 1. Drop always-true policies that only granted PUBLIC write access.
-- The service role bypasses RLS entirely, so policies named "Service role
-- can ..." with USING/WITH CHECK true actually opened these tables to any
-- client. None of these tables has a legitimate client-side writer.
DROP POLICY IF EXISTS "Service role can insert tweets" ON public.tweets;
DROP POLICY IF EXISTS "Service role can update tweets" ON public.tweets;
DROP POLICY IF EXISTS "Allow service role to insert LinkedIn posts" ON public.linkedin_posts;
DROP POLICY IF EXISTS "Allow service role to update LinkedIn posts" ON public.linkedin_posts;
DROP POLICY IF EXISTS "Service role can manage scrape_metadata" ON public.scrape_metadata;
DROP POLICY IF EXISTS "Service role can insert progress snapshots" ON public.progress_snapshots;
DROP POLICY IF EXISTS "System can insert attempt questions" ON public.quiz_attempt_questions;

-- 2. Instructors/admins could not see student progressions (own-rows-only
-- SELECT policy), so instructor insight views silently rendered 0% for every
-- student. Mirror the instructor policy that quiz_submissions already has.
CREATE POLICY "Instructors can view course progressions"
ON public.content_item_progressions
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.content_items ci
    JOIN public.courses c ON c.id = ci.course_id
    WHERE ci.id = content_item_progressions.content_item_id
      AND (
        c.instructor_id = auth.uid()
        OR 'instructor'::app_role = ANY (public.get_user_roles(auth.uid()))
        OR 'admin'::app_role = ANY (public.get_user_roles(auth.uid()))
      )
  )
);

-- 3. module_progressions had RLS enabled with ZERO policies (deny-all):
-- every client read silently returned no rows. Standard own-rows policies
-- plus instructor read access.
CREATE POLICY "Users can view their own module progressions"
ON public.module_progressions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own module progressions"
ON public.module_progressions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own module progressions"
ON public.module_progressions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Instructors can view module progressions"
ON public.module_progressions
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = module_progressions.module_id
      AND (
        c.instructor_id = auth.uid()
        OR 'instructor'::app_role = ANY (public.get_user_roles(auth.uid()))
        OR 'admin'::app_role = ANY (public.get_user_roles(auth.uid()))
      )
  )
);
