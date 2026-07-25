
-- Fix 403 on quizzes/quiz_questions inserts during course creation.
-- Root cause: missing Data-API GRANTs + no direct SELECT policy for
-- instructors/admins, so PostgREST's select-back after INSERT fails.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;

-- Direct instructor/admin policies on quizzes, mirroring the modules fix.
DROP POLICY IF EXISTS "Instructors can insert quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can update quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can delete quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can select quizzes" ON public.quizzes;

CREATE POLICY "Instructors can select quizzes" ON public.quizzes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.content_items ci
    JOIN public.courses c ON c.id = ci.course_id
    WHERE ci.id = quizzes.content_item_id
      AND (c.instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Instructors can insert quizzes" ON public.quizzes
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.content_items ci
    JOIN public.courses c ON c.id = ci.course_id
    WHERE ci.id = quizzes.content_item_id
      AND (c.instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Instructors can update quizzes" ON public.quizzes
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.content_items ci
    JOIN public.courses c ON c.id = ci.course_id
    WHERE ci.id = quizzes.content_item_id
      AND (c.instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.content_items ci
    JOIN public.courses c ON c.id = ci.course_id
    WHERE ci.id = quizzes.content_item_id
      AND (c.instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Instructors can delete quizzes" ON public.quizzes
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.content_items ci
    JOIN public.courses c ON c.id = ci.course_id
    WHERE ci.id = quizzes.content_item_id
      AND (c.instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Mirror for quiz_questions so seeded questions in the wizard also insert
-- and can be selected back.
DROP POLICY IF EXISTS "Instructors can select quiz_questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can insert quiz_questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can update quiz_questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can delete quiz_questions" ON public.quiz_questions;

CREATE POLICY "Instructors can select quiz_questions" ON public.quiz_questions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.content_items ci ON ci.id = q.content_item_id
    JOIN public.courses c ON c.id = ci.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (c.instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Instructors can insert quiz_questions" ON public.quiz_questions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.content_items ci ON ci.id = q.content_item_id
    JOIN public.courses c ON c.id = ci.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (c.instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Instructors can update quiz_questions" ON public.quiz_questions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.content_items ci ON ci.id = q.content_item_id
    JOIN public.courses c ON c.id = ci.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (c.instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.content_items ci ON ci.id = q.content_item_id
    JOIN public.courses c ON c.id = ci.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (c.instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Instructors can delete quiz_questions" ON public.quiz_questions
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.content_items ci ON ci.id = q.content_item_id
    JOIN public.courses c ON c.id = ci.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (c.instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);
