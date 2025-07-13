-- Step 1: Clean up roles data by merging role field into roles array
-- First, update users who have admin role but don't have admin in roles array
UPDATE profiles 
SET roles = array_append(
  COALESCE(roles, ARRAY['student'::text]), 
  'admin'::text
)
WHERE role = 'admin' 
  AND (roles IS NULL OR NOT ('admin' = ANY(roles)));

-- Update users who have instructor role but don't have instructor in roles array  
UPDATE profiles 
SET roles = array_append(
  COALESCE(roles, ARRAY['student'::text]), 
  'instructor'::text
)
WHERE role = 'instructor' 
  AND (roles IS NULL OR NOT ('instructor' = ANY(roles)));

-- Ensure all users have student role if they don't have any roles
UPDATE profiles 
SET roles = ARRAY['student'::text]
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

-- Ensure all users have student role in their roles array if not already present
UPDATE profiles 
SET roles = array_append(roles, 'student'::text)
WHERE NOT ('student' = ANY(roles));

-- Step 2: Update the handle_new_user function to only use roles array
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, roles)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    ARRAY['student'::text]
  );
  RETURN NEW;
END;
$$;

-- Step 3: Update get_user_roles function to not rely on role field
CREATE OR REPLACE FUNCTION public.get_user_roles(user_id_param uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(roles, ARRAY['student'::text]) 
  FROM profiles 
  WHERE id = user_id_param;
$$;

-- Step 4: Drop the role column (this is the final step)
ALTER TABLE profiles DROP COLUMN IF EXISTS role;