-- The rules from 20260802020000, enforced where nothing can route around them.
--
-- That migration removed the INSERT policies that let a signed-in user open a thread with
-- any account in the directory. RLS is only half the story here: `messages-helper` runs
-- every query with the SERVICE ROLE key, and the service role bypasses RLS entirely. So
-- the same free-for-all thread was still one crafted `createConversation` request away,
-- and it would stay that way for as long as anybody could call an Edge Function action
-- that had not been redeployed. Edge Functions are deployed by hand in this project —
-- there is no CI step for them — so "we removed it from the source" is not a control.
--
-- Triggers are. They run for every writer including the service role, so the invariant
-- holds no matter which layer is doing the writing:
--
--   * a conversation must name a course
--   * a participant must actually be in that course — enrolled, teaching it, or an admin
--
-- Both were probed against the live database on 2026-08-02 inside a rolled-back
-- transaction, writing as the service role rather than as an authenticated user:
--
--   open_course_thread, student -> instructor ................... OK
--   service role inserts a conversation with no course .......... BLOCKED
--   service role adds an unrelated account to a course thread ... BLOCKED
--   legacy unscoped thread still accepts replies ................ OK
--
-- That last one is the reason these are INSERT triggers and not a NOT NULL constraint
-- plus a backfill. 26 of the 31 conversations that exist today predate course scoping.
-- Their participants can still read and reply — only *new* threads and *new* memberships
-- have to justify themselves with a course. Retiring the old threads is a product
-- decision, and this migration does not make it.

CREATE OR REPLACE FUNCTION public.enforce_conversation_has_course()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.course_id IS NULL THEN
    RAISE EXCEPTION 'A conversation must belong to a course. Open it with open_course_thread().';
  END IF;
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER because the check reads `enrollments` and `courses`, and the writer
-- being validated is frequently a student who cannot see the whole roster.
CREATE OR REPLACE FUNCTION public.enforce_conversation_participant_in_course()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course uuid;
  v_allowed boolean;
BEGIN
  SELECT course_id INTO v_course FROM public.conversations WHERE id = NEW.conversation_id;

  IF v_course IS NULL THEN
    RAISE EXCEPTION 'Conversation % is not scoped to a course; participants cannot be added.', NEW.conversation_id;
  END IF;

  SELECT
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = v_course AND e.user_id = NEW.user_id)
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = v_course AND c.instructor_id = NEW.user_id)
    OR public.is_course_instructor(NEW.user_id, v_course)
    -- open_course_thread lets an admin open a thread about a course they neither teach
    -- nor take, so the trigger has to let that admin into the room it just created.
    OR public.has_role(NEW.user_id, 'admin'::app_role)
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'User % is not part of course %', NEW.user_id, v_course;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_require_course ON public.conversations;
CREATE TRIGGER conversations_require_course
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_conversation_has_course();

DROP TRIGGER IF EXISTS conversation_participants_require_course_membership ON public.conversation_participants;
CREATE TRIGGER conversation_participants_require_course_membership
  BEFORE INSERT ON public.conversation_participants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_conversation_participant_in_course();
