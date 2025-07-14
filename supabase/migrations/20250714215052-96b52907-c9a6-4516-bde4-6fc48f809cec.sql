-- Create assignments table
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  points INTEGER DEFAULT 100,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add course_id to quizzes table
ALTER TABLE public.quizzes 
ADD COLUMN course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE;

-- Update existing quizzes to link to courses through content_blocks
UPDATE public.quizzes 
SET course_id = (
  SELECT c.id 
  FROM courses c 
  JOIN modules m ON c.id = m.course_id 
  JOIN content_blocks cb ON m.id = cb.module_id 
  WHERE cb.id = quizzes.content_block_id
  LIMIT 1
);

-- Enable RLS on assignments table
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for assignments
CREATE POLICY "Course instructors can manage assignments"
ON public.assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.id = assignments.course_id 
    AND (
      c.instructor_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id 
        AND ca.user_id = auth.uid() 
        AND ca.role = 'instructor'
      )
      OR 'admin' = ANY(get_user_roles(auth.uid()))
    )
  )
);

CREATE POLICY "Students can view course assignments"
ON public.assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.id = assignments.course_id 
    AND (
      c.instructor_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id 
        AND ca.user_id = auth.uid()
      )
      OR 'admin' = ANY(get_user_roles(auth.uid()))
      OR EXISTS (
        SELECT 1 FROM enrollments e 
        WHERE e.course_id = c.id 
        AND e.user_id = auth.uid()
      )
    )
  )
);

-- Create updated_at trigger for assignments
CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();