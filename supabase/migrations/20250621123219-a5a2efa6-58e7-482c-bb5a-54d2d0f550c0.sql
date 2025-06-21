-- Fix search path security for SECURITY DEFINER functions

-- Update get_user_roles function with proper search path
CREATE OR REPLACE FUNCTION public.get_user_roles(user_id_param uuid)
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(roles, ARRAY['student'::text]) 
  FROM profiles 
  WHERE id = user_id_param;
$$;

-- Update has_admin_access function with proper search path
CREATE OR REPLACE FUNCTION public.has_admin_access(user_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 'admin' = ANY(public.get_user_roles(user_id_param));
$$;

-- Update is_course_instructor function with proper search path
CREATE OR REPLACE FUNCTION public.is_course_instructor(user_id_param uuid, course_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM courses 
    WHERE id = course_id_param 
    AND instructor_id = user_id_param
  ) OR EXISTS (
    SELECT 1 FROM course_assignments 
    WHERE course_id = course_id_param 
    AND user_id = user_id_param 
    AND role = 'instructor'
  ) OR 'instructor' = ANY(public.get_user_roles(user_id_param));
$$;

-- Update is_conversation_participant function with proper search path
CREATE OR REPLACE FUNCTION public.is_conversation_participant(user_id_param uuid, conversation_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = conversation_id_param 
    AND user_id = user_id_param
  );
$$;

-- Update log_audit_event function with proper search path
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id uuid,
  p_action text,
  p_table_name text,
  p_record_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (p_user_id, p_action, p_table_name, p_record_id, p_old_values, p_new_values);
END;
$$;

-- Update log_security_event function with proper search path
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id uuid,
  p_event_type text,
  p_severity text,
  p_description text,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO security_events (user_id, event_type, severity, description, metadata)
  VALUES (p_user_id, p_event_type, p_severity, p_description, p_metadata);
END;
$$;