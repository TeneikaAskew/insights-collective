-- ABOUTME: Removes a second, redundant set of staff SELECT/DELETE policies on certificates.
-- ABOUTME: Two branches fixed the same bug independently and both sets were applied.
--
-- Background
-- ----------
-- The admin Certificates tab could not list certificates and its Revoke button
-- deleted nothing while reporting success — a DELETE that RLS filters to zero
-- rows still answers 204. Two branches diagnosed that separately and each added
-- staff policies, so the live table ended up carrying both:
--
--   SELECT  "Admins and instructors can view certificates"          (20260731000100)
--   SELECT  "Course staff can view certificates for their courses"  (this branch)
--   DELETE  "Admins and instructors can revoke certificates"        (20260731000100)
--   DELETE  "Course staff can revoke certificates for their courses" (this branch)
--
-- Duplicate permissive policies are OR-ed, so the effective grant is the union.
-- That is not a security hole, but it is two definitions of one rule: a future
-- tightening of either would appear to have no effect, because the other still
-- permits the row. One rule, one place.
--
-- Keeping 20260731000100's pair and dropping this branch's. The two differ:
-- mine resolved instructors through can_manage_course_content() (which also
-- honors the course_instructors table), theirs matches courses.instructor_id
-- directly, consistent with how certificates are issued. Converging on theirs
-- narrows co-instructor access slightly; that is the intended, reviewable
-- semantics rather than an accident of whichever policy happened to match.
--
-- The INSERT policy from 20260801000200 is deliberately NOT dropped. Checking
-- the live catalog rather than trusting the comment in 20260731000100 showed
-- the "Instructors can issue certificates" policy it refers to does not exist —
-- "Course staff can issue certificates for their courses" is the only path by
-- which staff can issue at all, and the e2e revoke spec depends on it to create
-- its own disposable certificate instead of consuming a real member's.

DROP POLICY IF EXISTS "Course staff can view certificates for their courses"   ON public.certificates;
DROP POLICY IF EXISTS "Course staff can revoke certificates for their courses" ON public.certificates;

-- Fail loudly if the surviving policies are not the ones we expect, rather than
-- leaving the table with no staff read path at all.
DO $$
DECLARE
  v_select integer;
  v_delete integer;
  v_insert integer;
BEGIN
  SELECT count(*) INTO v_select FROM pg_policy
   WHERE polrelid = 'public.certificates'::regclass AND polcmd = 'r'
     AND polname = 'Admins and instructors can view certificates';
  SELECT count(*) INTO v_delete FROM pg_policy
   WHERE polrelid = 'public.certificates'::regclass AND polcmd = 'd'
     AND polname = 'Admins and instructors can revoke certificates';
  SELECT count(*) INTO v_insert FROM pg_policy
   WHERE polrelid = 'public.certificates'::regclass AND polcmd = 'a'
     AND polname = 'Course staff can issue certificates for their courses';

  IF v_select = 0 OR v_delete = 0 THEN
    RAISE EXCEPTION
      'certificates lost its staff read/revoke path (select=%, delete=%) — 20260731000100 must be applied first',
      v_select, v_delete;
  END IF;
  IF v_insert = 0 THEN
    RAISE EXCEPTION 'certificates lost its staff issue path — 20260801000200 must be applied first';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
