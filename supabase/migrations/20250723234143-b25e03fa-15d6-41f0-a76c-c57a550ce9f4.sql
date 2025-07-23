-- Create missing tables that are referenced in the application but don't exist

-- Create rubrics table
CREATE TABLE IF NOT EXISTS public.rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  points_possible INTEGER DEFAULT 100,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create rubric_criteria table
CREATE TABLE IF NOT EXISTS public.rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES public.rubrics(id) ON DELETE CASCADE,
  criterion TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create assignment_rubrics junction table
CREATE TABLE IF NOT EXISTS public.assignment_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  rubric_id UUID NOT NULL REFERENCES public.rubrics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(assignment_id, rubric_id)
);

-- Create question banks table (referenced in services)
CREATE TABLE IF NOT EXISTS public.question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create question_bank_questions table
CREATE TABLE IF NOT EXISTS public.question_bank_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_bank_id UUID NOT NULL REFERENCES public.question_banks(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  answers JSONB DEFAULT '[]',
  correct_answer JSONB,
  points DECIMAL DEFAULT 1,
  difficulty TEXT DEFAULT 'medium',
  topic_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank_questions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rubrics
CREATE POLICY "Instructors can manage rubrics for their courses" ON public.rubrics
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.id = rubrics.course_id 
    AND (
      c.instructor_id = auth.uid() 
      OR 'instructor' = ANY(get_user_roles(auth.uid()))
      OR 'admin' = ANY(get_user_roles(auth.uid()))
    )
  )
);

CREATE POLICY "Students can view rubrics for enrolled courses" ON public.rubrics
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM courses c 
    JOIN enrollments e ON c.id = e.course_id
    WHERE c.id = rubrics.course_id 
    AND e.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.id = rubrics.course_id 
    AND (
      c.instructor_id = auth.uid() 
      OR 'instructor' = ANY(get_user_roles(auth.uid()))
      OR 'admin' = ANY(get_user_roles(auth.uid()))
    )
  )
);

-- Create RLS policies for rubric_criteria
CREATE POLICY "Rubric criteria follow rubric access" ON public.rubric_criteria
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM rubrics r
    JOIN courses c ON r.course_id = c.id
    WHERE r.id = rubric_criteria.rubric_id 
    AND (
      c.instructor_id = auth.uid() 
      OR 'instructor' = ANY(get_user_roles(auth.uid()))
      OR 'admin' = ANY(get_user_roles(auth.uid()))
      OR EXISTS (
        SELECT 1 FROM enrollments e 
        WHERE e.course_id = c.id AND e.user_id = auth.uid()
      )
    )
  )
);

-- Create RLS policies for assignment_rubrics
CREATE POLICY "Assignment rubrics follow assignment access" ON public.assignment_rubrics
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM assignments a
    JOIN courses c ON a.course_id = c.id
    WHERE a.id = assignment_rubrics.assignment_id 
    AND (
      c.instructor_id = auth.uid() 
      OR 'instructor' = ANY(get_user_roles(auth.uid()))
      OR 'admin' = ANY(get_user_roles(auth.uid()))
      OR EXISTS (
        SELECT 1 FROM enrollments e 
        WHERE e.course_id = c.id AND e.user_id = auth.uid()
      )
    )
  )
);

-- Create RLS policies for question_banks
CREATE POLICY "Instructors can manage question banks for their courses" ON public.question_banks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.id = question_banks.course_id 
    AND (
      c.instructor_id = auth.uid() 
      OR 'instructor' = ANY(get_user_roles(auth.uid()))
      OR 'admin' = ANY(get_user_roles(auth.uid()))
    )
  )
);

-- Create RLS policies for question_bank_questions
CREATE POLICY "Question bank questions follow bank access" ON public.question_bank_questions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM question_banks qb
    JOIN courses c ON qb.course_id = c.id
    WHERE qb.id = question_bank_questions.question_bank_id 
    AND (
      c.instructor_id = auth.uid() 
      OR 'instructor' = ANY(get_user_roles(auth.uid()))
      OR 'admin' = ANY(get_user_roles(auth.uid()))
    )
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rubrics_course_id ON public.rubrics(course_id);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric_id ON public.rubric_criteria(rubric_id);
CREATE INDEX IF NOT EXISTS idx_assignment_rubrics_assignment_id ON public.assignment_rubrics(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_rubrics_rubric_id ON public.assignment_rubrics(rubric_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_course_id ON public.question_banks(course_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_questions_bank_id ON public.question_bank_questions(question_bank_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rubrics_updated_at
  BEFORE UPDATE ON public.rubrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_question_banks_updated_at
  BEFORE UPDATE ON public.question_banks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_question_bank_questions_updated_at
  BEFORE UPDATE ON public.question_bank_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();