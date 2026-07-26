-- MockInterviews' no-show reporting inserts into no_show_reports, but the
-- table was never created — every report submission has been failing.
CREATE TABLE IF NOT EXISTS public.no_show_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.mock_sessions(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_no_show_reports_session_id ON public.no_show_reports (session_id);
CREATE INDEX IF NOT EXISTS idx_no_show_reports_reported_user_id ON public.no_show_reports (reported_user_id);

ALTER TABLE public.no_show_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can file reports about their own sessions"
ON public.no_show_reports FOR INSERT
WITH CHECK (
  reporter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.mock_sessions s
    WHERE s.id = no_show_reports.session_id
      AND (s.user1_id = auth.uid() OR s.user2_id = auth.uid())
  )
);

CREATE POLICY "Reporters can view their own reports"
ON public.no_show_reports FOR SELECT
USING (reporter_id = auth.uid());

CREATE POLICY "Admins can view and manage reports"
ON public.no_show_reports FOR ALL
USING ('admin'::app_role = ANY (public.get_user_roles(auth.uid())));
