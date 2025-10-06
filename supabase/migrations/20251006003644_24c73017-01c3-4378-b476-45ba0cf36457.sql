-- =============================================
-- FIX: Infinite Recursion in Profiles RLS Policies
-- =============================================
-- The previous migration created policies that cause infinite recursion
-- This migration simplifies the policies to prevent that issue

-- Step 1: Drop the problematic policies
DROP POLICY IF EXISTS "View instructor profiles in enrolled courses" ON public.profiles;
DROP POLICY IF EXISTS "Instructors view student profiles" ON public.profiles;
DROP POLICY IF EXISTS "View conversation participant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;

-- Step 2: Create simpler, non-recursive policies

-- Policy: Admins can view all profiles (using the security definer function)
CREATE POLICY "Admins view all profiles v2"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
);

-- Policy: Users in same course can view each other (instructors see students, students see instructors)
-- This is simpler and doesn't cause recursion
CREATE POLICY "Course members view each other"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User can see profiles of instructors in courses they're enrolled in
  EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.enrollments e ON c.id = e.course_id
    WHERE e.user_id = auth.uid()
      AND c.instructor_id = profiles.id
  )
  OR
  -- Instructors can see profiles of students in their courses
  EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.enrollments e ON c.id = e.course_id
    WHERE c.instructor_id = auth.uid()
      AND e.user_id = profiles.id
  )
  OR
  -- Course co-instructors can see each other
  EXISTS (
    SELECT 1 FROM public.course_assignments ca1
    JOIN public.course_assignments ca2 ON ca1.course_id = ca2.course_id
    WHERE ca1.user_id = auth.uid()
      AND ca2.user_id = profiles.id
  )
);

-- Policy: Conversation participants can view each other
CREATE POLICY "Conversation members view each other"
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