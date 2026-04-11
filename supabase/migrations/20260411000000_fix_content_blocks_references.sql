-- Migration: Fix functions that still reference the dropped content_blocks table
-- Date: 2026-04-11
--
-- Background:
-- `20251005194518_*_remove_legacy_content_blocks` dropped public.content_blocks.
-- `20251005200000_add_course_difficulty_and_hours.sql` (which runs alphabetically
-- AFTER the drop) defined calculate_course_difficulty() and calculate_course_hours()
-- that still JOIN against content_blocks. On databases where the drop ran first,
-- those functions fail at runtime (e.g. when the module trigger fires), and on
-- fresh databases the original migration can't even apply.
--
-- This migration is idempotent and rewrites both functions to use the new
-- content_items table instead. It also reloads the PostgREST schema cache so
-- embeds like modules → content_items resolve without waiting for a restart.

-- ---------------------------------------------------------------------------
-- 1. Rewrite calculate_course_difficulty to use content_items
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_course_difficulty(course_id_param UUID)
RETURNS course_difficulty
LANGUAGE plpgsql
AS $$
DECLARE
  v_module_count INTEGER;
  v_assignment_count INTEGER;
  v_quiz_count INTEGER;
  v_content_item_count INTEGER;
  v_total_complexity INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_module_count
  FROM modules
  WHERE course_id = course_id_param;

  SELECT COUNT(*) INTO v_assignment_count
  FROM assignments
  WHERE course_id = course_id_param;

  SELECT COUNT(DISTINCT q.id) INTO v_quiz_count
  FROM quizzes q
  JOIN content_items ci ON q.content_item_id = ci.id
  WHERE ci.course_id = course_id_param;

  SELECT COUNT(*) INTO v_content_item_count
  FROM content_items
  WHERE course_id = course_id_param;

  v_total_complexity :=
    (v_module_count * 5) +
    (v_assignment_count * 10) +
    (v_quiz_count * 8) +
    (v_content_item_count * 2);

  IF v_total_complexity < 50 THEN
    RETURN 'beginner';
  ELSIF v_total_complexity < 150 THEN
    RETURN 'intermediate';
  ELSE
    RETURN 'advanced';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.calculate_course_difficulty IS
  'Calculates course difficulty from module/assignment/quiz/content_item counts';

-- ---------------------------------------------------------------------------
-- 2. Rewrite calculate_course_hours to use content_items
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_course_hours(course_id_param UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_minutes NUMERIC := 0;
  v_lesson_minutes NUMERIC := 0;
  v_assignment_count INTEGER := 0;
  v_quiz_count INTEGER := 0;
  v_content_item_count INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(COALESCE(estimated_duration, 30)), 0)
    INTO v_lesson_minutes
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = course_id_param;

  v_total_minutes := v_total_minutes + v_lesson_minutes;

  SELECT COUNT(*) INTO v_assignment_count
  FROM assignments
  WHERE course_id = course_id_param;

  v_total_minutes := v_total_minutes + (v_assignment_count * 60);

  SELECT COUNT(DISTINCT q.id) INTO v_quiz_count
  FROM quizzes q
  JOIN content_items ci ON q.content_item_id = ci.id
  WHERE ci.course_id = course_id_param;

  v_total_minutes := v_total_minutes + (v_quiz_count * 30);

  SELECT COUNT(*) INTO v_content_item_count
  FROM content_items
  WHERE course_id = course_id_param
    AND type IN ('page', 'external_url', 'external_tool');

  v_total_minutes := v_total_minutes + (v_content_item_count * 15);

  IF v_total_minutes = 0 THEN
    RETURN 1.0;
  END IF;

  RETURN ROUND(v_total_minutes / 60.0, 2);
END;
$$;

COMMENT ON FUNCTION public.calculate_course_hours IS
  'Estimates total course hours from lessons, assignments, quizzes, and content items';

-- ---------------------------------------------------------------------------
-- 3. Ensure the content_items → modules foreign key exists so PostgREST can
--    resolve modules → content_items embeds from the client.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'content_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'content_items'
      AND constraint_name = 'content_items_module_id_fkey'
  ) THEN
    ALTER TABLE public.content_items
      ADD CONSTRAINT content_items_module_id_fkey
      FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Reload the PostgREST schema cache so the fixed relationship is picked up
--    without waiting for a Supabase restart.
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
