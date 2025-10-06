-- =============================================
-- CRITICAL SECURITY FIX: Profiles Table Access Control
-- =============================================
-- This migration addresses the PUBLIC_USER_DATA security issue by:
-- 1. Moving roles to a separate table (prevents privilege escalation)
-- 2. Restricting profile data access via proper RLS policies
-- 3. Creating secure role-checking functions

-- Step 1: Create role enum type
CREATE TYPE public.app_role AS ENUM ('student', 'instructor', 'admin');

-- Step 2: Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 3: Migrate existing roles from profiles to user_roles
-- This preserves all existing role assignments
INSERT INTO public.user_roles (user_id, role, granted_at)
SELECT 
  p.id,
  unnest(p.roles)::app_role,
  p.created_at
FROM public.profiles p
WHERE p.roles IS NOT NULL AND array_length(p.roles, 1) > 0
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 4: Create security definer function to check user roles
-- This prevents recursive RLS policy issues
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Step 5: Create function to get all user roles (helper for backward compatibility)
CREATE OR REPLACE FUNCTION public.get_user_roles_new(_user_id UUID)
RETURNS app_role[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), ARRAY['student']::app_role[])
  FROM public.user_roles
  WHERE user_id = _user_id;
$$;

-- Step 6: Create index for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- Step 7: Drop old RLS policies on profiles table
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;

-- Step 8: Create new restrictive RLS policies on profiles
-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Users can view profiles of course instructors in courses they're enrolled in
CREATE POLICY "View instructor profiles in enrolled courses"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.enrollments e ON c.id = e.course_id
    WHERE e.user_id = auth.uid()
      AND c.instructor_id = profiles.id
  )
);

-- Policy 3: Users can view profiles of students in courses they instruct
CREATE POLICY "Instructors view student profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.enrollments e ON c.id = e.course_id
    WHERE (c.instructor_id = auth.uid() OR is_course_instructor(auth.uid(), c.id))
      AND e.user_id = profiles.id
  )
);

-- Policy 4: Users can view profiles of conversation participants
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

-- Policy 5: Admins can view all profiles
CREATE POLICY "Admins view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy 6: Users can update their own profile
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 7: Users can insert their own profile
CREATE POLICY "Users insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Step 9: Create RLS policies for user_roles table
-- Only admins can grant/revoke roles
CREATE POLICY "Admins manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view their own roles
CREATE POLICY "Users view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Step 10: Update the handle_new_user function to use new user_roles table
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
  
  -- Assign default 'student' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student'::app_role);
  
  RETURN NEW;
END;
$$;

-- Step 11: Add comment documenting the security fix
COMMENT ON TABLE public.user_roles IS 'Stores user roles separately from profiles to prevent privilege escalation attacks. Roles should NEVER be stored in the profiles table or auth.users metadata.';
COMMENT ON FUNCTION public.has_role IS 'Security definer function to check user roles without triggering recursive RLS policies.';

-- Step 12: Grant necessary permissions
GRANT SELECT ON public.user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles_new TO authenticated;