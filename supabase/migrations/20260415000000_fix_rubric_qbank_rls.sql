-- Fix RLS policies for rubrics, rubric_criteria, question_banks, and related tables.
-- The older migrations referenced non-existent tables (course_assignments, course_enrollments)
-- instead of the real ones (enrollments, courses.instructor_id, profiles.roles).

-- ─── RUBRICS ────────────────────────────────────────────────────────────────

ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies
DROP POLICY IF EXISTS "Instructors can manage rubrics in their courses" ON public.rubrics;
DROP POLICY IF EXISTS "Students can view rubrics for their courses" ON public.rubrics;

-- Course instructor or admin: full access
CREATE POLICY "Instructors can manage rubrics"
  ON public.rubrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = rubrics.course_id
        AND courses.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND 'admin' = ANY(profiles.roles)
    )
  );

-- Enrolled students: read
CREATE POLICY "Students can view rubrics"
  ON public.rubrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = rubrics.course_id
        AND enrollments.user_id = auth.uid()
    )
  );

-- ─── RUBRIC CRITERIA ────────────────────────────────────────────────────────

ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can manage rubric criteria" ON public.rubric_criteria;
DROP POLICY IF EXISTS "Students can view rubric criteria" ON public.rubric_criteria;

CREATE POLICY "Instructors can manage rubric criteria"
  ON public.rubric_criteria FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rubrics r
      JOIN public.courses c ON c.id = r.course_id
      WHERE r.id = rubric_criteria.rubric_id
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND 'admin' = ANY(profiles.roles)
          )
        )
    )
  );

CREATE POLICY "Students can view rubric criteria"
  ON public.rubric_criteria FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rubrics r
      JOIN public.enrollments e ON e.course_id = r.course_id
      WHERE r.id = rubric_criteria.rubric_id
        AND e.user_id = auth.uid()
    )
  );

-- ─── ASSIGNMENT RUBRICS JUNCTION ────────────────────────────────────────────

ALTER TABLE public.assignment_rubrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can manage assignment rubrics" ON public.assignment_rubrics;

CREATE POLICY "Instructors can manage assignment rubrics"
  ON public.assignment_rubrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rubrics r
      JOIN public.courses c ON c.id = r.course_id
      WHERE r.id = assignment_rubrics.rubric_id
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND 'admin' = ANY(profiles.roles)
          )
        )
    )
  );

-- ─── QUESTION BANKS ─────────────────────────────────────────────────────────

ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;

-- Drop old broken policies
DROP POLICY IF EXISTS "Instructors can manage their course question banks" ON public.question_banks;
DROP POLICY IF EXISTS "Students can view question banks for their courses" ON public.question_banks;

CREATE POLICY "Instructors can manage question banks"
  ON public.question_banks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = question_banks.course_id
        AND courses.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND 'admin' = ANY(profiles.roles)
    )
  );

CREATE POLICY "Students can view question banks"
  ON public.question_banks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = question_banks.course_id
        AND enrollments.user_id = auth.uid()
    )
  );

-- ─── QUESTION BANK QUESTIONS ─────────────────────────────────────────────────

ALTER TABLE public.question_bank_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can manage questions in their banks" ON public.question_bank_questions;
DROP POLICY IF EXISTS "Students can view questions during quiz attempts" ON public.question_bank_questions;

CREATE POLICY "Instructors can manage questions"
  ON public.question_bank_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.question_banks qb
      JOIN public.courses c ON c.id = qb.course_id
      WHERE qb.id = question_bank_questions.bank_id
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND 'admin' = ANY(profiles.roles)
          )
        )
    )
  );

-- ─── QUESTION BANK CATEGORIES ────────────────────────────────────────────────

ALTER TABLE public.question_bank_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can manage categories" ON public.question_bank_categories;

CREATE POLICY "Instructors can manage question bank categories"
  ON public.question_bank_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.question_banks qb
      JOIN public.courses c ON c.id = qb.course_id
      WHERE qb.id = question_bank_categories.bank_id
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND 'admin' = ANY(profiles.roles)
          )
        )
    )
  );

-- ─── ASSIGNMENT SUBMISSIONS — fix broken policies ───────────────────────────

-- Drop old broken policies
DROP POLICY IF EXISTS "Instructors can view all submissions in their courses" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Instructors can update submissions in their courses" ON public.assignment_submissions;

CREATE POLICY "Instructors can view submissions in their courses"
  ON public.assignment_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = assignment_submissions.assignment_id
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND 'admin' = ANY(profiles.roles)
          )
        )
    )
  );

CREATE POLICY "Instructors can update submissions"
  ON public.assignment_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = assignment_submissions.assignment_id
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND 'admin' = ANY(profiles.roles)
          )
        )
    )
  );

-- ─── GRADES — fix broken policies ──────────────────────────────────────────

DROP POLICY IF EXISTS "Instructors can manage grades in their courses" ON public.grades;

CREATE POLICY "Instructors can manage grades"
  ON public.grades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = grades.course_id
        AND courses.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND 'admin' = ANY(profiles.roles)
    )
  );
