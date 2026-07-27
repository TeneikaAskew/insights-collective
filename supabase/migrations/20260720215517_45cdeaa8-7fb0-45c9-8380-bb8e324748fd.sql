
-- Folders
CREATE TABLE IF NOT EXISTS public.course_material_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.course_material_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_material_folders TO authenticated;
GRANT ALL ON public.course_material_folders TO service_role;
ALTER TABLE public.course_material_folders ENABLE ROW LEVEL SECURITY;

-- Files
CREATE TABLE IF NOT EXISTS public.course_material_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.course_material_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'course-documents',
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_material_files TO authenticated;
GRANT ALL ON public.course_material_files TO service_role;
ALTER TABLE public.course_material_files ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cmf_course ON public.course_material_folders(course_id);
CREATE INDEX IF NOT EXISTS idx_cmf_parent ON public.course_material_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_cmfile_course ON public.course_material_files(course_id);
CREATE INDEX IF NOT EXISTS idx_cmfile_folder ON public.course_material_files(folder_id);

-- Helper: can this user access a given course (enrolled OR instructor OR admin)?
CREATE OR REPLACE FUNCTION public.can_access_course_materials(_user UUID, _course UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = _course AND e.user_id = _user)
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = _course AND c.instructor_id = _user)
    OR public.has_role(_user, 'admin');
$$;

-- Helper: can this user manage (upload / edit / delete) course materials?
CREATE OR REPLACE FUNCTION public.can_manage_course_materials(_user UUID, _course UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.courses c WHERE c.id = _course AND c.instructor_id = _user)
    OR public.has_role(_user, 'admin');
$$;

-- Folder policies
DROP POLICY IF EXISTS "materials_folders_select" ON public.course_material_folders;
CREATE POLICY "materials_folders_select" ON public.course_material_folders
FOR SELECT TO authenticated
USING (public.can_access_course_materials(auth.uid(), course_id));

DROP POLICY IF EXISTS "materials_folders_manage" ON public.course_material_folders;
CREATE POLICY "materials_folders_manage" ON public.course_material_folders
FOR ALL TO authenticated
USING (public.can_manage_course_materials(auth.uid(), course_id))
WITH CHECK (public.can_manage_course_materials(auth.uid(), course_id));

-- File policies
DROP POLICY IF EXISTS "materials_files_select" ON public.course_material_files;
CREATE POLICY "materials_files_select" ON public.course_material_files
FOR SELECT TO authenticated
USING (public.can_access_course_materials(auth.uid(), course_id));

DROP POLICY IF EXISTS "materials_files_manage" ON public.course_material_files;
CREATE POLICY "materials_files_manage" ON public.course_material_files
FOR ALL TO authenticated
USING (public.can_manage_course_materials(auth.uid(), course_id))
WITH CHECK (public.can_manage_course_materials(auth.uid(), course_id));

-- Storage RLS for course-documents bucket. Path convention: <course_id>/...
-- Allow enrolled users + instructors to read.
DROP POLICY IF EXISTS "course_docs_select" ON storage.objects;
CREATE POLICY "course_docs_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'course-documents'
  AND public.can_access_course_materials(
    auth.uid(),
    NULLIF(split_part(name, '/', 1), '')::uuid
  )
);

DROP POLICY IF EXISTS "course_docs_insert" ON storage.objects;
CREATE POLICY "course_docs_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-documents'
  AND public.can_manage_course_materials(
    auth.uid(),
    NULLIF(split_part(name, '/', 1), '')::uuid
  )
);

DROP POLICY IF EXISTS "course_docs_update" ON storage.objects;
CREATE POLICY "course_docs_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-documents'
  AND public.can_manage_course_materials(
    auth.uid(),
    NULLIF(split_part(name, '/', 1), '')::uuid
  )
);

DROP POLICY IF EXISTS "course_docs_delete" ON storage.objects;
CREATE POLICY "course_docs_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'course-documents'
  AND public.can_manage_course_materials(
    auth.uid(),
    NULLIF(split_part(name, '/', 1), '')::uuid
  )
);
