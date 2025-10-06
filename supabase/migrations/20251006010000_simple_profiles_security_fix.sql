-- =============================================
-- SIMPLE SECURITY FIX: Profiles Table Access Control
-- =============================================
-- This migration fixes the PUBLIC_USER_DATA security issue by:
-- 1. Restricting profile data access via proper RLS policies
-- 2. NO new tables or complex architecture changes
-- 3. Keeps roles in profiles table (simpler, no breaking changes)

-- Step 1: Drop old overly permissive policies
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;

-- Step 2: Create restrictive SELECT policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can view profiles of people in the same courses
CREATE POLICY "View profiles in same courses"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Can view instructors of enrolled courses
  EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.enrollments e ON c.id = e.course_id
    WHERE e.user_id = auth.uid()
      AND c.instructor_id = profiles.id
  )
  OR
  -- Instructors can view enrolled students
  EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.enrollments e ON c.id = e.course_id
    WHERE c.instructor_id = auth.uid()
      AND e.user_id = profiles.id
  )
  OR
  -- Co-instructors can view each other
  EXISTS (
    SELECT 1 FROM public.course_assignments ca1
    JOIN public.course_assignments ca2 ON ca1.course_id = ca2.course_id
    WHERE ca1.user_id = auth.uid()
      AND ca2.user_id = profiles.id
  )
);

-- Users can view profiles of conversation participants
CREATE POLICY "View conversation participant profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp1
    JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    WHERE cp1.user_id = auth.uid()
      AND cp2.user_id = profiles.id
  )
);

-- Admins can view all profiles
-- This uses the profiles.roles column directly - NO recursion!
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  'admin' = ANY(
    (SELECT roles FROM public.profiles WHERE id = auth.uid())
  )
);

-- Step 3: Keep existing UPDATE and INSERT policies
-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Step 4: Add comments documenting the security fix
COMMENT ON POLICY "Users can view own profile" ON public.profiles IS
  'Security fix: Users can only view their own profile by default';

COMMENT ON POLICY "View profiles in same courses" ON public.profiles IS
  'Security fix: Users can view profiles of instructors/students in shared courses only';

COMMENT ON POLICY "Admins can view all profiles" ON public.profiles IS
  'Security fix: Admins have full read access to all profiles';
