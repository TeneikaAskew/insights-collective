-- Fix broken RLS policy on assignment_submissions that references non-existent `student_id` column.
-- The 20250715090000 migration created this policy against student_id, but the actual
-- column in the live DB is user_id (from 20250716000000). PostgreSQL throws an error when
-- evaluating the broken policy expression at INSERT time, silently blocking all student submissions.

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Drop the broken policy (references non-existent column student_id)
DROP POLICY IF EXISTS "Students can create and update their own submissions"
  ON public.assignment_submissions;

-- Also drop any duplicate policies we're about to recreate
DROP POLICY IF EXISTS "Users can create their own assignment submissions"
  ON public.assignment_submissions;

DROP POLICY IF EXISTS "Students can view their own submissions"
  ON public.assignment_submissions;

DROP POLICY IF EXISTS "Students can submit their own assignments"
  ON public.assignment_submissions;

DROP POLICY IF EXISTS "Students can update their own submissions"
  ON public.assignment_submissions;

-- Correct INSERT: students can submit their own work
CREATE POLICY "Students can submit their own assignments"
  ON public.assignment_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Correct SELECT: students see only their own submissions
CREATE POLICY "Students can view their own submissions"
  ON public.assignment_submissions FOR SELECT
  USING (auth.uid() = user_id);

-- Correct UPDATE: students can update their own submissions (draft → submitted)
CREATE POLICY "Students can update their own submissions"
  ON public.assignment_submissions FOR UPDATE
  USING (auth.uid() = user_id);
