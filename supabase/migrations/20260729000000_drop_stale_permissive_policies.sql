-- Drop the stale permissive policies that OR away the correct ones.
--
-- Across this schema the pattern is the same: a correct, scoped policy was added
-- at some point, but the older permissive policy it was meant to replace was
-- never dropped. RLS policies for the same command are OR-combined, so the
-- loosest one always wins and the scoped policy is dead weight. Every DROP below
-- removes a policy that is strictly weaker than one that already exists (or that
-- this migration adds).
--
-- Verified against the live schema before writing: each table's full policy set,
-- the column-level grants, and the client call sites that depend on them.

-- ---------------------------------------------------------------------------
-- 1. messages — the self-referential WITH CHECK
-- ---------------------------------------------------------------------------
-- Both INSERT policies contain a subquery that compares a column to itself
-- (`conversation_participants.conversation_id = conversation_participants.conversation_id`
-- and `cp.conversation_id = cp.conversation_id`). That predicate is true for any
-- row, so the EXISTS collapses to "am I a participant in *any* conversation" —
-- i.e. any signed-in user with one conversation could insert into every other
-- conversation in the system.
--
-- `messages_sender_access` (FOR ALL, `sender_id = auth.uid()`, no WITH CHECK)
-- permits exactly the same insert on its own, so fixing only the two named
-- policies would not have closed the hole.
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "messages_sender_access" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

-- SELECT is left alone: `Users can view their own messages` and
-- `messages_conversation_participant_access` are both already correctly scoped.

CREATE POLICY "messages_insert_participant" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(auth.uid(), conversation_id)
  );

-- The old UPDATE policy had no WITH CHECK, so a sender could edit their own
-- message and move it into a conversation they were not part of. Same predicate
-- on both sides closes that.
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(auth.uid(), conversation_id)
  );

-- Dropping the FOR ALL policy would otherwise remove DELETE entirely.
CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- Deliberately unchanged: marking a message read is done by the *recipient*
-- (`useConversationMessages.ts` updates `read` with `.neq('sender_id', user.id)`),
-- which matches no UPDATE policy today and silently affects zero rows. That is a
-- pre-existing no-op, not something this migration introduces — widening UPDATE
-- to participants here would be a behavior change, so it is left for a separate
-- fix alongside the client code.

-- ---------------------------------------------------------------------------
-- 2. courses — unpublished courses were world-readable
-- ---------------------------------------------------------------------------
-- `Courses are viewable by everyone` is USING (true) for role `public`, which
-- OR-combines with `courses_public_read_published` and `Anyone can view
-- published courses` and makes the `published` check meaningless.
DROP POLICY IF EXISTS "Courses are viewable by everyone" ON public.courses;

-- Dead policy: the subquery says `ca.course_id = ca.id`, comparing
-- course_assignments.course_id to course_assignments.id, which is never true.
-- Its live half (`instructor_id = auth.uid()`) is already covered by
-- `courses_creator_access`, and the intended half by
-- `courses_instructor_assigned_access`.
DROP POLICY IF EXISTS "Instructors can edit their own courses" ON public.courses;

-- Exact duplicate of `Instructors can update own courses`, differing only in
-- role (`public` vs `authenticated`).
DROP POLICY IF EXISTS "Only course instructor can update their courses" ON public.courses;

-- ---------------------------------------------------------------------------
-- 3. storage — private course buckets were readable and writable by anyone
-- ---------------------------------------------------------------------------
-- course-documents, course-images and course-videos are all `public = false`,
-- but each carried a `SELECT USING (bucket_id = '...')` policy granted to role
-- `public`. The anon key ships in the frontend bundle, so anyone with a path
-- could download. The matching upload policies checked only
-- `auth.role() = 'authenticated'`, so any signed-in user could write into them,
-- and the "instructors can delete" policies were the same check in disguise.
--
-- The correctly-scoped `course_docs_*` set already exists for course-documents
-- and keys off the first path segment being the course id
-- (`split_part(name, '/', 1)::uuid`). This section drops the loose policies and
-- extends that same shape to course-images and course-videos.
--
-- Checked before writing: course-documents and course-videos are empty, and the
-- six objects in course-images are orphans — no row in `courses` references a
-- course-images URL (the live thumbnail path is the public `course-materials`
-- bucket). So no currently-reachable object loses access here.

DROP POLICY IF EXISTS "Allow public read access to course documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to course images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to course videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read course documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read course images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read course videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload course documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload course images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload course videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload course materials" ON storage.objects;
DROP POLICY IF EXISTS "Allow course instructors to delete course documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow course instructors to delete course images" ON storage.objects;
DROP POLICY IF EXISTS "Allow course instructors to delete course videos" ON storage.objects;

