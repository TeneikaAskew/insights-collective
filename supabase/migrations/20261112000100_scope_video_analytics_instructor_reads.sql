-- Fix the instructor read policy on video_analytics.
--
-- It required the reader to be the course's instructor_id OR to hold BOTH the
-- admin and instructor roles (roles @> ARRAY['admin','instructor']), so a
-- co-instructor saw nothing and an admin without the instructor role saw
-- nothing. Match the course-scoped instructor read used for
-- module_progressions (20261109003000): course owner, assigned course
-- instructor, or admin. Learners' own-row policies are unchanged.
ALTER POLICY "Instructors can view course video analytics"
ON public.video_analytics
USING (
  EXISTS (
    SELECT 1
    FROM public.content_items ci
    JOIN public.courses c ON c.id = ci.course_id
    WHERE ci.id = video_analytics.content_item_id
      AND (
        c.instructor_id = auth.uid()
        OR public.is_course_instructor(auth.uid(), c.id)
        OR 'admin'::public.app_role = ANY (public.get_user_roles(auth.uid()))
      )
  )
);
