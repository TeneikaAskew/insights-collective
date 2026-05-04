-- ABOUTME: Backfill any remaining legacy content_blocks and lessons rows into the canonical content_items table.
-- ABOUTME: Idempotent INSERTs only. DROP statements live in a follow-up migration run after row-count verification.

BEGIN;

-- 1) Backfill content_blocks -> content_items -----------------------------
-- Only tables that actually exist get touched. Everything is guarded so the
-- migration is safe to run even if a legacy table was already dropped.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'content_blocks'
  ) THEN
    INSERT INTO public.content_items (
      id,
      course_id,
      module_id,
      type,
      title,
      content,
      position,
      published,
      settings,
      created_by,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      m.course_id,
      cb.module_id,
      CASE cb.block_type
        WHEN 'quiz'       THEN 'quiz'
        WHEN 'assignment' THEN 'assignment'
        ELSE 'page'
      END::text,
      COALESCE(NULLIF(cb.title, ''), 'Untitled'),
      COALESCE(cb.content, ''),
      cb.position,
      true,
      COALESCE(cb.metadata, '{}'::jsonb),
      cb.created_by,
      cb.created_at,
      cb.updated_at
    FROM public.content_blocks cb
    JOIN public.modules m ON m.id = cb.module_id
    WHERE NOT EXISTS (
      -- Skip rows that already appear to be represented in content_items
      SELECT 1
      FROM public.content_items ci
      WHERE ci.module_id = cb.module_id
        AND ci.position  = cb.position
        AND COALESCE(ci.title, '') = COALESCE(cb.title, 'Untitled')
    );

    RAISE NOTICE 'Backfilled legacy content_blocks into content_items';
  ELSE
    RAISE NOTICE 'content_blocks table not present; skipping backfill';
  END IF;
END $$;

-- 2) Backfill lessons -> content_items (as 'page') -------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lessons'
  ) THEN
    INSERT INTO public.content_items (
      id,
      course_id,
      module_id,
      type,
      title,
      content,
      position,
      published,
      settings,
      created_by,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      m.course_id,
      l.module_id,
      'page'::text,
      COALESCE(NULLIF(l.title, ''), 'Untitled lesson'),
      COALESCE(l.content, ''),
      COALESCE(l.order_num, 0),
      true,
      '{}'::jsonb,
      m.instructor_id,
      l.created_at,
      l.updated_at
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    LEFT JOIN public.courses c ON c.id = m.course_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.content_items ci
      WHERE ci.module_id = l.module_id
        AND COALESCE(ci.title, '') = COALESCE(l.title, 'Untitled lesson')
    );

    RAISE NOTICE 'Backfilled legacy lessons into content_items';
  ELSE
    RAISE NOTICE 'lessons table not present; skipping backfill';
  END IF;
END $$;

-- 3) Backfill lesson_completions -> content_item_progressions --------------
-- Maps each completed lesson to the content_item we just created for it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lesson_completions'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lessons'
  ) THEN
    INSERT INTO public.content_item_progressions (
      id,
      user_id,
      content_item_id,
      workflow_state,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      lc.student_id,
      ci.id,
      'completed'::text,
      lc.completed_at,
      lc.completed_at
    FROM public.lesson_completions lc
    JOIN public.lessons l ON l.id = lc.lesson_id
    JOIN public.content_items ci
      ON ci.module_id = l.module_id
     AND COALESCE(ci.title, '') = COALESCE(l.title, 'Untitled lesson')
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.content_item_progressions existing
      WHERE existing.user_id = lc.student_id
        AND existing.content_item_id = ci.id
    );

    RAISE NOTICE 'Backfilled lesson_completions into content_item_progressions';
  ELSE
    RAISE NOTICE 'lesson_completions / lessons not both present; skipping progression backfill';
  END IF;
END $$;

-- NOTE: DROP statements for content_blocks, lessons, lesson_completions, and
-- lesson_completion_requirements live in a follow-up migration to be run
-- only after the row counts above are verified in staging. That file should
-- be named <timestamp>_drop_legacy_content_tables.sql.

COMMIT;
