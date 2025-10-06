-- =============================================
-- FIX: Add missing foreign key from quiz_questions to quizzes
-- =============================================

-- PostgREST error: "Could not find a relationship between 'quizzes' and 'quiz_questions'"
-- This means the FK is missing from the schema cache

-- Drop existing FK if it exists (in case it has wrong name)
ALTER TABLE public.quiz_questions
DROP CONSTRAINT IF EXISTS quiz_questions_quiz_id_fkey;

-- Add the foreign key relationship
ALTER TABLE public.quiz_questions
ADD CONSTRAINT quiz_questions_quiz_id_fkey
FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);

-- Verify the FK was created
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'quiz_questions'
  AND kcu.column_name = 'quiz_id';
