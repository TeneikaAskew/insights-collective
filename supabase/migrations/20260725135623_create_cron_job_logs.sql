-- scrape-teneika-tweets logs runs to cron_job_logs, which was never created —
-- every log write failed (silently, until the function was hardened).
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_logs_job_name_created_at
  ON public.cron_job_logs (job_name, created_at DESC);

-- Written only by service-role edge functions (which bypass RLS); readable by
-- admins for operational review. No client-facing policies.
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cron job logs"
ON public.cron_job_logs FOR SELECT
USING ('admin'::app_role = ANY (public.get_user_roles(auth.uid())));
