-- Messaging is course messaging.
--
-- Two things were true of the live database before this migration, both verified
-- on 2026-08-02 by running the real policies under simulated JWTs
-- (`set local role authenticated` + `request.jwt.claims`) inside a transaction
-- that was rolled back:
--
-- 1. RECEIVING WAS HALF-BROKEN. The client marks a thread read with
--
--        update messages set read = true
--        where conversation_id = $1 and sender_id <> me and read = false
--
--    but the only UPDATE policy on `messages` is `messages_update_own`
--    (`sender_id = auth.uid()`). Every row the client wants to touch is a row
--    somebody else sent, so the statement matched nothing: `rows updated = 0`,
--    no error, `read` stayed false forever. ConversationList derives its unread
--    styling from `last_message.read`, so a received message stayed visibly
--    unread no matter how many times you opened it. PostgREST answers such a
--    write 204/zero-rows, which is indistinguishable from "already read" — which
--    is exactly why this survived. Fixed here with a SECURITY DEFINER RPC rather
--    than by widening the UPDATE policy: RLS cannot restrict *which columns* an
--    UPDATE touches, so a policy permissive enough to let a recipient set `read`
--    would also let them rewrite the sender's `content`.
--
-- 2. ANY SIGNED-IN USER COULD START A THREAD WITH ANY OTHER USER. `conversations`
--    allowed INSERT on `created_by = auth.uid()`, and `conversation_participants`
--    allowed adding *arbitrary* user ids to a conversation you created. Probed
--    directly: a student inserted a conversation and added an account they share
--    no course with, and the pair could then message each other. That is the
--    free-for-all directory DM the product does not want — messages exist because
--    of a course, so a thread has to be justified by one.
--
--    `public.open_course_thread` (20260720113448) already encodes the real rules:
--    caller must be enrolled or teach the course, students may only address a
--    course instructor, instructors may only address enrolled students or
--    co-instructors, and the 1:1 thread per (course, pair) is reused rather than
--    duplicated. It is SECURITY DEFINER, so it keeps working when the table-level
--    INSERT policies go away. Verified against the live function on 2026-08-02:
--
--      student  -> course instructor, enrolled ....... ALLOWED (idempotent)
--      student  -> another student, same course ...... DENIED  "Students can only message the course instructor"
--      student  -> instructor, NOT enrolled .......... DENIED  "You must be enrolled in this course to message about it"
--      instructor -> enrolled student ................ ALLOWED (same thread as above)
--      instructor -> user not in the course .......... DENIED  "Recipient is not part of this course"
--      instructor -> student of a course they do not teach  DENIED
--      anyone   -> self .............................. DENIED  "Invalid recipient"
--
-- Reading was already correct and is left alone: `messages` and `conversations`
-- are SELECT-able only by participants, and a third account probed against a live
-- thread saw 0 rows of both and could not insert a message into it.
--
-- Existing data is untouched. 26 of the 31 conversations that exist today predate
-- course scoping and have a null `course_id`; they stay readable and repliable by
-- their participants. `course_id` is deliberately NOT made NOT NULL — retiring
-- those threads is a product decision, not a migration.

-- ---------------------------------------------------------------------------
-- 1. Read receipts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The definer bypasses RLS, so membership is checked here or nowhere.
  IF NOT public.is_conversation_participant(v_caller, p_conversation_id) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  UPDATE public.messages
  SET read = true
  WHERE conversation_id = p_conversation_id
    AND sender_id <> v_caller
    AND read = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.mark_conversation_read(uuid) IS
  'Marks every message a participant did not send as read. Exists because RLS '
  'cannot scope an UPDATE to a single column: a policy letting a recipient set '
  '`read` would also let them rewrite the sender''s `content`.';

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Threads may only be created by open_course_thread
-- ---------------------------------------------------------------------------

-- `conversations_creator_access` is FOR ALL with a USING clause and no WITH
-- CHECK, so Postgres reuses USING as the insert check and it grants INSERT too.
-- Split it into the three commands that are actually wanted; INSERT is not one
-- of them.
DROP POLICY IF EXISTS "conversations_creator_access" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

CREATE POLICY "conversations_creator_select" ON public.conversations
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "conversations_creator_update" ON public.conversations
  FOR UPDATE USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "conversations_creator_delete" ON public.conversations
  FOR DELETE USING (created_by = auth.uid());

-- Three overlapping INSERT policies, all saying "you may add anyone at all to a
-- conversation you created". That is the hole. Participants are now written only
-- by open_course_thread, which decides who is allowed to be in the room.
DROP POLICY IF EXISTS "Users can add participants to conversations they created" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can insert new conversation participants" ON public.conversation_participants;

-- Leaving a thread stays a client-side action. The old policy called
-- public.get_user_role(), which selects a `profiles.role` column that does not
-- exist on this database (roles live in public.user_roles) — so the expression
-- raised `column "role" does not exist` instead of returning a boolean. It
-- failed closed, but it also meant the admin half of this policy had never once
-- worked. Rewritten onto has_role(), the helper the rest of the schema uses.
DROP POLICY IF EXISTS "Users can remove themselves from conversations" ON public.conversation_participants;

CREATE POLICY "conversation_participants_leave" ON public.conversation_participants
  FOR DELETE USING (
    user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)
  );
