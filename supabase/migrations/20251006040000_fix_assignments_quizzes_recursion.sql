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
CREATE OR REPLACE FUNCTION public.can_access_assignment(viewer_id UUID, assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER -- Bypasses RLS to prevent recursion
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.content_items ci ON a.content_item_id = ci.id
    JOIN public.courses c ON ci.course_id = c.id
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
      -- Students can access assignments in enrolled courses (only if published)
      (e.user_id IS NOT NULL AND ci.published = true)
    )
  );
$$;

-- STEP 4: Create SECURITY DEFINER function to check quiz access
CREATE OR REPLACE FUNCTION public.can_access_quiz(viewer_id UUID, quiz_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER -- Bypasses RLS to prevent recursion
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.content_items ci ON q.content_item_id = ci.id
    JOIN public.courses c ON ci.course_id = c.id
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
      -- Students can access quizzes in enrolled courses (only if published)
      (e.user_id IS NOT NULL AND ci.published = true)
    )
  );
$$;

-- STEP 5: Create simple policies for assignments using SECURITY DEFINER function
CREATE POLICY "Users can view accessible assignments"
ON public.assignments
FOR SELECT
TO authenticated
USING (public.can_access_assignment(auth.uid(), id));

CREATE POLICY "Instructors and admins can manage assignments"
ON public.assignments
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR
  EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.content_items ci ON a.content_item_id = ci.id
    JOIN public.courses c ON ci.course_id = c.id
    WHERE a.id = assignments.id
    AND (
      c.instructor_id = auth.uid()
      OR public.is_course_instructor(auth.uid(), c.id)
    )
  )
);

-- STEP 6: Create simple policies for quizzes using SECURITY DEFINER function
CREATE POLICY "Users can view accessible quizzes"
ON public.quizzes
FOR SELECT
TO authenticated
USING (public.can_access_quiz(auth.uid(), id));

CREATE POLICY "Instructors and admins can manage quizzes"
ON public.quizzes
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR
  EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.content_items ci ON q.content_item_id = ci.id
    JOIN public.courses c ON ci.course_id = c.id
    WHERE q.id = quizzes.id
    AND (
      c.instructor_id = auth.uid()
      OR public.is_course_instructor(auth.uid(), c.id)
    )
  )
);

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
    JOIN public.content_items ci ON q.content_item_id = ci.id
    JOIN public.courses c ON ci.course_id = c.id
    LEFT JOIN public.enrollments e ON c.id = e.course_id AND e.user_id = viewer_id
    WHERE qq.id = question_id
    AND (
      public.has_role(viewer_id, 'admin')
      OR c.instructor_id = viewer_id
      OR public.is_course_instructor(viewer_id, c.id)
      OR (e.user_id IS NOT NULL AND ci.published = true)
    )
  );
$$;

-- STEP 12: Create SECURITY DEFINER function for assignment_submissions access
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
    JOIN public.content_items ci ON a.content_item_id = ci.id
    JOIN public.courses c ON ci.course_id = c.id
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

-- STEP 13: Create policies for quiz_questions
CREATE POLICY "Users can view accessible quiz questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (public.can_access_quiz_question(auth.uid(), id));

CREATE POLICY "Instructors and admins can manage quiz questions"
ON public.quiz_questions
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR
  EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    JOIN public.quizzes q ON qq.quiz_id = q.id
    JOIN public.content_items ci ON q.content_item_id = ci.id
    JOIN public.courses c ON ci.course_id = c.id
    WHERE qq.id = quiz_questions.id
    AND (
      c.instructor_id = auth.uid()
      OR public.is_course_instructor(auth.uid(), c.id)
    )
  )
);

-- STEP 14: Create policies for assignment_submissions
CREATE POLICY "Users can view accessible submissions"
ON public.assignment_submissions
FOR SELECT
TO authenticated
USING (public.can_access_submission(auth.uid(), id));

CREATE POLICY "Students can create and update own submissions"
ON public.assignment_submissions
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  OR
  public.has_role(auth.uid(), 'admin')
  OR
  EXISTS (
    SELECT 1 FROM public.assignment_submissions subs
    JOIN public.assignments a ON subs.assignment_id = a.id
    JOIN public.content_items ci ON a.content_item_id = ci.id
    JOIN public.courses c ON ci.course_id = c.id
    WHERE subs.id = assignment_submissions.id
    AND (
      c.instructor_id = auth.uid()
      OR public.is_course_instructor(auth.uid(), c.id)
    )
  )
);

-- STEP 15: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.can_access_quiz_question TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_submission TO authenticated;

-- STEP 16: Add comments
COMMENT ON FUNCTION public.can_access_quiz_question IS 'SECURITY DEFINER function to check quiz question access. Bypasses RLS to prevent circular dependencies.';
COMMENT ON FUNCTION public.can_access_submission IS 'SECURITY DEFINER function to check assignment submission access. Bypasses RLS to prevent circular dependencies.';
