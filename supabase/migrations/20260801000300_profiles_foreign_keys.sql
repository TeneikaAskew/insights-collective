-- Make `profiles` embeds resolvable, without turning a display bug into a
-- write-blocking one.
--
-- Nine tables identify a user with a uuid column that has a foreign key to
-- auth.users. PostgREST cannot embed public.profiles through a key that points
-- somewhere else, so every one of these fails for every role, always:
--
--     certificates          user_profile:profiles!user_id(...)
--     assignment_submissions user:profiles!user_id(...)  / student:profiles!user_id(...)
--     video_analytics       profiles(first_name, last_name)
--     course_assignments    profile:profiles(...)
--     course_instructors    profile:profiles(...)
--     blog_posts            author:profiles!author_id(...)
--     content_discussions   profiles!content_discussions_user_id_fkey(...)
--     mock_sessions         user1:user1_id(*) / user2:user2_id(*)
--
-- Three of those are on live routes and render an error page today:
-- /courses/:id/assignments/:cid/grade ("Error loading submissions" — instructors
-- cannot grade), /courses/:id/modules/:mid/assignments/:aid ("Failed to load
-- assignment"), and /courses/:id/insights.
--
-- ── Why the backfill has to come first ────────────────────────────────────────
--
-- 21 of 89 auth.users rows have no profile (and no user_roles row either).
-- They were created 2025-05-07 → 2025-07-03; the on_auth_user_created →
-- handle_new_user trigger has covered every signup since, so this is a closed
-- historical window, not an ongoing leak.
--
-- None of those 21 currently own a row in any table below, so the constraints
-- would create cleanly today — and then the first time one of them earned a
-- certificate or submitted an assignment, the INSERT would fail with a foreign
-- key violation. Adding the keys without the backfill would convert a rendering
-- bug into a data-loss-adjacent one for 21 real accounts.
--
-- ── Delete rules ──────────────────────────────────────────────────────────────
--
-- Each new key mirrors the ON DELETE action of the existing auth.users key on
-- the same column, so deleting a user behaves exactly as it does today.
-- profiles.id itself cascades from auth.users, so a NO ACTION key on a column
-- whose auth.users key CASCADEs would block the cascade and make user deletion
-- fail. Mirroring avoids that entirely.
--
-- course_assignments and course_instructors have no user key at all today;
-- CASCADE matches how every other membership row on those users behaves.
--
-- Not included: threads, posts and peer_reviews. Their features are being
-- removed, all three tables are empty, and adding constraints to hold up code
-- that is about to be deleted is noise. If those features return, this migration
-- is the pattern to copy.

BEGIN;

-- 1. Backfill the historical gap, matching handle_new_user exactly: empty-string
--    names (those accounts carry no first_name/last_name metadata) and the
--    default student role. ON CONFLICT here is idempotency, not error
--    suppression — a conflict means the row already exists, and any other
--    failure still raises.
INSERT INTO public.profiles (id, first_name, last_name)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'first_name', ''),
       COALESCE(u.raw_user_meta_data->>'last_name', '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'student'::app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT DO NOTHING;

-- 2. Refuse to continue if the backfill did not fully close the gap. Every
--    ADD CONSTRAINT below would otherwise fail with a bare Postgres error that
--    says nothing about why.
DO $$
DECLARE
  v_missing integer;
BEGIN
  SELECT count(*) INTO v_missing
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

  IF v_missing > 0 THEN
    RAISE EXCEPTION
      'profiles backfill incomplete: % auth.users row(s) still have no profile. '
      'Adding the foreign keys now would block those users from ever writing a '
      'certificate, submission or discussion.', v_missing;
  END IF;
END $$;

-- 3. Add each key NOT VALID first, then VALIDATE separately. NOT VALID takes a
--    weaker lock and applies to new rows immediately; VALIDATE then checks the
--    existing rows. If some environment does hold orphans, VALIDATE is what
--    fails — the migration stops there rather than silently accepting bad data.
ALTER TABLE public.certificates
  ADD CONSTRAINT certificates_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE NO ACTION NOT VALID;

ALTER TABLE public.assignment_submissions
  ADD CONSTRAINT assignment_submissions_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE NO ACTION NOT VALID;

ALTER TABLE public.video_analytics
  ADD CONSTRAINT video_analytics_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_author_id_profiles_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.content_discussions
  ADD CONSTRAINT content_discussions_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.mock_sessions
  ADD CONSTRAINT mock_sessions_user1_id_profiles_fkey
  FOREIGN KEY (user1_id) REFERENCES public.profiles(id) ON DELETE NO ACTION NOT VALID;

ALTER TABLE public.mock_sessions
  ADD CONSTRAINT mock_sessions_user2_id_profiles_fkey
  FOREIGN KEY (user2_id) REFERENCES public.profiles(id) ON DELETE NO ACTION NOT VALID;

ALTER TABLE public.course_assignments
  ADD CONSTRAINT course_assignments_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.course_instructors
  ADD CONSTRAINT course_instructors_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.certificates            VALIDATE CONSTRAINT certificates_user_id_profiles_fkey;
ALTER TABLE public.assignment_submissions  VALIDATE CONSTRAINT assignment_submissions_user_id_profiles_fkey;
ALTER TABLE public.video_analytics         VALIDATE CONSTRAINT video_analytics_user_id_profiles_fkey;
ALTER TABLE public.blog_posts              VALIDATE CONSTRAINT blog_posts_author_id_profiles_fkey;
ALTER TABLE public.content_discussions     VALIDATE CONSTRAINT content_discussions_user_id_profiles_fkey;
ALTER TABLE public.mock_sessions           VALIDATE CONSTRAINT mock_sessions_user1_id_profiles_fkey;
ALTER TABLE public.mock_sessions           VALIDATE CONSTRAINT mock_sessions_user2_id_profiles_fkey;
ALTER TABLE public.course_assignments      VALIDATE CONSTRAINT course_assignments_user_id_profiles_fkey;
ALTER TABLE public.course_instructors      VALIDATE CONSTRAINT course_instructors_user_id_profiles_fkey;

COMMIT;

-- PostgREST caches the schema; the embeds stay broken until it reloads.
NOTIFY pgrst, 'reload schema';
