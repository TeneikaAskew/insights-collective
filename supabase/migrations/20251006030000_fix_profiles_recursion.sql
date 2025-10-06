-- =============================================
-- FIX: Remove circular RLS dependencies in profiles policies
-- =============================================

-- The problem: profiles policies query courses, but courses queries join profiles
-- This creates circular RLS evaluation leading to infinite recursion

-- STEP 1: Drop ALL current policies on profiles
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- STEP 2: Create a SECURITY DEFINER function that bypasses RLS
-- This function checks if a viewer can see a profile WITHOUT triggering RLS policies
CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id UUID, profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER -- This bypasses RLS, preventing recursion
SET search_path = public
AS $$
  SELECT
    -- Can view own profile
    viewer_id = profile_id
    OR
    -- Can view instructors of enrolled courses
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON c.id = e.course_id
      WHERE e.user_id = viewer_id
        AND c.instructor_id = profile_id
    )
    OR
    -- Instructors can view enrolled students
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON c.id = e.course_id
      WHERE c.instructor_id = viewer_id
        AND e.user_id = profile_id
    )
    OR
    -- Co-instructors can see each other
    EXISTS (
      SELECT 1 FROM public.course_assignments ca1
      JOIN public.course_assignments ca2 ON ca1.course_id = ca2.course_id
      WHERE ca1.user_id = viewer_id
        AND ca2.user_id = profile_id
    )
    OR
    -- Conversation participants can see each other
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = viewer_id
        AND cp2.user_id = profile_id
    )
    OR
    -- Admins can view all
    public.has_role(viewer_id, 'admin');
$$;

-- STEP 3: Create simple policies that use the SECURITY DEFINER function
-- These policies DON'T query other tables - they call the function which bypasses RLS

CREATE POLICY "Users can view allowed profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_view_profile(auth.uid(), id));

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- STEP 4: Grant execute permission
GRANT EXECUTE ON FUNCTION public.can_view_profile TO authenticated;

-- STEP 5: Add comment
COMMENT ON FUNCTION public.can_view_profile IS 'SECURITY DEFINER function to check profile visibility. Bypasses RLS to prevent circular dependencies when courses query joins profiles.';
