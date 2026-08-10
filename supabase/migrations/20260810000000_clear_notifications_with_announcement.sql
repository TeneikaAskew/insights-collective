-- Delete an announcement's fan-out notifications along with the announcement.
--
-- notify_enrolled_on_announcement writes one notification per enrolled user
-- whenever a course_announcements row is inserted. Nothing removed them again.
-- Two consequences, one for readers and one for the suite:
--
--   A notification whose announcement has been deleted is a dead link. It sits
--   in the inbox, and its /courses/<id>/announcements target no longer lists
--   anything it refers to.
--
--   e2e/journeys/messaging-notifications-hardening.spec.ts posts a real
--   announcement to exercise that trigger. RLS scopes notification DELETE to
--   auth.uid() = user_id, so the spec can only ever clean its own row; every
--   other enrolled user kept theirs. That reached 4,089 rows across 14 inboxes
--   before anyone looked, because the service-role sweep meant to catch it only
--   runs when a key nobody had set is present.
--
-- Matching is on course_id + type + the exact title the fan-out composes, which
-- is the only link that exists — notifications carries no announcement_id. The
-- consequence worth knowing: two live announcements with the SAME TITLE in the
-- SAME COURSE share one set of notification titles, so deleting either clears
-- both sets. Adding a real foreign key would be the stronger fix and is a wider
-- change than this; the duplicate-title case is rare and its blast radius is one
-- course's notifications for a title that is being deleted anyway.
create or replace function public.clear_notifications_on_announcement_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.notifications
   where course_id = OLD.course_id
     and type = 'course_announcement'
     and title = 'New announcement: ' || coalesce(OLD.title, 'Untitled');
  return OLD;
end;
$$;

comment on function public.clear_notifications_on_announcement_delete() is
  'Removes the fan-out notifications created by notify_enrolled_on_announcement when their announcement is deleted.';

drop trigger if exists clear_notifications_on_announcement_delete on public.course_announcements;

create trigger clear_notifications_on_announcement_delete
  after delete on public.course_announcements
  for each row
  execute function public.clear_notifications_on_announcement_delete();
