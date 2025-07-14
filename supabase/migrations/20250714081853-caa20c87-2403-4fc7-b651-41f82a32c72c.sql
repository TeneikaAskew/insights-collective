-- Complete the security fixes - simplified migration
-- Fix 1: Update handle_new_user trigger to ensure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix 2: Create security events table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'security_events') THEN
    CREATE TABLE public.security_events (
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

    ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "security_events_admin_only" 
    ON public.security_events 
    FOR ALL 
    USING (has_admin_access(auth.uid()));
  END IF;
END
$$;

-- Fix 3: Create debug token attempts table if it doesn't exist  
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'debug_token_attempts') THEN
    CREATE TABLE public.debug_token_attempts (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid,
      ip_address inet,
      attempt_time timestamp with time zone NOT NULL DEFAULT now(),
      success boolean NOT NULL DEFAULT false
    );

    ALTER TABLE public.debug_token_attempts ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "debug_token_attempts_admin_only" 
    ON public.debug_token_attempts 
    FOR ALL 
    USING (has_admin_access(auth.uid()));
  END IF;
END
$$;