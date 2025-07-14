-- Enable RLS on quizzes and quiz_questions tables and create security policies

-- Enable RLS on quizzes table
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on quiz_questions table  
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quizzes table
-- Users can view quizzes for courses they have access to
CREATE POLICY "Users can view quizzes for accessible courses" 
ON public.quizzes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM content_blocks cb
    JOIN modules m ON cb.module_id = m.id
    JOIN courses c ON m.course_id = c.id
    WHERE cb.id = quizzes.content_block_id
    AND (
      -- User is enrolled in the course
      EXISTS (
        SELECT 1 FROM enrollments e 
        WHERE e.course_id = c.id AND e.user_id = auth.uid()
      )
      -- User is the instructor
      OR c.instructor_id = auth.uid()
      -- User is assigned as instructor
      OR EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id AND ca.user_id = auth.uid() AND ca.role = 'instructor'
      )
      -- User is admin
      OR has_admin_access(auth.uid())
    )
  )
);

-- Instructors and admins can manage quizzes for their courses
CREATE POLICY "Instructors can manage quizzes for their courses" 
ON public.quizzes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM content_blocks cb
    JOIN modules m ON cb.module_id = m.id
    JOIN courses c ON m.course_id = c.id
    WHERE cb.id = quizzes.content_block_id
    AND (
      -- User is the instructor
      c.instructor_id = auth.uid()
      -- User is assigned as instructor
      OR EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id AND ca.user_id = auth.uid() AND ca.role = 'instructor'
      )
      -- User is admin
      OR has_admin_access(auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM content_blocks cb
    JOIN modules m ON cb.module_id = m.id
    JOIN courses c ON m.course_id = c.id
    WHERE cb.id = quizzes.content_block_id
    AND (
      -- User is the instructor
      c.instructor_id = auth.uid()
      -- User is assigned as instructor
      OR EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id AND ca.user_id = auth.uid() AND ca.role = 'instructor'
      )
      -- User is admin
      OR has_admin_access(auth.uid())
    )
  )
);

-- RLS Policies for quiz_questions table
-- Users can view quiz questions for quizzes they have access to
CREATE POLICY "Users can view quiz questions for accessible quizzes" 
ON public.quiz_questions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM quizzes q
    JOIN content_blocks cb ON q.content_block_id = cb.id
    JOIN modules m ON cb.module_id = m.id
    JOIN courses c ON m.course_id = c.id
    WHERE q.id = quiz_questions.quiz_id
    AND (
      -- User is enrolled in the course
      EXISTS (
        SELECT 1 FROM enrollments e 
        WHERE e.course_id = c.id AND e.user_id = auth.uid()
      )
      -- User is the instructor
      OR c.instructor_id = auth.uid()
      -- User is assigned as instructor
      OR EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id AND ca.user_id = auth.uid() AND ca.role = 'instructor'
      )
      -- User is admin
      OR has_admin_access(auth.uid())
    )
  )
);

-- Instructors and admins can manage quiz questions for their courses
CREATE POLICY "Instructors can manage quiz questions for their courses" 
ON public.quiz_questions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM quizzes q
    JOIN content_blocks cb ON q.content_block_id = cb.id
    JOIN modules m ON cb.module_id = m.id
    JOIN courses c ON m.course_id = c.id
    WHERE q.id = quiz_questions.quiz_id
    AND (
      -- User is the instructor
      c.instructor_id = auth.uid()
      -- User is assigned as instructor
      OR EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id AND ca.user_id = auth.uid() AND ca.role = 'instructor'
      )
      -- User is admin
      OR has_admin_access(auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM quizzes q
    JOIN content_blocks cb ON q.content_block_id = cb.id
    JOIN modules m ON cb.module_id = m.id
    JOIN courses c ON m.course_id = c.id
    WHERE q.id = quiz_questions.quiz_id
    AND (
      -- User is the instructor
      c.instructor_id = auth.uid()
      -- User is assigned as instructor
      OR EXISTS (
        SELECT 1 FROM course_assignments ca 
        WHERE ca.course_id = c.id AND ca.user_id = auth.uid() AND ca.role = 'instructor'
      )
      -- User is admin
      OR has_admin_access(auth.uid())
    )
  )
);