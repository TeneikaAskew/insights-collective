-- =============================================
-- COMPREHENSIVE SCHEMA ANALYSIS
-- =============================================
-- This checks for all potential issues in the courses feature

-- 1. Check all RLS policies on course-related tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'courses', 'modules', 'content_items', 'enrollments',
    'assignments', 'quizzes', 'quiz_questions', 'assignment_submissions',
    'profiles', 'user_roles'
  )
ORDER BY tablename, policyname;

-- 2. Check all foreign key relationships
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
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'courses', 'modules', 'content_items', 'enrollments',
    'assignments', 'quizzes', 'quiz_questions', 'assignment_submissions'
  )
ORDER BY tc.table_name, kcu.column_name;

-- 3. Check all UNIQUE constraints
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'u'
  AND connamespace = 'public'::regnamespace
  AND conrelid::regclass::text IN (
    'assignments', 'quizzes', 'content_items', 'modules'
  )
ORDER BY conrelid::regclass::text;

-- 4. Check for SECURITY DEFINER functions
SELECT
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_functiondef(p.oid) AS definition,
  CASE
    WHEN prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END AS security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%can_%'
ORDER BY p.proname;

-- 5. Check table structures for content_items, assignments, quizzes
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('content_items', 'assignments', 'quizzes')
ORDER BY table_name, ordinal_position;

-- 6. Check for NULL values in critical FK columns
SELECT
  'assignments' AS table_name,
  COUNT(*) FILTER (WHERE content_item_id IS NULL) AS null_content_item_id,
  COUNT(*) FILTER (WHERE course_id IS NULL) AS null_course_id,
  COUNT(*) AS total
FROM assignments
UNION ALL
SELECT
  'quizzes' AS table_name,
  COUNT(*) FILTER (WHERE content_item_id IS NULL) AS null_content_item_id,
  NULL AS null_course_id,
  COUNT(*) AS total
FROM quizzes
UNION ALL
SELECT
  'content_items' AS table_name,
  NULL AS null_content_item_id,
  COUNT(*) FILTER (WHERE course_id IS NULL) AS null_course_id,
  COUNT(*) AS total
FROM content_items;

-- 7. Check if content_items have proper 'type' field
SELECT
  type,
  COUNT(*) AS count
FROM content_items
GROUP BY type
ORDER BY count DESC;

-- 8. Verify RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'courses', 'modules', 'content_items', 'enrollments',
    'assignments', 'quizzes', 'quiz_questions', 'assignment_submissions',
    'profiles', 'user_roles'
  )
ORDER BY tablename;
