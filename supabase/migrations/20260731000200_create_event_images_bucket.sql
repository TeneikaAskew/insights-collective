-- =====================================================================
-- Storage bucket for event images
-- =====================================================================
-- The Add/Edit Event modal previously persisted a session-scoped blob: URL
-- (URL.createObjectURL) straight into events.image, so uploaded artwork broke
-- on reload and never existed for other users. This creates a public bucket
-- the modal uploads to, returning a durable public URL.
--
-- Writes are restricted to admins: only admins manage events, and the
-- admin-only route is NOT a security boundary because callers can invoke
-- Storage directly. Without this, any authenticated account (including
-- students) could upload arbitrary objects to a PUBLIC bucket using its own
-- uuid as the first path segment — free public content hosting and a storage
-- quota to burn. Uploads stay scoped to a per-user folder (auth.uid()/...) on
-- top of the admin check, mirroring the project-images convention. Reads are
-- public so event cards render for anonymous visitors. Idempotent.

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
    AND public.has_admin_access(auth.uid())
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
    AND public.has_admin_access(auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their event images" ON storage.objects;
CREATE POLICY "Users can delete their event images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.has_admin_access(auth.uid())
  );
