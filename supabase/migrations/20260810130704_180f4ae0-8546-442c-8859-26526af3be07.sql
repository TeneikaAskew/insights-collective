-- ABOUTME: Audit trail for instructor actions on a student submission: grading,
-- ABOUTME: comment posting, and file download/preview, resolved to course + module.

CREATE TABLE public.submission_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN (
    'grade_posted', 'grade_changed', 'grade_removed',
    'comment_posted',
    'file_downloaded', 'file_previewed'
  )),
  submission_id uuid NOT NULL REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  student_id uuid,
  assignment_id uuid,
  course_id uuid,
  module_id uuid,
  attachment_id uuid,
  filename text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Reads are always "the trail for this submission" or "for this course/module",
-- newest first.
CREATE INDEX submission_audit_events_submission_idx
  ON public.submission_audit_events (submission_id, created_at DESC);
CREATE INDEX submission_audit_events_course_idx
  ON public.submission_audit_events (course_id, created_at DESC);
CREATE INDEX submission_audit_events_module_idx
  ON public.submission_audit_events (module_id, created_at DESC);

-- Read-only for clients: writes arrive from the SECURITY DEFINER trigger
-- functions and log_submission_file_access() below, never from PostgREST.
GRANT SELECT ON public.submission_audit_events TO authenticated;
GRANT ALL ON public.submission_audit_events TO service_role;

ALTER TABLE public.submission_audit_events ENABLE ROW LEVEL SECURITY;

-- Course staff and admins can read the trail. can_access_submission() would also
-- let the student read their own row; that is deliberately NOT used here — the
-- trail records staff behaviour (who downloaded whose file) and is a staff view.
CREATE POLICY "Course staff can read the submission audit trail"
  ON public.submission_audit_events
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_manage_course_content(auth.uid(), course_id)
  );

-- No INSERT/UPDATE/DELETE policy on purpose: an audit trail nobody can rewrite.

-- Resolve the course/module/assignment context of a submission once, so every
-- writer stores the same shape.
CREATE OR REPLACE FUNCTION public.submission_audit_context(p_submission_id uuid)
RETURNS TABLE(student_id uuid, assignment_id uuid, course_id uuid, module_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    s.user_id,
    a.id,
    COALESCE(ci.course_id, a.course_id),
    COALESCE(ci.module_id, a.module_id)
  FROM public.assignment_submissions s
  JOIN public.assignments a ON a.id = s.assignment_id
  LEFT JOIN public.content_items ci ON ci.id = a.content_item_id
  WHERE s.id = p_submission_id;
$$;

-- Grading. Fires only when a grade-bearing column actually changed, so an
-- unrelated update (e.g. a student resubmitting) does not forge a grade entry.
CREATE OR REPLACE FUNCTION public.audit_submission_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ctx record;
  v_action text;
BEGIN
  IF NEW.grade IS NOT DISTINCT FROM OLD.grade
     AND NEW.grader_comments IS NOT DISTINCT FROM OLD.grader_comments
     AND NEW.rubric_scores IS NOT DISTINCT FROM OLD.rubric_scores
     AND NEW.workflow_state IS NOT DISTINCT FROM OLD.workflow_state THEN
    RETURN NEW;
  END IF;

  IF NEW.workflow_state IS DISTINCT FROM 'graded'
     AND OLD.workflow_state = 'graded' THEN
    v_action := 'grade_removed';
  ELSIF OLD.workflow_state = 'graded' OR OLD.grade IS NOT NULL THEN
    v_action := 'grade_changed';
  ELSE
    v_action := 'grade_posted';
  END IF;

  SELECT * INTO v_ctx FROM public.submission_audit_context(NEW.id);

  INSERT INTO public.submission_audit_events (
    actor_id, action, submission_id, student_id, assignment_id, course_id, module_id, details
  ) VALUES (
    auth.uid(), v_action, NEW.id, v_ctx.student_id, v_ctx.assignment_id,
    v_ctx.course_id, v_ctx.module_id,
    jsonb_strip_nulls(jsonb_build_object(
      'old_grade', OLD.grade,
      'new_grade', NEW.grade,
      'old_workflow_state', OLD.workflow_state,
      'new_workflow_state', NEW.workflow_state,
      'grader_comments_changed',
        (NEW.grader_comments IS DISTINCT FROM OLD.grader_comments),
      'rubric_scores_changed',
        (NEW.rubric_scores IS DISTINCT FROM OLD.rubric_scores)
    ))
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_submission_grade
  AFTER UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_submission_grade();

-- Comments. Drafts are not an act of feedback yet, so they are not recorded.
CREATE OR REPLACE FUNCTION public.audit_submission_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ctx record;
BEGIN
  IF COALESCE(NEW.is_draft, false) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_ctx FROM public.submission_audit_context(NEW.submission_id);

  -- A comment on something other than an assignment submission has no context
  -- row; recording it with null course_id would make it unreadable under RLS.
  IF v_ctx.course_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.submission_audit_events (
    actor_id, action, submission_id, student_id, assignment_id, course_id, module_id, details
  ) VALUES (
    COALESCE(NEW.author_id, auth.uid()), 'comment_posted', NEW.submission_id,
    v_ctx.student_id, v_ctx.assignment_id, v_ctx.course_id, v_ctx.module_id,
    jsonb_strip_nulls(jsonb_build_object(
      'comment_id', NEW.id,
      'author_type', NEW.author_type,
      'comment_type', NEW.comment_type,
      'is_private', NEW.is_private
    ))
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_submission_comment
  AFTER INSERT ON public.submission_comments
  FOR EACH ROW EXECUTE FUNCTION public.audit_submission_comment();

-- File access leaves no other database trace — a signed URL is minted client
-- side — so the grading screen calls this. It records auth.uid() and never a
-- caller-supplied actor, and refuses callers who are not staff on that course.
CREATE OR REPLACE FUNCTION public.log_submission_file_access(
  p_submission_id uuid,
  p_action text,
  p_attachment_id uuid DEFAULT NULL,
  p_filename text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ctx record;
  v_id uuid;
BEGIN
  IF p_action NOT IN ('file_downloaded', 'file_previewed') THEN
    RAISE EXCEPTION 'log_submission_file_access only records file access, got %', p_action
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_ctx FROM public.submission_audit_context(p_submission_id);
  IF v_ctx.course_id IS NULL THEN
    RAISE EXCEPTION 'Unknown submission %', p_submission_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_manage_course_content(auth.uid(), v_ctx.course_id)
  ) THEN
    RAISE EXCEPTION 'Only course staff may record submission file access'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Reject an attachment that belongs to a different submission rather than
  -- filing it under this one.
  IF p_attachment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.submission_attachments
    WHERE id = p_attachment_id AND submission_id = p_submission_id
  ) THEN
    RAISE EXCEPTION 'Attachment % does not belong to submission %',
      p_attachment_id, p_submission_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.submission_audit_events (
    actor_id, action, submission_id, student_id, assignment_id, course_id,
    module_id, attachment_id, filename
  ) VALUES (
    auth.uid(), p_action, p_submission_id, v_ctx.student_id, v_ctx.assignment_id,
    v_ctx.course_id, v_ctx.module_id, p_attachment_id, p_filename
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_submission_file_access(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_submission_file_access(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_submission_file_access(uuid, text, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.submission_audit_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submission_audit_context(uuid) TO service_role;