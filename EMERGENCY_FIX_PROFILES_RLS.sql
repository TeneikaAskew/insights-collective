-- =============================================
-- EMERGENCY FIX: Remove Infinite Recursion in Profiles Policies
-- =============================================
-- Run this in Supabase Dashboard SQL Editor IMMEDIATELY
-- This will fix the infinite recursion errors

-- STEP 1: Drop ALL existing policies on profiles table
-- This immediately stops the infinite recursion
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "View instructor profiles in enrolled courses" ON public.profiles;
DROP POLICY IF EXISTS "Instructors view student profiles" ON public.profiles;
DROP POLICY IF EXISTS "View conversation participant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles v2" ON public.profiles;
DROP POLICY IF EXISTS "Course members view each other" ON public.profiles;
DROP POLICY IF EXISTS "Conversation members view each other" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- STEP 2: Drop the problematic user_roles table and functions if they exist
DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_roles_new(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_user_roles(UUID, TEXT[]) CASCADE;
DROP FUNCTION IF EXISTS public.get_all_users_with_roles() CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- STEP 3: Create simple, working SELECT policies
-- These do NOT cause recursion because they query profiles.roles directly

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Users can view profiles of people in the same courses
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

-- Policy 3: Users can view profiles of conversation participants
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

-- Policy 4: Admins can view all profiles
-- CRITICAL: This queries profiles.roles DIRECTLY - no recursion!
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  'admin' = ANY(
    (SELECT roles FROM public.profiles WHERE id = auth.uid())
  )
);

-- STEP 4: Create UPDATE and INSERT policies
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

-- STEP 5: Verify the fix worked
-- Run this query to see all policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- You should see 6 policies with NO references to has_role() function
