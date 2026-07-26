
-- Fix content_items RLS: the existing FOR ALL policy checks by content_item id,
-- which fails on INSERT (the row doesn't exist yet). Add a proper insert/update
-- policy checked against the target course.

CREATE OR REPLACE FUNCTION public.can_manage_course_content(viewer_id uuid, target_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = target_course_id
      AND (
        public.has_role(viewer_id, 'admin')
        OR c.instructor_id = viewer_id
        OR public.is_course_instructor(viewer_id, c.id)
      )
  );
$$;

DROP POLICY IF EXISTS "Instructors can insert content items" ON public.content_items;
CREATE POLICY "Instructors can insert content items"
ON public.content_items FOR INSERT TO authenticated
WITH CHECK (public.can_manage_course_content(auth.uid(), course_id));

DROP POLICY IF EXISTS "Instructors can update content items" ON public.content_items;
CREATE POLICY "Instructors can update content items"
ON public.content_items FOR UPDATE TO authenticated
USING (public.can_manage_course_content(auth.uid(), course_id))
WITH CHECK (public.can_manage_course_content(auth.uid(), course_id));

DROP POLICY IF EXISTS "Instructors can delete content items" ON public.content_items;
CREATE POLICY "Instructors can delete content items"
ON public.content_items FOR DELETE TO authenticated
USING (public.can_manage_course_content(auth.uid(), course_id));

-- Same class of bug likely affects modules, quizzes, quiz_questions, assignments.
-- Add insert/update/delete policies keyed on course/parent for course managers.

-- modules
DROP POLICY IF EXISTS "Instructors can insert modules" ON public.modules;
CREATE POLICY "Instructors can insert modules"
ON public.modules FOR INSERT TO authenticated
WITH CHECK (public.can_manage_course_content(auth.uid(), course_id));

DROP POLICY IF EXISTS "Instructors can update modules" ON public.modules;
CREATE POLICY "Instructors can update modules"
ON public.modules FOR UPDATE TO authenticated
USING (public.can_manage_course_content(auth.uid(), course_id))
WITH CHECK (public.can_manage_course_content(auth.uid(), course_id));

DROP POLICY IF EXISTS "Instructors can delete modules" ON public.modules;
CREATE POLICY "Instructors can delete modules"
ON public.modules FOR DELETE TO authenticated
USING (public.can_manage_course_content(auth.uid(), course_id));

-- quizzes (via content_items.course_id)
CREATE OR REPLACE FUNCTION public.can_manage_content_item(viewer_id uuid, target_content_item_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.content_items ci
    WHERE ci.id = target_content_item_id
      AND public.can_manage_course_content(viewer_id, ci.course_id)
  );
$$;

DROP POLICY IF EXISTS "Instructors can insert quizzes" ON public.quizzes;
CREATE POLICY "Instructors can insert quizzes"
ON public.quizzes FOR INSERT TO authenticated
WITH CHECK (public.can_manage_content_item(auth.uid(), content_item_id));

DROP POLICY IF EXISTS "Instructors can update quizzes" ON public.quizzes;
CREATE POLICY "Instructors can update quizzes"
ON public.quizzes FOR UPDATE TO authenticated
USING (public.can_manage_content_item(auth.uid(), content_item_id))
WITH CHECK (public.can_manage_content_item(auth.uid(), content_item_id));

DROP POLICY IF EXISTS "Instructors can delete quizzes" ON public.quizzes;
CREATE POLICY "Instructors can delete quizzes"
ON public.quizzes FOR DELETE TO authenticated
USING (public.can_manage_content_item(auth.uid(), content_item_id));

-- quiz_questions
CREATE OR REPLACE FUNCTION public.can_manage_quiz(viewer_id uuid, target_quiz_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = target_quiz_id
      AND public.can_manage_content_item(viewer_id, q.content_item_id)
  );
$$;

DROP POLICY IF EXISTS "Instructors can insert quiz questions" ON public.quiz_questions;
CREATE POLICY "Instructors can insert quiz questions"
ON public.quiz_questions FOR INSERT TO authenticated
WITH CHECK (public.can_manage_quiz(auth.uid(), quiz_id));

DROP POLICY IF EXISTS "Instructors can update quiz questions" ON public.quiz_questions;
CREATE POLICY "Instructors can update quiz questions"
ON public.quiz_questions FOR UPDATE TO authenticated
USING (public.can_manage_quiz(auth.uid(), quiz_id))
WITH CHECK (public.can_manage_quiz(auth.uid(), quiz_id));

DROP POLICY IF EXISTS "Instructors can delete quiz questions" ON public.quiz_questions;
CREATE POLICY "Instructors can delete quiz questions"
ON public.quiz_questions FOR DELETE TO authenticated
USING (public.can_manage_quiz(auth.uid(), quiz_id));

-- assignments
DROP POLICY IF EXISTS "Instructors can insert assignments" ON public.assignments;
CREATE POLICY "Instructors can insert assignments"
ON public.assignments FOR INSERT TO authenticated
WITH CHECK (public.can_manage_content_item(auth.uid(), content_item_id));

DROP POLICY IF EXISTS "Instructors can update assignments" ON public.assignments;
CREATE POLICY "Instructors can update assignments"
ON public.assignments FOR UPDATE TO authenticated
USING (public.can_manage_content_item(auth.uid(), content_item_id))
WITH CHECK (public.can_manage_content_item(auth.uid(), content_item_id));

DROP POLICY IF EXISTS "Instructors can delete assignments" ON public.assignments;
CREATE POLICY "Instructors can delete assignments"
ON public.assignments FOR DELETE TO authenticated
USING (public.can_manage_content_item(auth.uid(), content_item_id));
