-- Add content_item_id column to existing assignments table
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS content_item_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE;

-- Create quizzes table for Canvas-style content
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
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

-- Create quiz_questions table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  points DECIMAL NOT NULL DEFAULT 1,
  position INTEGER NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for quizzes
CREATE POLICY "Enable read access for all users" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.quizzes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON public.quizzes FOR UPDATE USING (auth.role() = 'authenticated');

-- Create basic RLS policies for quiz_questions  
CREATE POLICY "Enable read access for all users" ON public.quiz_questions FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.quiz_questions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON public.quiz_questions FOR UPDATE USING (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignments_content_item_id ON public.assignments(content_item_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_content_item_id ON public.quizzes(content_item_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);