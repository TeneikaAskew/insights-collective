-- Migration content proposal. Generate its migration filename through the supported
-- CLI workflow after the existing migration-generation restriction is resolved.
-- Change only this SELECT predicate; retain student-own policies, grants and rows.
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
