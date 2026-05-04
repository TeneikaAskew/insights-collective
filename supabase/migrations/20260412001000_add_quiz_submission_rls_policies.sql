-- Allow learners to create/read/update their own quiz submissions and answers.
-- Fixes 403 "new row violates row-level security policy" for quiz_submissions.

ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_submission_answers ENABLE ROW LEVEL SECURITY;

-- Clean up any previous policy names to avoid duplicate errors.
DROP POLICY IF EXISTS "Users can create their own quiz submissions" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Users can view their own quiz submissions" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Users can update their own quiz submissions" ON public.quiz_submissions;

DROP POLICY IF EXISTS "Users can create their own quiz submission answers" ON public.quiz_submission_answers;
DROP POLICY IF EXISTS "Users can view their own quiz submission answers" ON public.quiz_submission_answers;
DROP POLICY IF EXISTS "Users can update their own quiz submission answers" ON public.quiz_submission_answers;
DROP POLICY IF EXISTS "Users can delete their own quiz submission answers" ON public.quiz_submission_answers;

-- Quiz submissions: learner policies
CREATE POLICY "Users can create their own quiz submissions"
  ON public.quiz_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own quiz submissions"
  ON public.quiz_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own quiz submissions"
  ON public.quiz_submissions FOR UPDATE
  USING (auth.uid() = user_id);

-- Instructors/admins can read quiz submissions for their courses
CREATE POLICY "Instructors can view quiz submissions"
  ON public.quiz_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.quizzes q
      JOIN public.content_items ci ON ci.id = q.content_item_id
      JOIN public.courses c ON c.id = ci.course_id
      WHERE q.id = quiz_submissions.quiz_id
      AND (
        c.instructor_id = auth.uid()
        OR 'instructor' = ANY(get_user_roles(auth.uid()))
        OR 'admin' = ANY(get_user_roles(auth.uid()))
      )
    )
  );

-- Quiz submission answers: learner policies (via owning submission)
CREATE POLICY "Users can create their own quiz submission answers"
  ON public.quiz_submission_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quiz_submissions qs
      WHERE qs.id = quiz_submission_answers.quiz_submission_id
      AND qs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own quiz submission answers"
  ON public.quiz_submission_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_submissions qs
      WHERE qs.id = quiz_submission_answers.quiz_submission_id
      AND qs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own quiz submission answers"
  ON public.quiz_submission_answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_submissions qs
      WHERE qs.id = quiz_submission_answers.quiz_submission_id
      AND qs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own quiz submission answers"
  ON public.quiz_submission_answers FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_submissions qs
      WHERE qs.id = quiz_submission_answers.quiz_submission_id
      AND qs.user_id = auth.uid()
    )
  );

-- Instructors/admins can read quiz submission answers for their courses
CREATE POLICY "Instructors can view quiz submission answers"
  ON public.quiz_submission_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_submissions qs
      JOIN public.quizzes q ON q.id = qs.quiz_id
      JOIN public.content_items ci ON ci.id = q.content_item_id
      JOIN public.courses c ON c.id = ci.course_id
      WHERE qs.id = quiz_submission_answers.quiz_submission_id
      AND (
        c.instructor_id = auth.uid()
        OR 'instructor' = ANY(get_user_roles(auth.uid()))
        OR 'admin' = ANY(get_user_roles(auth.uid()))
      )
    )
  );
