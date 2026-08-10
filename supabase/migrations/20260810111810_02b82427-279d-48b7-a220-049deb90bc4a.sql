-- The course-materials storage policies cast the first path segment to uuid.
-- Student submissions live under 'submissions/<courseId>/<userId>/...', so that
-- cast raises 22P02 ("invalid input syntax for type uuid: submissions") whenever
-- Postgres evaluates the materials policy before the submissions policy — an
-- upload that should succeed fails intermittently. Guard the cast so the
-- materials policies simply do not apply to submission paths.
DROP POLICY IF EXISTS course_docs_select ON storage.objects;
DROP POLICY IF EXISTS course_docs_insert ON storage.objects;
DROP POLICY IF EXISTS course_docs_update ON storage.objects;
DROP POLICY IF EXISTS course_docs_delete ON storage.objects;

CREATE POLICY course_docs_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-documents'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.can_access_course_materials(auth.uid(), split_part(name, '/', 1)::uuid)
);

CREATE POLICY course_docs_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-documents'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.can_manage_course_materials(auth.uid(), split_part(name, '/', 1)::uuid)
);

CREATE POLICY course_docs_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-documents'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.can_manage_course_materials(auth.uid(), split_part(name, '/', 1)::uuid)
);

CREATE POLICY course_docs_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'course-documents'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.can_manage_course_materials(auth.uid(), split_part(name, '/', 1)::uuid)
);

-- Same latent cast hazard on the submissions policies: segments 2 and 3 are only
-- uuids on well-formed paths.
DROP POLICY IF EXISTS course_submission_select ON storage.objects;
DROP POLICY IF EXISTS course_submission_insert ON storage.objects;
DROP POLICY IF EXISTS course_submission_delete ON storage.objects;

CREATE POLICY course_submission_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = ANY (ARRAY['course-images','course-videos','course-documents'])
  AND split_part(name, '/', 1) = 'submissions'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    split_part(name, '/', 3)::uuid = auth.uid()
    OR public.can_manage_course_materials(auth.uid(), split_part(name, '/', 2)::uuid)
  )
);

CREATE POLICY course_submission_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = ANY (ARRAY['course-images','course-videos','course-documents'])
  AND split_part(name, '/', 1) = 'submissions'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3)::uuid = auth.uid()
  AND public.can_access_course_materials(auth.uid(), split_part(name, '/', 2)::uuid)
);

CREATE POLICY course_submission_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = ANY (ARRAY['course-images','course-videos','course-documents'])
  AND split_part(name, '/', 1) = 'submissions'
  AND split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3)::uuid = auth.uid()
);

-- Submissions are updated in place on resubmission (upsert), which the previous
-- policy set never allowed for the owning student.
DROP POLICY IF EXISTS course_submission_update ON storage.objects;
CREATE POLICY course_submission_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = ANY (ARRAY['course-images','course-videos','course-documents'])
  AND split_part(name, '/', 1) = 'submissions'
  AND split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3)::uuid = auth.uid()
)
WITH CHECK (
  bucket_id = ANY (ARRAY['course-images','course-videos','course-documents'])
  AND split_part(name, '/', 1) = 'submissions'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3)::uuid = auth.uid()
  AND public.can_access_course_materials(auth.uid(), split_part(name, '/', 2)::uuid)
);