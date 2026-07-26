-- Admins cannot see or revoke a single certificate, and the UI says otherwise.
--
-- public.certificates carries exactly two policies, both scoped to the row's
-- owner:
--
--   SELECT  USING (auth.uid() = user_id)
--   DELETE  USING (auth.uid() = user_id)
--
-- /admin/courses renders a Certificates tab (AdminCourses.tsx, CertificatesTab)
-- that lists every certificate and offers a Revoke action. Under those policies
-- an admin's list only ever contains their own certificates — normally none —
-- and "Revoke" on somebody else's row deletes nothing: PostgREST answers 204
-- because RLS filtered the row out, so the client's error check passes, the row
-- is removed optimistically, and the admin is told "Certificate revoked."
-- Nothing was revoked. For a credential-invalidation action, silently doing
-- nothing while reporting success is the worst possible outcome.
--
-- The same gap makes a course with issued certificates undeletable by anyone:
-- certificates_course_id_fkey still sees the hidden rows, so DELETE on the
-- course fails with 23503 while every attempt to clear the certificates first
-- reports 204. That is why the e2e harness's leaked "Smoke Course" sweep has
-- been reporting success for runs on end without removing a single row.
--
-- Grant the staff who already administer courses the access the UI assumes:
--   • admins            — every certificate (has_admin_access)
--   • course owners     — certificates for courses they manage
-- Students keep their existing owner-scoped access, unchanged. Public
-- verification is untouched: verify-certificate runs as the service role.

-- Reads: staff can list certificates for the courses they administer.
CREATE POLICY "Course staff can view certificates for their courses"
  ON public.certificates
  FOR SELECT
  TO authenticated
  USING (
    public.has_admin_access(auth.uid())
    OR public.can_manage_course_content(auth.uid(), course_id)
  );

-- Revocation: the destructive half of the same responsibility.
CREATE POLICY "Course staff can revoke certificates for their courses"
  ON public.certificates
  FOR DELETE
  TO authenticated
  USING (
    public.has_admin_access(auth.uid())
    OR public.can_manage_course_content(auth.uid(), course_id)
  );

COMMENT ON TABLE public.certificates IS
  'Issued course certificates. Students read and delete their own; admins and course owners read and revoke any certificate for courses they administer (the /admin/courses Certificates tab). Public verification goes through the verify-certificate edge function under the service role.';
