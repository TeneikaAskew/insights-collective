
-- Phase 1: Critical Database Security Fixes

-- Drop existing conflicting policies on courses table
DROP POLICY IF EXISTS "Public can view published courses" ON courses;
DROP POLICY IF EXISTS "Authenticated users can view all courses" ON courses;
DROP POLICY IF EXISTS "Admins can manage all courses" ON courses;
DROP POLICY IF EXISTS "Instructors can manage assigned courses" ON courses;

-- Create security definer functions to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.get_user_roles(user_id_param uuid)
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(roles, ARRAY['student'::text]) 
  FROM profiles 
  WHERE id = user_id_param;
$$;

CREATE OR REPLACE FUNCTION public.has_admin_access(user_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 'admin' = ANY(public.get_user_roles(user_id_param));
$$;

CREATE OR REPLACE FUNCTION public.is_course_instructor(user_id_param uuid, course_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
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

CREATE OR REPLACE FUNCTION public.is_conversation_participant(user_id_param uuid, conversation_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = conversation_id_param 
    AND user_id = user_id_param
  );
$$;

-- Clean up courses table policies - Replace 11 conflicting policies with 4 clean ones
CREATE POLICY "courses_public_read_published" ON courses
  FOR SELECT 
  USING (published = true);

CREATE POLICY "courses_admin_full_access" ON courses
  FOR ALL TO authenticated
  USING (public.has_admin_access(auth.uid()));

CREATE POLICY "courses_instructor_assigned_access" ON courses
  FOR ALL TO authenticated 
  USING (public.is_course_instructor(auth.uid(), id));

CREATE POLICY "courses_creator_access" ON courses
  FOR ALL TO authenticated 
  USING (instructor_id = auth.uid());

-- Fix form_submissions - Add admin override policy
CREATE POLICY "form_submissions_admin_override" ON form_submissions
  FOR SELECT TO authenticated
  USING (public.has_admin_access(auth.uid()));

-- Update message and conversation policies to use security definer functions
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Users can view their own conversation participants" ON conversation_participants;

CREATE POLICY "conversations_participant_access" ON conversations
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(auth.uid(), id));

CREATE POLICY "conversations_creator_access" ON conversations
  FOR ALL TO authenticated
  USING (created_by = auth.uid());

-- Fix messages policies using security definer function
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "messages_conversation_participant_access" ON messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "messages_sender_access" ON messages
  FOR ALL TO authenticated
  USING (sender_id = auth.uid());

-- Create audit logging tables for security monitoring
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  description text NOT NULL,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid REFERENCES auth.users(id) NOT NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id),
  target_table text,
  target_record_id uuid,
  justification text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Create policies for audit tables
CREATE POLICY "audit_logs_admin_only" ON audit_logs
  FOR SELECT TO authenticated
  USING (public.has_admin_access(auth.uid()));

CREATE POLICY "security_events_admin_only" ON security_events
  FOR SELECT TO authenticated
  USING (public.has_admin_access(auth.uid()));

CREATE POLICY "admin_actions_admin_only" ON admin_actions
  FOR ALL TO authenticated
  USING (public.has_admin_access(auth.uid()));

-- Create function to log audit events
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
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (p_user_id, p_action, p_table_name, p_record_id, p_old_values, p_new_values);
END;
$$;

-- Create function to log security events
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
AS $$
BEGIN
  INSERT INTO security_events (user_id, event_type, severity, description, metadata)
  VALUES (p_user_id, p_event_type, p_severity, p_description, p_metadata);
END;
$$;
