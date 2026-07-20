
-- Add course scoping to notifications and triggers for announcements + graded submissions
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_course ON public.notifications(course_id);

-- Ensure service_role can write (edge functions / triggers as security definer)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Trigger: fan out course announcements to enrolled students
CREATE OR REPLACE FUNCTION public.notify_enrolled_on_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_title TEXT;
BEGIN
  SELECT title INTO v_course_title FROM public.courses WHERE id = NEW.course_id;
  INSERT INTO public.notifications (user_id, title, message, type, link, course_id)
  SELECT e.user_id,
         'New announcement: ' || COALESCE(NEW.title, 'Untitled'),
         LEFT(COALESCE(NEW.content, COALESCE(v_course_title, 'your course') || ' posted a new announcement.'), 240),
         'course_announcement',
         '/courses/' || NEW.course_id || '/announcements',
         NEW.course_id
  FROM public.enrollments e
  WHERE e.course_id = NEW.course_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_enrolled_on_announcement ON public.course_announcements;
CREATE TRIGGER trg_notify_enrolled_on_announcement
AFTER INSERT ON public.course_announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_enrolled_on_announcement();

-- Trigger: notify student when their assignment gets graded or new feedback
CREATE OR REPLACE FUNCTION public.notify_student_on_grade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
  v_assignment_title TEXT;
BEGIN
  -- Detect a meaningful grading change
  IF (TG_OP = 'INSERT' AND (NEW.grade IS NOT NULL OR NEW.feedback IS NOT NULL))
     OR (TG_OP = 'UPDATE' AND (
          NEW.grade IS DISTINCT FROM OLD.grade
          OR NEW.feedback IS DISTINCT FROM OLD.feedback
        )) THEN
    SELECT a.course_id, a.title
      INTO v_course_id, v_assignment_title
      FROM public.assignments a
      WHERE a.id = NEW.assignment_id;

    INSERT INTO public.notifications (user_id, title, message, type, link, course_id)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.grade IS NOT NULL THEN 'Assignment graded: ' || COALESCE(v_assignment_title, 'Assignment')
           ELSE 'New feedback: ' || COALESCE(v_assignment_title, 'Assignment') END,
      CASE WHEN NEW.grade IS NOT NULL THEN 'You received a grade of ' || NEW.grade::text
           ELSE 'Your instructor left new feedback.' END,
      'assignment_grade',
      '/courses/' || v_course_id || '/assignments',
      v_course_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_on_grade ON public.assignment_submissions;
CREATE TRIGGER trg_notify_student_on_grade
AFTER INSERT OR UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_student_on_grade();

-- Enable realtime for notifications (safe if already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
