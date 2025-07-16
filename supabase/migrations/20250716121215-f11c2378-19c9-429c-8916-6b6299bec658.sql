-- Create assignments table for Canvas-style content
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  points_possible INTEGER,
  due_at TIMESTAMP WITH TIME ZONE,
  unlock_at TIMESTAMP WITH TIME ZONE,
  lock_at TIMESTAMP WITH TIME ZONE,
  submission_types TEXT[] DEFAULT ARRAY['online_text_entry'],
  allowed_attempts INTEGER DEFAULT 1,
  peer_reviews BOOLEAN DEFAULT false,
  anonymous_peer_reviews BOOLEAN DEFAULT false,
  grading_type TEXT DEFAULT 'points' CHECK (grading_type IN ('points', 'percent', 'letter_grade', 'pass_fail')),
  grading_standard_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create quizzes table for Canvas-style content
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  quiz_type TEXT DEFAULT 'assignment' CHECK (quiz_type IN ('assignment', 'practice', 'survey')),
  points_possible INTEGER,
  time_limit INTEGER, -- in minutes
  allowed_attempts INTEGER DEFAULT 1,
  shuffle_answers BOOLEAN DEFAULT false,
  shuffle_questions BOOLEAN DEFAULT false,
  require_lockdown_browser BOOLEAN DEFAULT false,
  require_lockdown_browser_for_results BOOLEAN DEFAULT false,
  one_question_at_a_time BOOLEAN DEFAULT false,
  cant_go_back BOOLEAN DEFAULT false,
  show_correct_answers BOOLEAN DEFAULT true,
  show_correct_answers_last_attempt BOOLEAN DEFAULT false,
  show_correct_answers_at TIMESTAMP WITH TIME ZONE,
  hide_correct_answers_at TIMESTAMP WITH TIME ZONE,
  due_at TIMESTAMP WITH TIME ZONE,
  unlock_at TIMESTAMP WITH TIME ZONE,
  lock_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create quiz_questions table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay', 'matching', 'multiple_answers')),
  question_text TEXT NOT NULL,
  points DECIMAL NOT NULL DEFAULT 1,
  position INTEGER NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]',
  correct_comments TEXT,
  incorrect_comments TEXT,
  neutral_comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create module_progressions table
CREATE TABLE IF NOT EXISTS public.module_progressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  workflow_state TEXT DEFAULT 'locked' CHECK (workflow_state IN ('locked', 'started', 'completed')),
  current_position INTEGER,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS on new tables
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_progressions ENABLE ROW LEVEL SECURITY;

-- RLS policies for assignments
CREATE POLICY "Users can view assignments in enrolled courses" ON public.assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.courses c ON ci.course_id = c.id
      WHERE ci.id = assignments.content_item_id
      AND (
        EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = c.id AND e.user_id = auth.uid())
        OR c.instructor_id = auth.uid()
        OR 'instructor' = ANY(get_user_roles(auth.uid()))
        OR 'admin' = ANY(get_user_roles(auth.uid()))
      )
    )
  );

CREATE POLICY "Instructors can manage assignments" ON public.assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.courses c ON ci.course_id = c.id
      WHERE ci.id = assignments.content_item_id
      AND (
        c.instructor_id = auth.uid()
        OR 'instructor' = ANY(get_user_roles(auth.uid()))
        OR 'admin' = ANY(get_user_roles(auth.uid()))
      )
    )
  );

-- RLS policies for quizzes
CREATE POLICY "Users can view quizzes in enrolled courses" ON public.quizzes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.courses c ON ci.course_id = c.id
      WHERE ci.id = quizzes.content_item_id
      AND (
        EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = c.id AND e.user_id = auth.uid())
        OR c.instructor_id = auth.uid()
        OR 'instructor' = ANY(get_user_roles(auth.uid()))
        OR 'admin' = ANY(get_user_roles(auth.uid()))
      )
    )
  );

CREATE POLICY "Instructors can manage quizzes" ON public.quizzes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.courses c ON ci.course_id = c.id
      WHERE ci.id = quizzes.content_item_id
      AND (
        c.instructor_id = auth.uid()
        OR 'instructor' = ANY(get_user_roles(auth.uid()))
        OR 'admin' = ANY(get_user_roles(auth.uid()))
      )
    )
  );

-- RLS policies for quiz_questions
CREATE POLICY "Users can view quiz questions in enrolled courses" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.content_items ci ON q.content_item_id = ci.id
      JOIN public.courses c ON ci.course_id = c.id
      WHERE q.id = quiz_questions.quiz_id
      AND (
        EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = c.id AND e.user_id = auth.uid())
        OR c.instructor_id = auth.uid()
        OR 'instructor' = ANY(get_user_roles(auth.uid()))
        OR 'admin' = ANY(get_user_roles(auth.uid()))
      )
    )
  );

CREATE POLICY "Instructors can manage quiz questions" ON public.quiz_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.content_items ci ON q.content_item_id = ci.id
      JOIN public.courses c ON ci.course_id = c.id
      WHERE q.id = quiz_questions.quiz_id
      AND (
        c.instructor_id = auth.uid()
        OR 'instructor' = ANY(get_user_roles(auth.uid()))
        OR 'admin' = ANY(get_user_roles(auth.uid()))
      )
    )
  );

-- RLS policies for module_progressions
CREATE POLICY "Users can view their own module progressions" ON public.module_progressions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own module progressions" ON public.module_progressions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Instructors can view module progressions for their courses" ON public.module_progressions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON m.course_id = c.id
      WHERE m.id = module_progressions.module_id
      AND (
        c.instructor_id = auth.uid()
        OR 'instructor' = ANY(get_user_roles(auth.uid()))
        OR 'admin' = ANY(get_user_roles(auth.uid()))
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignments_content_item_id ON public.assignments(content_item_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_content_item_id ON public.quizzes(content_item_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_module_progressions_user_module ON public.module_progressions(user_id, module_id);

-- Create update triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON public.assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quizzes_updated_at
    BEFORE UPDATE ON public.quizzes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quiz_questions_updated_at
    BEFORE UPDATE ON public.quiz_questions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_module_progressions_updated_at
    BEFORE UPDATE ON public.module_progressions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();