-- Bootstrap quiz submissions tables + RLS policies for production if missing.

CREATE TABLE IF NOT EXISTS public.quiz_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  submission_id UUID UNIQUE DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  attempt INTEGER DEFAULT 1,
  extra_attempts INTEGER DEFAULT 0,
  extra_time INTEGER DEFAULT 0,
  manually_unlocked BOOLEAN DEFAULT false,
  time_spent INTEGER,
  score DECIMAL(10,2),
  kept_score DECIMAL(10,2),
  workflow_state TEXT DEFAULT 'untaken',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_quiz_attempt UNIQUE (quiz_id, user_id, attempt)
);

CREATE TABLE IF NOT EXISTS public.quiz_submission_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_submission_id UUID NOT NULL REFERENCES public.quiz_submissions(id) ON DELETE CASCADE,
  quiz_question_id UUID NOT NULL REFERENCES public.quiz_questions(id),
  answer_data JSONB NOT NULL,
  correct BOOLEAN,
  points DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_user
  ON public.quiz_submissions(quiz_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_submission_answers_sub_question
  ON public.quiz_submission_answers(quiz_submission_id, quiz_question_id);

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
DROP POLICY IF EXISTS "Instructors can view quiz submissions" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Instructors can view quiz submission answers" ON public.quiz_submission_answers;

CREATE POLICY "Users can create their own quiz submissions"
  ON public.quiz_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own quiz submissions"
  ON public.quiz_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own quiz submissions"
  ON public.quiz_submissions FOR UPDATE
  USING (auth.uid() = user_id);

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
