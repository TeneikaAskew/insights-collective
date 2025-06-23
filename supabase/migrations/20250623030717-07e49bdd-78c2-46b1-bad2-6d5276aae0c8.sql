-- Create module_progress table for tracking module completion
CREATE TABLE IF NOT EXISTS public.module_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id UUID NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completion_percentage INTEGER DEFAULT 0,
  time_spent INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE public.module_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for module progress
CREATE POLICY "Users can view their own module progress" 
ON public.module_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own module progress" 
ON public.module_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own module progress" 
ON public.module_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create assignment_progress table for tracking assignment completion
CREATE TABLE IF NOT EXISTS public.assignment_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_block_id UUID NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  submission_data JSONB DEFAULT '{}',
  grade INTEGER,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_block_id)
);

-- Enable RLS for assignment progress
ALTER TABLE public.assignment_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for assignment progress
CREATE POLICY "Users can view their own assignment progress" 
ON public.assignment_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assignment progress" 
ON public.assignment_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assignment progress" 
ON public.assignment_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_module_progress_user_module ON public.module_progress(user_id, module_id);
CREATE INDEX IF NOT EXISTS idx_assignment_progress_user_block ON public.assignment_progress(user_id, content_block_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON public.quiz_attempts(user_id, quiz_id);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_assignment_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assignment_progress_updated_at
    BEFORE UPDATE ON public.assignment_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.update_assignment_progress_updated_at();