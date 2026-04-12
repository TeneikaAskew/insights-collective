-- Migration: Add atomic reorder RPCs for content_items and modules
-- Date: 2026-04-12
--
-- Root cause: content_items has UNIQUE (module_id, position). The client was
-- issuing individual PATCH requests in a loop, so mid-loop a position value
-- already held by another row caused a 409 Conflict from PostgREST.
--
-- Fix: Make the constraint deferrable, then provide RPC functions that defer
-- it within a single transaction so all position updates commit atomically.

-- 1. Make the unique position constraint deferrable.
--    PostgreSQL only supports ALTER CONSTRAINT for FK constraints, so we must
--    drop and recreate the unique constraint with DEFERRABLE INITIALLY IMMEDIATE.
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS unique_position_per_module;
ALTER TABLE content_items
  ADD CONSTRAINT unique_position_per_module
  UNIQUE (module_id, position)
  DEFERRABLE INITIALLY IMMEDIATE;

-- 2. Reorder content items within a module atomically
CREATE OR REPLACE FUNCTION public.reorder_content_items(
  p_module_id UUID,
  p_item_ids  UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Defer the unique constraint until the end of this transaction so
  -- intermediate position values don't trigger a violation mid-loop.
  SET CONSTRAINTS unique_position_per_module DEFERRED;

  FOR i IN 1..array_length(p_item_ids, 1) LOOP
    UPDATE content_items
    SET position = i - 1   -- 0-indexed to match client convention
    WHERE id       = p_item_ids[i]
      AND module_id = p_module_id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.reorder_content_items IS
  'Atomically reorders content_items within a module by deferring the unique position constraint.';

-- 3. Reorder modules within a course atomically
CREATE OR REPLACE FUNCTION public.reorder_modules(
  p_course_id  UUID,
  p_module_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  FOR i IN 1..array_length(p_module_ids, 1) LOOP
    UPDATE modules
    SET position = i - 1
    WHERE id        = p_module_ids[i]
      AND course_id = p_course_id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.reorder_modules IS
  'Atomically reorders modules within a course.';

-- 4. Grant execute to authenticated users (instructors/admins)
GRANT EXECUTE ON FUNCTION public.reorder_content_items(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_modules(UUID, UUID[])        TO authenticated;
