-- Reconstructed for repo/prod parity from schema_migrations.statements.
-- Applied directly to the hosted project (version 20260725101444); backfilled so a
-- fresh db build reproduces prod. Already recorded on prod, so db push skips it.

-- submission_attachments was defined in the never-fully-applied
-- 20250716000000-canvas-style-content-system.sql; the live app
-- (CanvasAssignmentSubmission) inserts into it on every file-upload
-- submission, and every insert has been failing.
CREATE TABLE IF NOT EXISTS public.submission_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT,
  size INTEGER,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission_id
  ON public.submission_attachments (submission_id);

ALTER TABLE public.submission_attachments ENABLE ROW LEVEL SECURITY;

-- Students manage attachments on their own submissions; instructors/admins
-- read via the same access function assignment_submissions already uses.
CREATE POLICY "Students can add attachments to their own submissions"
ON public.submission_attachments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assignment_submissions s
    WHERE s.id = submission_attachments.submission_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view attachments on accessible submissions"
ON public.submission_attachments FOR SELECT
USING (public.can_access_submission(auth.uid(), submission_id));

CREATE POLICY "Students can delete attachments on their own submissions"
ON public.submission_attachments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.assignment_submissions s
    WHERE s.id = submission_attachments.submission_id AND s.user_id = auth.uid()
  )
);
