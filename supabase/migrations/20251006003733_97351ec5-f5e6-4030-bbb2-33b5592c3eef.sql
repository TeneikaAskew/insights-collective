-- =============================================
-- Create RPC function for admin role management
-- =============================================

-- Function to update user roles (admin only)
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
  -- Check if caller is admin
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

-- Grant execute permission to authenticated users (function will check admin status)
GRANT EXECUTE ON FUNCTION public.update_user_roles TO authenticated;

-- Function to get all users with their roles (admin only)
CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  roles TEXT[],
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if caller is admin
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.bio,
    COALESCE(
      (
        SELECT array_agg(ur.role::TEXT)
        FROM public.user_roles ur
        WHERE ur.user_id = p.id
      ),
      ARRAY['student']
    ) as roles,
    p.created_at
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  )
  ORDER BY p.created_at DESC;
$$;

-- Grant execute permission to authenticated users (function will check admin status)
GRANT EXECUTE ON FUNCTION public.get_all_users_with_roles TO authenticated;