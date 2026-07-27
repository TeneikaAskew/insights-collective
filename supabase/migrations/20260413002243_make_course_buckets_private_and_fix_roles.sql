-- Reconstructed for repo/prod parity from schema_migrations.statements.
-- This migration was applied directly to the hosted project (recorded version
-- 20260413002243, empty name). Backfilled verbatim so a fresh db build
-- reproduces prod; the version is already recorded on prod, so db push skips it.

-- 1. Make course storage buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('course-images', 'course-videos', 'course-documents');

-- Add RLS policies for enrolled users + instructors to read course storage
-- Drop any existing overly permissive policies first
DROP POLICY IF EXISTS "Public read access for course images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for course-images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "course-images public read" ON storage.objects;
DROP POLICY IF EXISTS "course-videos public read" ON storage.objects;
DROP POLICY IF EXISTS "course-documents public read" ON storage.objects;

-- Authenticated users can read course content (enrolled or instructor)
CREATE POLICY "Authenticated users can read course images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'course-images');

CREATE POLICY "Authenticated users can read course videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'course-videos');

CREATE POLICY "Authenticated users can read course documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'course-documents');

-- 2. Fix user_roles: remove "Anyone can view roles" policy
DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles;

-- Add admin policy to view all roles (uses has_role to avoid recursion)
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Fix course_statistics view - add security_invoker
ALTER VIEW public.course_statistics SET (security_invoker = on);
