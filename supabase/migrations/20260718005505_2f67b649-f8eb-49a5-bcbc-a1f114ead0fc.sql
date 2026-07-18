
-- Grants for certificates table (missing before)
GRANT SELECT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;

-- Prevent duplicate certificates per user/course
CREATE UNIQUE INDEX IF NOT EXISTS certificates_user_course_unique
  ON public.certificates(user_id, course_id);

-- Trigger function: after a progression is marked read/completed, check whether
-- the student has finished every published content item in every published module
-- of the course. If so, insert a completion certificate (idempotent).
CREATE OR REPLACE FUNCTION public.auto_issue_certificate_on_progression()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
     AND p.workflow_state IN ('read', 'completed');

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
$$;

DROP TRIGGER IF EXISTS trg_auto_issue_certificate ON public.content_item_progressions;
CREATE TRIGGER trg_auto_issue_certificate
AFTER INSERT OR UPDATE OF workflow_state ON public.content_item_progressions
FOR EACH ROW
EXECUTE FUNCTION public.auto_issue_certificate_on_progression();

-- Backfill: issue certificates for any students who already finished a course
INSERT INTO public.certificates (user_id, course_id, certificate_type, certificate_data, verification_code, issued_at)
SELECT
  x.user_id,
  x.course_id,
  'completion',
  jsonb_build_object('completion_percentage', 100, 'total_items', x.total, 'auto_issued', true, 'backfilled', true),
  upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  now()
FROM (
  SELECT p.user_id, m.course_id,
         COUNT(DISTINCT p.content_item_id) AS completed,
         (SELECT COUNT(*) FROM public.content_items ci2
            JOIN public.modules m2 ON m2.id = ci2.module_id
           WHERE m2.course_id = m.course_id AND m2.published = true AND ci2.published = true) AS total
    FROM public.content_item_progressions p
    JOIN public.content_items ci ON ci.id = p.content_item_id
    JOIN public.modules m ON m.id = ci.module_id
   WHERE p.workflow_state IN ('read','completed')
     AND m.published = true
     AND ci.published = true
   GROUP BY p.user_id, m.course_id
) x
WHERE x.total > 0 AND x.completed >= x.total
ON CONFLICT (user_id, course_id) DO NOTHING;
