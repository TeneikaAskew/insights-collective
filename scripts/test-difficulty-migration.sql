-- Test script for difficulty and hours migration
-- Run this after applying the migration to verify it worked correctly

-- Test 1: Verify columns exist
DO $$
DECLARE
  v_difficulty_exists BOOLEAN;
  v_hours_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'difficulty_level'
  ) INTO v_difficulty_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'estimated_hours'
  ) INTO v_hours_exists;

  IF v_difficulty_exists AND v_hours_exists THEN
    RAISE NOTICE '✓ Test 1 PASSED: Both columns exist';
  ELSE
    RAISE EXCEPTION '✗ Test 1 FAILED: Columns missing. difficulty: %, hours: %',
      v_difficulty_exists, v_hours_exists;
  END IF;
END $$;

-- Test 2: Verify ENUM type created
DO $$
DECLARE
  v_enum_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_enum_count
  FROM pg_enum
  WHERE enumtypid = 'course_difficulty'::regtype;

  IF v_enum_count = 3 THEN
    RAISE NOTICE '✓ Test 2 PASSED: ENUM type has 3 values (beginner, intermediate, advanced)';
  ELSE
    RAISE EXCEPTION '✗ Test 2 FAILED: ENUM has % values, expected 3', v_enum_count;
  END IF;
END $$;

-- Test 3: Verify data migration completed
DO $$
DECLARE
  v_total_courses INTEGER;
  v_with_difficulty INTEGER;
  v_with_hours INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_courses FROM courses;

  SELECT COUNT(*) INTO v_with_difficulty
  FROM courses WHERE difficulty_level IS NOT NULL;

  SELECT COUNT(*) INTO v_with_hours
  FROM courses WHERE estimated_hours IS NOT NULL;

  RAISE NOTICE 'Test 3 Results:';
  RAISE NOTICE '  Total courses: %', v_total_courses;
  RAISE NOTICE '  With difficulty: %', v_with_difficulty;
  RAISE NOTICE '  With hours: %', v_with_hours;

  IF v_total_courses = 0 THEN
    RAISE NOTICE '⚠ No courses in database - data migration cannot be tested';
  ELSIF v_with_difficulty = v_total_courses AND v_with_hours = v_total_courses THEN
    RAISE NOTICE '✓ Test 3 PASSED: All courses have difficulty and hours';
  ELSE
    RAISE WARNING '✗ Test 3 PARTIAL: Some courses missing data';
  END IF;
END $$;

-- Test 4: Verify indexes created
DO $$
DECLARE
  v_difficulty_index_exists BOOLEAN;
  v_hours_index_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_courses_difficulty_level'
  ) INTO v_difficulty_index_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_courses_estimated_hours'
  ) INTO v_hours_index_exists;

  IF v_difficulty_index_exists AND v_hours_index_exists THEN
    RAISE NOTICE '✓ Test 4 PASSED: Both indexes created';
  ELSE
    RAISE EXCEPTION '✗ Test 4 FAILED: Indexes missing. difficulty_index: %, hours_index: %',
      v_difficulty_index_exists, v_hours_index_exists;
  END IF;
END $$;

-- Test 5: Verify functions exist
DO $$
DECLARE
  v_calc_difficulty_exists BOOLEAN;
  v_calc_hours_exists BOOLEAN;
  v_get_by_difficulty_exists BOOLEAN;
  v_refresh_estimates_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'calculate_course_difficulty'
  ) INTO v_calc_difficulty_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'calculate_course_hours'
  ) INTO v_calc_hours_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_courses_by_difficulty'
  ) INTO v_get_by_difficulty_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'refresh_course_estimates'
  ) INTO v_refresh_estimates_exists;

  IF v_calc_difficulty_exists AND v_calc_hours_exists AND
     v_get_by_difficulty_exists AND v_refresh_estimates_exists THEN
    RAISE NOTICE '✓ Test 5 PASSED: All functions created';
  ELSE
    RAISE EXCEPTION '✗ Test 5 FAILED: Functions missing. calc_diff: %, calc_hours: %, get_by_diff: %, refresh: %',
      v_calc_difficulty_exists, v_calc_hours_exists,
      v_get_by_difficulty_exists, v_refresh_estimates_exists;
  END IF;
