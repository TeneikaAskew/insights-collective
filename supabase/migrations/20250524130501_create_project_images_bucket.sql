-- Create the project-images storage bucket and its policies.
--
-- Repo/prod parity: this change was applied out-of-band (the bucket's real
-- created_at on the hosted project is 2025-05-24 13:05:01 UTC, before the
-- migration system was in use), so it existed on prod with no ledger entry and
-- as an unversioned repo file. Versioned to its real creation time and made
-- idempotent so a fresh db build reproduces it; a matching ledger row is
-- recorded on prod, so db push treats it as already applied.

-- Create storage bucket for project images
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for project images bucket
DROP POLICY IF EXISTS "Users can upload project images" ON storage.objects;
CREATE POLICY "Users can upload project images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can view project images" ON storage.objects;
CREATE POLICY "Users can view project images"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-images');

DROP POLICY IF EXISTS "Users can update their project images" ON storage.objects;
CREATE POLICY "Users can update their project images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their project images" ON storage.objects;
CREATE POLICY "Users can delete their project images"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-images' AND auth.uid()::text = (storage.foldername(name))[1]);
