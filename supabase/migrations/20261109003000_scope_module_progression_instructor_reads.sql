-- Scope instructor reads to the module course; preserve student-own policies and data.
ALTER POLICY "Instructors can view module progressions"
ON public.module_progressions
USING (
  EXISTS (
    SELECT 1
    FROM public.modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = module_progressions.module_id
      AND (
        c.instructor_id = auth.uid()
        OR public.is_course_instructor(auth.uid(), c.id)
        OR 'admin'::public.app_role = ANY (public.get_user_roles(auth.uid()))
      )
  )
);
