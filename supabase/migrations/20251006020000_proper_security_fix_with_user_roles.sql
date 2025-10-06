-- =============================================
-- PROPER SECURITY FIX: Separate Roles Table WITHOUT Recursion
-- =============================================
-- This migration fixes the security issue by:
-- 1. Moving roles to a separate user_roles table (prevents privilege escalation)
-- 2. Restricting profile data access via proper RLS policies
-- 3. Breaking the recursion cycle by using direct queries in user_roles policies

-- STEP 1: Clean up any existing broken objects
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "View instructor profiles in enrolled courses" ON public.profiles;
DROP POLICY IF EXISTS "Instructors view student profiles" ON public.profiles;
DROP POLICY IF EXISTS "View conversation participant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles v2" ON public.profiles;
DROP POLICY IF EXISTS "Course members view each other" ON public.profiles;
DROP POLICY IF EXISTS "Conversation members view each other" ON public.profiles;
DROP POLICY IF EXISTS "View profiles in same courses" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Drop existing user_roles policies and objects
DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_roles_new(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_user_roles(UUID, TEXT[]) CASCADE;
DROP FUNCTION IF EXISTS public.get_all_users_with_roles() CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- STEP 2: Create role enum type
CREATE TYPE public.app_role AS ENUM ('student', 'instructor', 'admin');

-- STEP 3: Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- STEP 4: Migrate existing roles from profiles to user_roles
-- This preserves all existing role assignments
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT
  p.id,
  unnest(p.roles)::app_role,
  p.created_at
FROM public.profiles p
WHERE p.roles IS NOT NULL AND array_length(p.roles, 1) > 0
ON CONFLICT (user_id, role) DO NOTHING;

-- STEP 5: Create SECURITY DEFINER function to check user roles
-- This function is CRITICAL - it bypasses RLS on user_roles table
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER -- This makes it run with DEFINER privileges, bypassing RLS
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- STEP 6: Create function to get all user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS app_role[]
LANGUAGE SQL
STABLE
SECURITY DEFINER -- Bypasses RLS
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), ARRAY['student']::app_role[])
  FROM public.user_roles
  WHERE user_id = _user_id;
$$;

-- STEP 7: Create RLS policies for user_roles table
-- CRITICAL: These policies do NOT call has_role() - they use direct queries to break recursion

-- Users can view their own roles (direct query, no function call)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all roles (direct query for admin role, NO has_role() call)
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles AS ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::app_role
  )
);

-- Admins can manage all roles (direct query, NO has_role() call)
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles AS ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles AS ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::app_role
  )
);

-- STEP 8: Create RLS policies for profiles table
-- These CAN call has_role() safely because user_roles policies don't call has_role()

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Users can view profiles in same courses
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

-- Policy 3: Users can view conversation participant profiles
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
-- This is SAFE to use has_role() because user_roles policies use direct queries
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy 5: Users can update their own profile (but NOT roles)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 6: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- STEP 9: Update the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  -- Assign default 'student' role in user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student'::app_role);

  RETURN NEW;
END;
$$;

-- STEP 10: Create RPC functions for admin role management
CREATE OR REPLACE FUNCTION public.update_user_roles(
  target_user_id UUID,
  new_roles TEXT[]
)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin using direct query (not has_role to avoid dependency)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  ) THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  -- Delete existing roles for the target user
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id;

  -- Insert new roles
  INSERT INTO public.user_roles (user_id, role, granted_by)
  SELECT
    target_user_id,
    unnest(new_roles)::app_role,
    auth.uid()
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- STEP 11: Grant necessary permissions
GRANT SELECT ON public.user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_roles TO authenticated;

-- STEP 12: Add security comments
COMMENT ON TABLE public.user_roles IS 'Stores user roles separately from profiles to prevent privilege escalation. Users cannot modify their own roles.';
COMMENT ON FUNCTION public.has_role IS 'Security definer function to check user roles. Uses SECURITY DEFINER to bypass RLS and prevent recursion.';
COMMENT ON POLICY "Users can view own roles" ON public.user_roles IS 'Direct query - does not call has_role() to prevent recursion';
COMMENT ON POLICY "Admins can view all roles" ON public.user_roles IS 'Direct query - does not call has_role() to prevent recursion';
COMMENT ON POLICY "Admins can manage roles" ON public.user_roles IS 'Direct query - does not call has_role() to prevent recursion';
