-- PREPARED ON A BRANCH. NOT APPLIED to any hosted database. Apply only through db-migrate.yml after review.
-- Assignment analogue of 20261101000300 (local repro: scripts/local-db/tests/06_assignment_identity.sql).
-- assignment_submissions: the learner UPDATE policy ("Students can update their own submissions", USING
-- auth.uid() = user_id, no WITH CHECK) and the permissive "Users can access submissions" policy (its check looks
-- the row up by id, so it sees the pre-update owner) let an enrolled non-staff learner change assignment_id and
-- user_id of their own submission. Observed on the local snapshot: one submission moved from assignment A to B
-- (A stayed complete, B could then be completed, the course certificate issued from one submission); an
-- instructor's grade on A moved with the row to B; a submission was handed to another learner; a submission was
-- moved into a course the learner is not enrolled in.
-- A new BEFORE UPDATE trigger keeps assignment_id and user_id for API callers other than service_role, silently,
-- like pin_quiz_submission_identity and the existing grade pins. Direct database sessions without request claims
-- (migrations, owner maintenance) are unaffected.
-- No policy change, no grading or pass rule, no change to what counts as a submission, no data change, no
-- historical correction. Enrollment authorization of a direct INSERT is a separate question, not addressed here.
CREATE OR REPLACE FUNCTION public.pin_assignment_submission_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
BEGIN
  -- A submission belongs to one assignment and one learner for life. Only service_role and direct database
  -- sessions without API claims may change either column; every API caller keeps the stored identity.
  IF v_role IS NOT NULL AND v_role <> 'service_role' THEN
    NEW.assignment_id := OLD.assignment_id;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS pin_assignment_submission_identity ON public.assignment_submissions;
CREATE TRIGGER pin_assignment_submission_identity BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.pin_assignment_submission_identity();
REVOKE ALL ON FUNCTION public.pin_assignment_submission_identity() FROM PUBLIC, anon, authenticated;
