-- =============================================
-- FIX: Remove circular RLS dependencies in assignments and quizzes policies
-- =============================================

-- The problem: assignments/quizzes policies query content_items, but content_items queries join assignments/quizzes
-- This creates circular RLS evaluation leading to 400 Bad Request errors

-- STEP 1: Drop ALL current policies on assignments
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'assignments' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.assignments', pol.policyname);
  END LOOP;
END $$;

-- STEP 2: Drop ALL current policies on quizzes
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'quizzes' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.quizzes', pol.policyname);
  END LOOP;
END $$;

-- STEP 3: Create SECURITY DEFINER function to check assignment access
-- Handles both old schema (course_id) and new schema (content_item_id)
CREATE OR REPLACE FUNCTION public.can_access_assignment(viewer_id UUID, assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER -- Bypasses RLS to prevent recursion
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    LEFT JOIN public.content_items ci ON a.content_item_id = ci.id
    LEFT JOIN public.courses c ON COALESCE(ci.course_id, a.course_id) = c.id
    LEFT JOIN public.enrollments e ON c.id = e.course_id AND e.user_id = viewer_id
    WHERE a.id = assignment_id
    AND (
      -- Admins can access all
      public.has_role(viewer_id, 'admin')
      OR
      -- Instructors can access their course assignments
      c.instructor_id = viewer_id
      OR
      public.is_course_instructor(viewer_id, c.id)
      OR
      -- Students can access assignments in enrolled courses (only if published or no content_item)
      (e.user_id IS NOT NULL AND (ci.id IS NULL OR ci.published = true))
    )
  );
$$;

-- STEP 4: Create SECURITY DEFINER function to check quiz access
-- Handles both old schema (course_id) and new schema (content_item_id)
CREATE OR REPLACE FUNCTION public.can_access_quiz(viewer_id UUID, quiz_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER -- Bypasses RLS to prevent recursion
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quizzes q
    LEFT JOIN public.content_items ci ON q.content_item_id = ci.id
    LEFT JOIN public.courses c ON COALESCE(ci.course_id, q.course_id) = c.id
    LEFT JOIN public.enrollments e ON c.id = e.course_id AND e.user_id = viewer_id
    WHERE q.id = quiz_id
    AND (
      -- Admins can access all
      public.has_role(viewer_id, 'admin')
      OR
      -- Instructors can access their course quizzes
      c.instructor_id = viewer_id
      OR
      public.is_course_instructor(viewer_id, c.id)
      OR
      -- Students can access quizzes in enrolled courses (only if published or no content_item)
      (e.user_id IS NOT NULL AND (ci.id IS NULL OR ci.published = true))
    )
  );
$$;

-- STEP 5: Create simple policies for assignments using ONLY SECURITY DEFINER function
-- CRITICAL: Do NOT query any other tables in these policies to avoid circular dependencies
CREATE POLICY "Users can access assignments"
ON public.assignments
FOR ALL
TO authenticated
USING (public.can_access_assignment(auth.uid(), id));

-- STEP 6: Create simple policies for quizzes using ONLY SECURITY DEFINER function
-- CRITICAL: Do NOT query any other tables in these policies to avoid circular dependencies
CREATE POLICY "Users can access quizzes"
ON public.quizzes
FOR ALL
TO authenticated
USING (public.can_access_quiz(auth.uid(), id));

-- STEP 7: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.can_access_assignment TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_quiz TO authenticated;

-- STEP 8: Add comments
COMMENT ON FUNCTION public.can_access_assignment IS 'SECURITY DEFINER function to check assignment access. Bypasses RLS to prevent circular dependencies when content_items query joins assignments.';
COMMENT ON FUNCTION public.can_access_quiz IS 'SECURITY DEFINER function to check quiz access. Bypasses RLS to prevent circular dependencies when content_items query joins quizzes.';

-- =============================================
-- ADDITIONAL FIXES: quiz_questions and assignment_submissions
-- =============================================

-- STEP 9: Drop ALL current policies on quiz_questions
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'quiz_questions' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.quiz_questions', pol.policyname);
  END LOOP;
END $$;

-- STEP 10: Drop ALL current policies on assignment_submissions
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'assignment_submissions' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.assignment_submissions', pol.policyname);
  END LOOP;
END $$;

-- STEP 11: Create SECURITY DEFINER function for quiz_questions access
-- Handles both old schema (course_id) and new schema (content_item_id)
CREATE OR REPLACE FUNCTION public.can_access_quiz_question(viewer_id UUID, question_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    JOIN public.quizzes q ON qq.quiz_id = q.id
    LEFT JOIN public.content_items ci ON q.content_item_id = ci.id
    LEFT JOIN public.courses c ON COALESCE(ci.course_id, q.course_id) = c.id
    LEFT JOIN public.enrollments e ON c.id = e.course_id AND e.user_id = viewer_id
    WHERE qq.id = question_id
    AND (
      public.has_role(viewer_id, 'admin')
      OR c.instructor_id = viewer_id
      OR public.is_course_instructor(viewer_id, c.id)
      OR (e.user_id IS NOT NULL AND (ci.id IS NULL OR ci.published = true))
    )
  );
$$;

-- STEP 12: Create SECURITY DEFINER function for assignment_submissions access
-- Handles both old schema (course_id) and new schema (content_item_id)
CREATE OR REPLACE FUNCTION public.can_access_submission(viewer_id UUID, submission_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignment_submissions subs
    JOIN public.assignments a ON subs.assignment_id = a.id
    LEFT JOIN public.content_items ci ON a.content_item_id = ci.id
    LEFT JOIN public.courses c ON COALESCE(ci.course_id, a.course_id) = c.id
    WHERE subs.id = submission_id
    AND (
      -- Student can view own submissions
      subs.user_id = viewer_id
      OR
      -- Admins can view all
      public.has_role(viewer_id, 'admin')
      OR
      -- Instructors can view submissions in their courses
      c.instructor_id = viewer_id
      OR
      public.is_course_instructor(viewer_id, c.id)
    )
  );
$$;

-- STEP 13: Create policies for quiz_questions using ONLY SECURITY DEFINER function
-- CRITICAL: Do NOT query any other tables in these policies to avoid circular dependencies
CREATE POLICY "Users can access quiz questions"
ON public.quiz_questions
FOR ALL
TO authenticated
USING (public.can_access_quiz_question(auth.uid(), id));

-- STEP 14: Create policies for assignment_submissions using ONLY SECURITY DEFINER function
-- CRITICAL: Do NOT query any other tables in these policies to avoid circular dependencies
CREATE POLICY "Users can access submissions"
ON public.assignment_submissions
FOR ALL
TO authenticated
USING (public.can_access_submission(auth.uid(), id));

-- STEP 15: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.can_access_quiz_question TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_submission TO authenticated;

-- STEP 16: Add comments
COMMENT ON FUNCTION public.can_access_quiz_question IS 'SECURITY DEFINER function to check quiz question access. Bypasses RLS to prevent circular dependencies.';
COMMENT ON FUNCTION public.can_access_submission IS 'SECURITY DEFINER function to check assignment submission access. Bypasses RLS to prevent circular dependencies.';
