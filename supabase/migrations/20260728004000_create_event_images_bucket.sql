-- =====================================================================
-- Storage bucket for event images
-- =====================================================================
-- The Add/Edit Event modal previously persisted a session-scoped blob: URL
-- (URL.createObjectURL) straight into events.image, so uploaded artwork broke
-- on reload and never existed for other users. This creates a public bucket
-- the modal uploads to, returning a durable public URL.
--
-- Upload is scoped per-user folder (auth.uid()/...), mirroring the existing
-- project-images bucket convention; reads are public so event cards render for
-- anonymous visitors. Idempotent so it is safe to re-run.

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload event images" ON storage.objects;
CREATE POLICY "Users can upload event images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Anyone can view event images" ON storage.objects;
CREATE POLICY "Anyone can view event images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-images');

DROP POLICY IF EXISTS "Users can update their event images" ON storage.objects;
CREATE POLICY "Users can update their event images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their event images" ON storage.objects;
CREATE POLICY "Users can delete their event images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
