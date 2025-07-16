-- Remove content_blocks references and update quizzes table

-- First, drop existing RLS policies that reference content_blocks
DROP POLICY IF EXISTS "Instructors can manage quizzes for their courses" ON public.quizzes;
DROP POLICY IF EXISTS "Users can view quizzes for accessible courses" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can manage quiz questions for their courses" ON public.quiz_questions;
DROP POLICY IF EXISTS "Users can view quiz questions for accessible quizzes" ON public.quiz_questions;

-- Drop the current quizzes table if it exists with content_block_id
DROP TABLE IF EXISTS public.quizzes CASCADE;

-- Create new quizzes table with content_item_id
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  quiz_type TEXT DEFAULT 'assignment',
  points_possible INTEGER,
  time_limit INTEGER,
  allowed_attempts INTEGER DEFAULT 1,
  shuffle_answers BOOLEAN DEFAULT false,
  shuffle_questions BOOLEAN DEFAULT false,
  show_correct_answers BOOLEAN DEFAULT true,
  due_at TIMESTAMP WITH TIME ZONE,
  unlock_at TIMESTAMP WITH TIME ZONE,
  lock_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on quizzes
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies for quizzes using content_items
CREATE POLICY "Instructors can manage quizzes for their courses" ON public.quizzes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM content_items ci
    JOIN courses c ON ci.course_id = c.id
    WHERE ci.id = quizzes.content_item_id
    AND (
      c.instructor_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id AND ca.user_id = auth.uid() AND ca.role = 'instructor'
      ) OR 
      has_admin_access(auth.uid())
    )
  )
);

CREATE POLICY "Users can view quizzes for accessible courses" ON public.quizzes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM content_items ci
    JOIN courses c ON ci.course_id = c.id
    WHERE ci.id = quizzes.content_item_id
    AND (
      EXISTS (
        SELECT 1 FROM enrollments e 
        WHERE e.course_id = c.id AND e.user_id = auth.uid()
      ) OR 
      c.instructor_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id AND ca.user_id = auth.uid() AND ca.role = 'instructor'
      ) OR 
      has_admin_access(auth.uid())
    )
  )
);

-- Create new RLS policies for quiz_questions using content_items
CREATE POLICY "Instructors can manage quiz questions for their courses" ON public.quiz_questions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM quizzes q
    JOIN content_items ci ON q.content_item_id = ci.id
    JOIN courses c ON ci.course_id = c.id
    WHERE q.id = quiz_questions.quiz_id
    AND (
      c.instructor_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id AND ca.user_id = auth.uid() AND ca.role = 'instructor'
      ) OR 
      has_admin_access(auth.uid())
    )
  )
);

CREATE POLICY "Users can view quiz questions for accessible quizzes" ON public.quiz_questions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM quizzes q
    JOIN content_items ci ON q.content_item_id = ci.id
    JOIN courses c ON ci.course_id = c.id
    WHERE q.id = quiz_questions.quiz_id
    AND (
      EXISTS (
        SELECT 1 FROM enrollments e 
        WHERE e.course_id = c.id AND e.user_id = auth.uid()
      ) OR 
      c.instructor_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id AND ca.user_id = auth.uid() AND ca.role = 'instructor'
      ) OR 
      has_admin_access(auth.uid())
    )
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quizzes_content_item_id ON public.quizzes(content_item_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);