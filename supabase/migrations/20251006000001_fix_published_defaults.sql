-- Migration: Fix published status defaults for content_items
-- This fixes the issue where content shows "0 Activities" because published is NULL
-- Sets sensible defaults for backward compatibility

-- Step 1: Update existing NULL published values to true (backward compatibility)
UPDATE content_items
SET published = true
WHERE published IS NULL;

-- Step 2: Set default for future inserts
ALTER TABLE content_items
ALTER COLUMN published SET DEFAULT true;

-- Step 3: Do the same for modules
UPDATE modules
SET published = true
WHERE published IS NULL;

-- Step 4: Ensure modules default to published
ALTER TABLE modules
ALTER COLUMN published SET DEFAULT true;

-- Step 5: Add helpful comment
COMMENT ON COLUMN content_items.published IS 'Whether content is visible to students. Defaults to true for backward compatibility. Set to false to hide content while editing.';
COMMENT ON COLUMN modules.published IS 'Whether module is visible to students. Defaults to true.';

-- Step 6: Create a function to help with publishing/unpublishing
CREATE OR REPLACE FUNCTION publish_content_item(p_content_item_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE content_items
  SET published = true, updated_at = NOW()
  WHERE id = p_content_item_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION unpublish_content_item(p_content_item_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE content_items
  SET published = false, updated_at = NOW()
  WHERE id = p_content_item_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION publish_module(p_module_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE modules
  SET published = true, updated_at = NOW()
  WHERE id = p_module_id;

  -- Also publish all content items in the module
  UPDATE content_items
  SET published = true, updated_at = NOW()
  WHERE module_id = p_module_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION unpublish_module(p_module_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE modules
  SET published = false, updated_at = NOW()
  WHERE id = p_module_id;

  -- Also unpublish all content items in the module
  UPDATE content_items
  SET published = false, updated_at = NOW()
  WHERE module_id = p_module_id;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Add comments for the functions
COMMENT ON FUNCTION publish_content_item IS 'Publishes a content item, making it visible to students';
COMMENT ON FUNCTION unpublish_content_item IS 'Unpublishes a content item, hiding it from students';
COMMENT ON FUNCTION publish_module IS 'Publishes a module and all its content items';
COMMENT ON FUNCTION unpublish_module IS 'Unpublishes a module and all its content items';

-- Step 8: Verify the migration
DO $$
DECLARE
  v_null_content INTEGER;
  v_null_modules INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_content
  FROM content_items
  WHERE published IS NULL;

  SELECT COUNT(*) INTO v_null_modules
  FROM modules
  WHERE published IS NULL;

  IF v_null_content > 0 OR v_null_modules > 0 THEN
    RAISE WARNING 'Migration incomplete: % content items and % modules still have NULL published status',
      v_null_content, v_null_modules;
  ELSE
    RAISE NOTICE 'Migration successful: All content and modules have published status set';
  END IF;

  -- Show summary
  RAISE NOTICE 'Total published content items: %', (SELECT COUNT(*) FROM content_items WHERE published = true);
  RAISE NOTICE 'Total unpublished content items: %', (SELECT COUNT(*) FROM content_items WHERE published = false);
  RAISE NOTICE 'Total published modules: %', (SELECT COUNT(*) FROM modules WHERE published = true);
  RAISE NOTICE 'Total unpublished modules: %', (SELECT COUNT(*) FROM modules WHERE published = false);
END $$;
