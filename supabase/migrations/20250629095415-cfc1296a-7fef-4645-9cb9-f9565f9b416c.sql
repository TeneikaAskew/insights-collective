-- Create enhanced security event tracking for real-time monitoring
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audit logs table for compliance tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on security tables
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create security policies (admin only access)
CREATE POLICY "Admin can view all security events"
ON security_events FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE id = auth.uid() 
  AND 'admin' = ANY(roles)
));

CREATE POLICY "Admin can view all audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE id = auth.uid() 
  AND 'admin' = ANY(roles)
));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Create function to automatically clean old security events (>6 months)
CREATE OR REPLACE FUNCTION clean_old_security_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM security_events 
  WHERE created_at < now() - interval '6 months'
  AND severity IN ('info', 'warning');
  
  DELETE FROM audit_logs 
  WHERE created_at < now() - interval '2 years';
END;
$$;