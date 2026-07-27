-- =====================================================================
-- FIX: admins and course instructors can view and revoke certificates
-- =====================================================================
--
-- Background
-- ----------
-- certificates (20250621142527) shipped with:
--   SELECT "Users can view their own certificates" USING (auth.uid() = user_id)
--   INSERT "Instructors can issue certificates" (course instructor OR admin)
-- and 20260721143243 added:
--   DELETE "Users can delete their own certificates" USING (auth.uid() = user_id)
--
-- There is no SELECT or DELETE path for admins/instructors over OTHER users'
-- certificates. So the admin "Certificates" tab (AdminCourses) cannot list a
-- course's certificates, and "revoke" DELETE matches zero rows, returns no
-- error, and the UI reports false success while the certificate stays valid.
--
-- This adds admin + course-instructor SELECT and DELETE policies, mirroring the
-- existing issue (INSERT) policy. Admin authorization uses has_admin_access()
-- (canonical user_roles); instructor authorization matches the course's
-- instructor_id, consistent with "Instructors can issue certificates".

-- Admins and the course instructor can view a course's certificates.
CREATE POLICY "Admins and instructors can view certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (
    public.has_admin_access(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = certificates.course_id
        AND c.instructor_id = auth.uid()
    )
  );

-- Admins and the course instructor can revoke (delete) a certificate.
CREATE POLICY "Admins and instructors can revoke certificates"
  ON public.certificates FOR DELETE
  TO authenticated
  USING (
    public.has_admin_access(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = certificates.course_id
        AND c.instructor_id = auth.uid()
    )
  );
