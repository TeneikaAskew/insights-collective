
-- Replace SECURITY DEFINER function-based INSERT/UPDATE/DELETE checks on
-- assignments, quizzes, and quiz_questions with direct EXISTS joins on
-- content_items / courses. The STABLE definer functions do not see rows
-- inserted in the same transaction (INSERT ... RETURNING re-checks via the
-- policy on a snapshot that predates the just-inserted content_item),
-- causing 403s during course creation. This mirrors the earlier modules fix.

-- Ensure Data-API grants are present (idempotent).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.assignments TO service_role;
GRANT ALL ON public.quizzes TO service_role;
GRANT ALL ON public.quiz_questions TO service_role;

-- assignments
DROP POLICY IF EXISTS "Instructors can insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Instructors can update assignments" ON public.assignments;
DROP POLICY IF EXISTS "Instructors can delete assignments" ON public.assignments;

CREATE POLICY "Instructors can insert assignments"
  ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignments.course_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update assignments"
  ON public.assignments FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignments.course_id AND c.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignments.course_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete assignments"
  ON public.assignments FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignments.course_id AND c.instructor_id = auth.uid()
    )
  );

-- quizzes: pivot via content_items -> courses
DROP POLICY IF EXISTS "Instructors can insert quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can update quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can delete quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can manage quizzes" ON public.quizzes;

CREATE POLICY "Instructors can insert quizzes"
  ON public.quizzes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.courses c ON c.id = ci.course_id
      WHERE ci.id = quizzes.content_item_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update quizzes"
  ON public.quizzes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.courses c ON c.id = ci.course_id
      WHERE ci.id = quizzes.content_item_id AND c.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.courses c ON c.id = ci.course_id
      WHERE ci.id = quizzes.content_item_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete quizzes"
  ON public.quizzes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.courses c ON c.id = ci.course_id
      WHERE ci.id = quizzes.content_item_id AND c.instructor_id = auth.uid()
    )
  );

-- quiz_questions: pivot via quizzes -> content_items -> courses
DROP POLICY IF EXISTS "Instructors can insert quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can insert quiz_questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can update quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can update quiz_questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can delete quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can delete quiz_questions" ON public.quiz_questions;

CREATE POLICY "Instructors can insert quiz_questions"
  ON public.quiz_questions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.content_items ci ON ci.id = q.content_item_id
      JOIN public.courses c ON c.id = ci.course_id
      WHERE q.id = quiz_questions.quiz_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update quiz_questions"
  ON public.quiz_questions FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.content_items ci ON ci.id = q.content_item_id
      JOIN public.courses c ON c.id = ci.course_id
      WHERE q.id = quiz_questions.quiz_id AND c.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.content_items ci ON ci.id = q.content_item_id
      JOIN public.courses c ON c.id = ci.course_id
      WHERE q.id = quiz_questions.quiz_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete quiz_questions"
  ON public.quiz_questions FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.content_items ci ON ci.id = q.content_item_id
      JOIN public.courses c ON c.id = ci.course_id
      WHERE q.id = quiz_questions.quiz_id AND c.instructor_id = auth.uid()
    )
  );
