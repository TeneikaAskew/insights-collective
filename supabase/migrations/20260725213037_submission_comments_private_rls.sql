-- The owner branches of the SELECT policy let a student read instructors'
-- private notes on their own submission. Exclude is_private rows from the
-- owner branches; authors and course staff still see everything theirs/in
-- their courses.
DROP POLICY "Users view comments on their submissions" ON public.submission_comments;
CREATE POLICY "Users view comments on their submissions" ON public.submission_comments
  FOR SELECT USING (
    author_id = auth.uid() OR
    (submission_type = 'assignment' AND is_private = false AND EXISTS (
      SELECT 1 FROM public.assignment_submissions asub
      WHERE asub.id = submission_comments.submission_id
        AND asub.user_id = auth.uid()
    )) OR
    (submission_type = 'quiz' AND is_private = false AND EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = submission_comments.submission_id
        AND qa.user_id = auth.uid()
    )) OR
    (submission_type = 'assignment' AND EXISTS (
      SELECT 1
      FROM public.assignment_submissions asub
      JOIN public.assignments a ON a.id = asub.assignment_id
      JOIN public.course_assignments ca ON ca.course_id = a.course_id
      WHERE asub.id = submission_comments.submission_id
        AND ca.user_id = auth.uid()
        AND ca.role IN ('instructor', 'assistant')
    ))
  );