CREATE POLICY "course_images_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-images'
    AND public.can_access_course_materials(
      auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY "course_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-images'
    AND public.can_manage_course_materials(
      auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY "course_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'course-images'
    AND public.can_manage_course_materials(
      auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY "course_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-images'
    AND public.can_manage_course_materials(
      auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY "course_videos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-videos'
    AND public.can_access_course_materials(
      auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY "course_videos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-videos'
    AND public.can_manage_course_materials(
      auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY "course_videos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'course-videos'
    AND public.can_manage_course_materials(
      auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY "course_videos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-videos'
    AND public.can_manage_course_materials(
      auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );

-- course-materials is genuinely `public = true` (it serves course thumbnails via
-- getPublicUrl), so its read policy is by design and stays. Only the write side
-- needed scoping.
-- Role-based rather than course-scoped on purpose: CourseBuilder uploads a
-- thumbnail to `course-thumbnails/<uuid>-<ts>.png` while the course is still
-- being created, so there is no course id in the path and requiring an existing
-- course would break an instructor creating their first one.
CREATE POLICY "course_materials_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-materials'
    AND (
      public.has_admin_access(auth.uid())
      OR public.has_role(auth.uid(), 'instructor'::app_role)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. storage — student assignment-attachment uploads
-- ---------------------------------------------------------------------------
-- The scoped course_*_insert policies above require can_manage_course_materials
-- (instructors/admins). Students upload assignment attachments to the same
-- private buckets via FileUploadZone, so they get their own path and policy:
-- submissions/<courseId>/<userId>/<file>, writable by the enrolled owner, without
-- restoring general course-material writes.
-- (quiz_questions answer-key access is owned by the merged #20 answer-key
-- migrations — this migration deliberately does not touch quiz_questions.)
CREATE POLICY "course_submission_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('course-images', 'course-videos', 'course-documents')
    AND split_part(name, '/', 1) = 'submissions'
    AND NULLIF(split_part(name, '/', 3), '')::uuid = auth.uid()
    AND public.can_access_course_materials(
          auth.uid(), NULLIF(split_part(name, '/', 2), '')::uuid)
  );

CREATE POLICY "course_submission_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('course-images', 'course-videos', 'course-documents')
    AND split_part(name, '/', 1) = 'submissions'
    AND (
      NULLIF(split_part(name, '/', 3), '')::uuid = auth.uid()
      OR public.can_manage_course_materials(
           auth.uid(), NULLIF(split_part(name, '/', 2), '')::uuid)
    )
  );

CREATE POLICY "course_submission_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('course-images', 'course-videos', 'course-documents')
    AND split_part(name, '/', 1) = 'submissions'
    AND NULLIF(split_part(name, '/', 3), '')::uuid = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 5. events — any signed-in user could create site-wide events
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;

CREATE POLICY "events_staff_insert" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_admin_access(auth.uid())
    OR (course_id IS NOT NULL AND public.is_course_instructor(auth.uid(), course_id))
  );

-- Duplicate of `Events are viewable by everyone`; events are public by design.
DROP POLICY IF EXISTS "Users can view all events" ON public.events;

-- ---------------------------------------------------------------------------
-- 6. notifications — the "service role" policy was granted to authenticated
-- ---------------------------------------------------------------------------
-- `Service role can insert notifications` is `TO authenticated WITH CHECK (true)`,
-- so any signed-in user could write a notification into anyone's inbox. The
-- service role bypasses RLS entirely and never needed a policy.
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- ---------------------------------------------------------------------------
-- 7. availability_slots — everyone's schedule was world-readable
-- ---------------------------------------------------------------------------
-- `Users can view all availability slots` is USING (true) for role `public`.
-- The mock-interview matcher genuinely needs a cross-user read, but only to
-- find *which users* are free in a given weekday/time slot — see
-- `MockInterviews.tsx`. A SECURITY DEFINER function gives it exactly that and
-- nothing else, so the blanket policy can go.
CREATE OR REPLACE FUNCTION public.find_available_peers(
  p_weekday integer,
  p_time_slot text
)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.user_id
  FROM public.availability_slots s
  WHERE s.weekday = p_weekday
    AND s.time_slot = p_time_slot
    AND s.is_available = true
    AND auth.uid() IS NOT NULL
    AND s.user_id <> auth.uid();
$function$;

REVOKE EXECUTE ON FUNCTION public.find_available_peers(integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_available_peers(integer, text) TO authenticated;

DROP POLICY IF EXISTS "Users can view all availability slots" ON public.availability_slots;

-- `Users can view their own availability slots` already covers AvailabilityManager.

-- ---------------------------------------------------------------------------
-- 8. assistant_conversations / assistant_messages — session-id header bypass
-- ---------------------------------------------------------------------------
-- These policies accept `session_id = request.headers ->> 'session-id'` as an
-- alternative to `auth.uid() = user_id`. The header is fully attacker-controlled,
-- and ResumeChat mints session ids as `resume-chat-${Date.now()}` — guessable by
-- brute force over a timestamp range. Gating the header branch on
-- `user_id IS NULL` keeps anonymous chat working without letting a header reach
-- a signed-in user's rows.
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.assistant_conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.assistant_conversations;

CREATE POLICY "assistant_conversations_select" ON public.assistant_conversations
  FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (
      user_id IS NULL
      AND session_id = ((current_setting('request.headers', true))::json ->> 'session-id')
    )
  );

CREATE POLICY "assistant_conversations_insert" ON public.assistant_conversations
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (
      user_id IS NULL
      AND session_id = ((current_setting('request.headers', true))::json ->> 'session-id')
    )
  );

DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.assistant_messages;
DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON public.assistant_messages;

CREATE POLICY "assistant_messages_select" ON public.assistant_messages
  FOR SELECT
  USING (
    conversation_id IN (SELECT id FROM public.assistant_conversations)
  );

CREATE POLICY "assistant_messages_insert" ON public.assistant_messages
  FOR INSERT
  WITH CHECK (
    conversation_id IN (SELECT id FROM public.assistant_conversations)
  );

-- The subselects above inherit assistant_conversations' own RLS, so the access
-- rule lives in exactly one place instead of being duplicated per table.

-- ---------------------------------------------------------------------------
-- 9. Hygiene
-- ---------------------------------------------------------------------------
-- Authorization reads `user_roles`, and `profiles.roles` is already immutable via
-- the `enforce_profiles_roles_immutable` trigger with UPDATE not granted. But
-- INSERT on the column is still granted, so a user whose profile row does not yet
-- exist could create one with roles of their choosing.
REVOKE INSERT (roles) ON public.profiles FROM anon, authenticated;

-- These policies still read `profiles.roles` rather than `user_roles`, which
-- would make the column load-bearing again if it were ever writable.
DROP POLICY IF EXISTS "Admin can view all security events" ON public.security_events;
-- `security_events_admin_only` already covers this with has_admin_access().

DROP POLICY IF EXISTS "Users can view course announcements" ON public.course_announcements;
DROP POLICY IF EXISTS "Instructors can create announcements" ON public.course_announcements;
DROP POLICY IF EXISTS "Authors can update their announcements" ON public.course_announcements;
DROP POLICY IF EXISTS "Authors can delete their announcements" ON public.course_announcements;

-- Like-for-like with the policy it replaces (enrolled OR course instructor OR a
-- global admin/instructor role) — the only change is reading `user_roles` via
-- has_role() instead of the `profiles.roles` array.
CREATE POLICY "course_announcements_select" ON public.course_announcements
  FOR SELECT
  USING (
    public.can_access_course_materials(auth.uid(), course_id)
    OR public.has_role(auth.uid(), 'instructor'::app_role)
  );

CREATE POLICY "course_announcements_insert" ON public.course_announcements
  FOR INSERT
  WITH CHECK (
    public.can_manage_course_materials(auth.uid(), course_id)
  );

CREATE POLICY "course_announcements_update" ON public.course_announcements
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR author_id = auth.uid()
    OR public.has_admin_access(auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR author_id = auth.uid()
    OR public.has_admin_access(auth.uid())
  );

CREATE POLICY "course_announcements_delete" ON public.course_announcements
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR author_id = auth.uid()
    OR public.has_admin_access(auth.uid())
  );

-- log_security_event is SECURITY DEFINER and takes p_user_id straight from the
-- caller, so any client could write audit rows attributed to someone else. Four
-- client call sites depend on it (useCoursePermissions, useCoursesManagement,
-- securityUtils), so revoking EXECUTE would break real logging; instead the
-- function now pins the subject to the caller. Service-role callers — the
-- edge functions — still pass p_user_id explicitly and are unaffected, since
-- auth.uid() is null for them.
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id uuid,
  p_event_type text,
  p_severity text,
  p_description text,
  p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO security_events (user_id, event_type, severity, description, metadata)
  VALUES (
    CASE WHEN auth.uid() IS NULL THEN p_user_id ELSE auth.uid() END,
    p_event_type,
    p_severity,
    p_description,
    p_metadata
  );
END;
$function$;
