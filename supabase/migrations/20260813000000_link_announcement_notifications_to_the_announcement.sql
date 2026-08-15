-- Point an announcement notification at its announcement, not at the list.
--
-- notify_enrolled_on_announcement wrote '/courses/<id>/announcements' — the
-- section, with nothing identifying the row the notification was about. Opening
-- "New announcement: Week 3 materials are up" landed you on a page of every
-- announcement in the course and left you to find the one you were told about;
-- if it had since been deleted, there was nothing to find and no way to know
-- that. The id now rides along in the link, and the announcements section
-- scrolls to and rings that row (and says so when it is gone).
CREATE OR REPLACE FUNCTION public.notify_enrolled_on_announcement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_title TEXT;
BEGIN
  SELECT title INTO v_course_title FROM public.courses WHERE id = NEW.course_id;
  INSERT INTO public.notifications (user_id, title, message, type, link, course_id)
  SELECT e.user_id,
         'New announcement: ' || COALESCE(NEW.title, 'Untitled'),
         LEFT(COALESCE(NEW.content, COALESCE(v_course_title, 'your course') || ' posted a new announcement.'), 240),
         'course_announcement',
         '/courses/' || NEW.course_id || '/announcements?announcement=' || NEW.id,
         NEW.course_id
  FROM public.enrollments e
  WHERE e.course_id = NEW.course_id;
  RETURN NEW;
END;
$function$;

-- Matches the grant posture of the other notify_* triggers: SECURITY DEFINER
-- functions are trigger-invoked only, never callable from a client.
REVOKE EXECUTE ON FUNCTION public.notify_enrolled_on_announcement() FROM PUBLIC, anon, authenticated;
