-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL,
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

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Create basic policy for quizzes
CREATE POLICY "Allow authenticated users" ON public.quizzes FOR ALL USING (auth.role() = 'authenticated');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quizzes_content_item_id ON public.quizzes(content_item_id);