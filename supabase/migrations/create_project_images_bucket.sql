
-- Create storage bucket for project images
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true);

-- Create RLS policy for project images bucket
CREATE POLICY "Users can upload project images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view project images"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-images');

CREATE POLICY "Users can update their project images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their project images"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-images' AND auth.uid()::text = (storage.foldername(name))[1]);