END $$;

-- Test 6: Verify triggers exist
DO $$
DECLARE
  v_module_trigger_exists BOOLEAN;
  v_assignment_trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_refresh_course_estimates_on_module'
  ) INTO v_module_trigger_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_refresh_course_estimates_on_assignment'
  ) INTO v_assignment_trigger_exists;

  IF v_module_trigger_exists AND v_assignment_trigger_exists THEN
    RAISE NOTICE '✓ Test 6 PASSED: Both triggers created';
  ELSE
    RAISE EXCEPTION '✗ Test 6 FAILED: Triggers missing. module_trigger: %, assignment_trigger: %',
      v_module_trigger_exists, v_assignment_trigger_exists;
  END IF;
END $$;

-- Test 7: Verify view exists
DO $$
DECLARE
  v_view_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_views WHERE viewname = 'course_statistics'
  ) INTO v_view_exists;

  IF v_view_exists THEN
    RAISE NOTICE '✓ Test 7 PASSED: course_statistics view created';
  ELSE
    RAISE EXCEPTION '✗ Test 7 FAILED: course_statistics view missing';
  END IF;
END $$;

-- Test 8: Test difficulty calculation function
DO $$
DECLARE
  v_test_course_id UUID;
  v_calculated_difficulty course_difficulty;
BEGIN
  -- Get first course
  SELECT id INTO v_test_course_id FROM courses LIMIT 1;

  IF v_test_course_id IS NULL THEN
    RAISE NOTICE '⚠ Test 8 SKIPPED: No courses to test with';
  ELSE
    v_calculated_difficulty := calculate_course_difficulty(v_test_course_id);

    IF v_calculated_difficulty IN ('beginner', 'intermediate', 'advanced') THEN
      RAISE NOTICE '✓ Test 8 PASSED: calculate_course_difficulty returns valid value: %',
        v_calculated_difficulty;
    ELSE
      RAISE EXCEPTION '✗ Test 8 FAILED: Invalid difficulty returned: %',
        v_calculated_difficulty;
    END IF;
  END IF;
END $$;

-- Test 9: Test hours calculation function
DO $$
DECLARE
  v_test_course_id UUID;
  v_calculated_hours NUMERIC;
BEGIN
  -- Get first course
  SELECT id INTO v_test_course_id FROM courses LIMIT 1;

  IF v_test_course_id IS NULL THEN
    RAISE NOTICE '⚠ Test 9 SKIPPED: No courses to test with';
  ELSE
    v_calculated_hours := calculate_course_hours(v_test_course_id);

    IF v_calculated_hours >= 0 THEN
      RAISE NOTICE '✓ Test 9 PASSED: calculate_course_hours returns valid value: %',
        v_calculated_hours;
    ELSE
      RAISE EXCEPTION '✗ Test 9 FAILED: Invalid hours returned: %',
        v_calculated_hours;
    END IF;
  END IF;
END $$;

-- Test 10: Test get_courses_by_difficulty function
DO $$
DECLARE
  v_beginner_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_beginner_count
  FROM get_courses_by_difficulty('beginner');

  RAISE NOTICE '✓ Test 10 PASSED: get_courses_by_difficulty works. Found % beginner courses',
    v_beginner_count;
END $$;

-- Test 11: Display difficulty distribution
SELECT
  difficulty_level,
  COUNT(*) as count,
  ROUND(AVG(estimated_hours), 2) as avg_hours,
  MIN(estimated_hours) as min_hours,
  MAX(estimated_hours) as max_hours
FROM courses
GROUP BY difficulty_level
ORDER BY
  CASE difficulty_level
    WHEN 'beginner' THEN 1
    WHEN 'intermediate' THEN 2
    WHEN 'advanced' THEN 3
  END;

-- Test 12: Sample course statistics view
SELECT * FROM course_statistics LIMIT 5;

-- Summary
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Test Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All critical tests completed.';
  RAISE NOTICE 'Review the output above for any failures or warnings.';
  RAISE NOTICE '========================================';
END $$;
