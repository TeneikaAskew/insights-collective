-- Staff can revoke a certificate but cannot issue one, which leaves the admin
-- Certificates tab able to destroy a credential and unable to put it back.
--
-- 20260730000100 gave admins and course owners SELECT + DELETE on
-- public.certificates so the tab's Revoke action would stop silently no-opping.
-- INSERT was left alone, so the table now has no INSERT policy at all: issuing
-- happens only through the completion trigger, under the service role.
--
-- The asymmetry is a real gap — an admin who revokes by mistake has no way to
-- restore — and it also makes the behavior untestable without collateral
-- damage: e2e/admin/admin-certificates.spec.ts had to revoke a REAL member
-- certificate, which erased the row seed.sql issues for the profile specs and
-- broke the /profile visual baseline on the next run.
--
-- Same predicate as the SELECT/DELETE policies: admins anywhere, course owners
-- for their own courses. Students still cannot mint their own certificates —
-- there is deliberately no self-issue path here.

CREATE POLICY "Course staff can issue certificates for their courses"
  ON public.certificates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_admin_access(auth.uid())
    OR public.can_manage_course_content(auth.uid(), course_id)
  );
