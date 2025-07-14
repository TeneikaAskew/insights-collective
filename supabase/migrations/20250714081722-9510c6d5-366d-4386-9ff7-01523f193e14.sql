-- Security Fix Migration: Address Critical Vulnerabilities
-- Fix 1: Prevent users from updating their own roles (Critical Role Escalation Fix)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create restrictive profile update policy that excludes roles column
CREATE POLICY "Users can update their own profile (excluding roles)" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  -- Prevent role changes by ensuring the roles array doesn't change
  roles = (SELECT roles FROM profiles WHERE id = auth.uid())
);

-- Fix 2: Create admin-only role management function
CREATE OR REPLACE FUNCTION public.update_user_roles(target_user_id uuid, new_roles text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins can update roles
  IF NOT has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required to update user roles';
  END IF;
  
  -- Ensure student role is always present
  IF NOT ('student' = ANY(new_roles)) THEN
    new_roles := array_append(new_roles, 'student');
  END IF;
  
  -- Update the user's roles
  UPDATE profiles 
  SET roles = new_roles, updated_at = now()
  WHERE id = target_user_id;
  
  -- Log the role change for audit purposes
  PERFORM log_security_event(
    auth.uid(),
    'role_update',
    'warning',
    'Admin updated user roles',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'new_roles', new_roles,
      'admin_user_id', auth.uid()
    )
  );
END;
$$;

-- Fix 3: Ensure handle_new_user trigger is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, roles)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      ARRAY['student'::text]
    );
    
    -- Log successful profile creation
    PERFORM log_security_event(
      NEW.id,
      'profile_created',
      'info',
      'User profile created successfully',
      jsonb_build_object('user_id', NEW.id)
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Log profile creation failure
    PERFORM log_security_event(
      NEW.id,
      'profile_creation_failed',
      'error',
      'Failed to create user profile: ' || SQLERRM,
      jsonb_build_object('user_id', NEW.id, 'error', SQLERRM)
    );
    
    -- Re-raise the exception to block signup if profile creation fails
    RAISE;
  END;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix 4: Create security events table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on security_events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view security events
CREATE POLICY "security_events_admin_only" 
ON public.security_events 
FOR ALL 
USING (has_admin_access(auth.uid()));

-- Fix 5: Enhanced rate limiting for debug token access
CREATE TABLE IF NOT EXISTS public.debug_token_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  ip_address inet,
  attempt_time timestamp with time zone NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

-- Enable RLS on debug_token_attempts
ALTER TABLE public.debug_token_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can view debug token attempts
CREATE POLICY "debug_token_attempts_admin_only" 
ON public.debug_token_attempts 
FOR ALL 
USING (has_admin_access(auth.uid()));

-- Fix 6: Create function to check debug token rate limits
CREATE OR REPLACE FUNCTION public.check_debug_token_rate_limit(requesting_user_id uuid, requesting_ip inet)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recent_attempts integer;
BEGIN
  -- Count attempts in the last hour
  SELECT COUNT(*) INTO recent_attempts
  FROM debug_token_attempts
  WHERE (user_id = requesting_user_id OR ip_address = requesting_ip)
    AND attempt_time > now() - interval '1 hour';
  
  -- Log this attempt
  INSERT INTO debug_token_attempts (user_id, ip_address)
  VALUES (requesting_user_id, requesting_ip);
  
  -- Allow max 5 attempts per hour
  RETURN recent_attempts < 5;
END;
$$;

-- Fix 7: Create updated_at trigger for profiles if not exists
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profiles_updated_at();