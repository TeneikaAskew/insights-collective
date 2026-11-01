-- PREPARED ON A BRANCH. NOT APPLIED to any hosted database. Apply only through db-migrate.yml after review.
-- T-09 follow-on (local repro: scripts/local-db/tests/08_target_access_and_certificate_evidence.sql).
-- 1. Target access. The own-row policies on assignment_submissions and content_item_progressions check only
--    user_id = auth.uid(), and the permissive "Users can access submissions" policy ORs in a check that never looks
--    at the target. Observed for an enrolled non-staff learner: a submission into a course they are not enrolled in
--    (which also notified that course's instructor), a submission to an unpublished item, progress on another
--    course's page and on an unpublished item, and an own progress row moved onto another course's page.
--    RESTRICTIVE policies now require, for API callers (anon, authenticated), that every inserted or updated row
--    targets something the caller can already access through the existing helpers: can_access_assignment (admin,
--    course instructor, or enrolled learner and published-or-unlinked item) and can_access_content_item (admin,
--    course instructor, or enrolled learner and published item). service_role (BYPASSRLS) and direct database
--    sessions are unaffected. Existing permissive policies, identity pins and grading pins are unchanged.
-- 2. Certificate evidence. auto_issue_certificate_on_progression counted any done row, so legacy done rows on
--    assignments or quizzes without a submission or finished attempt could complete a course and issue a NEW
--    certificate (a genuine page view or a no-op update was enough). Only the completed-item count changes: an
--    assignment or quiz item counts only with genuine evidence (a submitted submission; a complete attempt with
--    finished_at). Existing certificates and progress rows are not touched; nothing is revoked or rewritten.
-- No pass/score threshold is introduced; minimum submission remains the rule.

DROP POLICY IF EXISTS "Submission target must be accessible (insert)" ON public.assignment_submissions;
CREATE POLICY "Submission target must be accessible (insert)" ON public.assignment_submissions
  AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (public.can_access_assignment(auth.uid(), assignment_id));
DROP POLICY IF EXISTS "Submission target must be accessible (update)" ON public.assignment_submissions;
CREATE POLICY "Submission target must be accessible (update)" ON public.assignment_submissions
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (public.can_access_assignment(auth.uid(), assignment_id));

DROP POLICY IF EXISTS "Progress target must be accessible (insert)" ON public.content_item_progressions;
CREATE POLICY "Progress target must be accessible (insert)" ON public.content_item_progressions
  AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (public.can_access_content_item(auth.uid(), content_item_id));
DROP POLICY IF EXISTS "Progress target must be accessible (update)" ON public.content_item_progressions;
CREATE POLICY "Progress target must be accessible (update)" ON public.content_item_progressions
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (public.can_access_content_item(auth.uid(), content_item_id));

CREATE OR REPLACE FUNCTION public.auto_issue_certificate_on_progression()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_id uuid;
  v_total int;
  v_completed int;
  v_code text;
BEGIN
  IF NEW.workflow_state NOT IN ('read', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT m.course_id
    INTO v_course_id
    FROM public.content_items ci
    JOIN public.modules m ON m.id = ci.module_id
   WHERE ci.id = NEW.content_item_id;

  IF v_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if a certificate already exists for this user/course
  IF EXISTS (
    SELECT 1 FROM public.certificates
     WHERE user_id = NEW.user_id AND course_id = v_course_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM public.content_items ci
    JOIN public.modules m ON m.id = ci.module_id
   WHERE m.course_id = v_course_id
     AND m.published = true
     AND ci.published = true;

  IF v_total = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(DISTINCT p.content_item_id) INTO v_completed
    FROM public.content_item_progressions p
    JOIN public.content_items ci ON ci.id = p.content_item_id
    JOIN public.modules m ON m.id = ci.module_id
   WHERE p.user_id = NEW.user_id
     AND m.course_id = v_course_id
     AND m.published = true
     AND ci.published = true
     AND p.workflow_state IN ('read', 'completed')
     -- A NEW certificate needs genuine evidence behind every required assessment, not just a done row: rows written
     -- before the completion guard (or by a since-closed path) are left as they are, but no longer count here.
     AND (
       ci.type::text NOT IN ('assignment', 'quiz')
       OR (ci.type::text = 'assignment' AND EXISTS (
             SELECT 1 FROM public.assignments a
             JOIN public.assignment_submissions s ON s.assignment_id = a.id
            WHERE a.content_item_id = ci.id AND s.user_id = NEW.user_id AND s.submitted_at IS NOT NULL))
       OR (ci.type::text = 'quiz' AND EXISTS (
             SELECT 1 FROM public.quizzes z
             JOIN public.quiz_submissions q ON q.quiz_id = z.id
            WHERE z.content_item_id = ci.id AND q.user_id = NEW.user_id
              AND q.workflow_state = 'complete' AND q.finished_at IS NOT NULL))
     );

  IF v_completed < v_total THEN
    RETURN NEW;
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.certificates (
    user_id, course_id, certificate_type, certificate_data, verification_code, issued_at
  ) VALUES (
    NEW.user_id,
    v_course_id,
    'completion',
    jsonb_build_object(
      'completion_percentage', 100,
      'total_items', v_total,
      'auto_issued', true
    ),
    v_code,
    now()
  )
  ON CONFLICT (user_id, course_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
