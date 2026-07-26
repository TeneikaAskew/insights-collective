-- Attach the certificate auto-issue trigger and add the check_course_completion RPC used by CourseCertificate page.

DROP TRIGGER IF EXISTS trg_auto_issue_certificate ON public.content_item_progressions;
CREATE TRIGGER trg_auto_issue_certificate
AFTER INSERT OR UPDATE ON public.content_item_progressions
FOR EACH ROW EXECUTE FUNCTION public.auto_issue_certificate_on_progression();

CREATE OR REPLACE FUNCTION public.check_course_completion(p_course_id uuid, p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH total AS (
    SELECT COUNT(*) AS n
      FROM public.content_items ci
      JOIN public.modules m ON m.id = ci.module_id
     WHERE m.course_id = p_course_id
       AND m.published = true
       AND ci.published = true
  ),
  done AS (
    SELECT COUNT(DISTINCT p.content_item_id) AS n
      FROM public.content_item_progressions p
      JOIN public.content_items ci ON ci.id = p.content_item_id
      JOIN public.modules m ON m.id = ci.module_id
     WHERE p.user_id = p_student_id
       AND m.course_id = p_course_id
       AND m.published = true
       AND ci.published = true
       AND p.workflow_state IN ('read','completed')
  )
  SELECT total.n > 0 AND done.n >= total.n FROM total, done;
$$;

GRANT EXECUTE ON FUNCTION public.check_course_completion(uuid, uuid) TO authenticated, anon, service_role;