-- ABOUTME: Verifies that 20260801000300_profiles_foreign_keys.sql's effects are
-- ABOUTME: present in the live database, and records it in the ledger only if so.
--
-- WHY THIS FILE EXISTS
--
-- RECONCILE (db-migrate.yml) reconciles a pending migration by running it with
-- errors tolerated, so "already exists" is skipped and anything genuinely
-- missing is created. That method cannot work on this migration, and the reason
-- is worth stating exactly:
--
--   20260801000300_profiles_foreign_keys.sql opens with BEGIN;. The first
--   "already exists" aborts that transaction, so every later statement returns
--   "current transaction is aborted" WITHOUT RUNNING. Error-tolerant mode would
--   attempt one statement and abandon the other twenty-odd, then record the
--   version — asserting an end state nobody established.
--
-- So RECONCILE sets it aside and fails, by design, and this script is the
-- "person confirms its effects are present" half of that handoff. It asserts,
-- rather than assumes, and records the version in the same transaction as the
-- assertions so the two can never disagree.
--
-- WHAT THE MIGRATION CLAIMS, AND SO WHAT THIS CHECKS
--
--   1. Every auth.users row has a public.profiles row. This is load-bearing:
--      the nine foreign keys below reference profiles(id), so a gap here means
--      those users could never write a certificate, submission or discussion.
--   2. Every auth.users row has a public.user_roles row. Not load-bearing for
--      the constraints, but the migration performs this INSERT, and recording
--      the version asserts the whole file ran.
--   3. Nine foreign keys exist, each on the right table and column, each
--      pointing at public.profiles(id), each VALIDATED, and each with the
--      ON DELETE action the migration specified.
--
-- The delete actions are checked and not treated as cosmetic. The migration
-- mirrors each column's existing auth.users key on purpose: profiles.id
-- cascades from auth.users, so a NO ACTION key on a column whose auth.users key
-- CASCADEs would block the cascade and make user deletion fail outright. A
-- constraint that exists with the wrong action is a live defect, not a
-- near-miss, so it fails this check rather than passing as "present".
--
-- VALIDATED is checked separately from existing because the migration adds each
-- key NOT VALID and then VALIDATEs it. A key left NOT VALID applies to new rows
-- only and has never checked the rows already there — present, but not what the
-- migration claims.
--
-- Every problem is collected and reported together. Failing on the first one
-- would mean a person fixes it, re-runs, and discovers the next.
--
-- Safe to run repeatedly: it only reads, and the ledger INSERT is guarded.

DO $$
DECLARE
  v_missing_profiles integer;
  v_missing_roles    integer;
  v_problems         text := '';
  v_constraint_probs text;
  v_present          integer;
BEGIN
  ----------------------------------------------------------------------------
  -- 1. The backfill
  ----------------------------------------------------------------------------
  SELECT count(*) INTO v_missing_profiles
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

  RAISE NOTICE 'auth.users rows with no profiles row: %', v_missing_profiles;

  IF v_missing_profiles > 0 THEN
    v_problems := v_problems || format(
      E'\n  - %s auth.users row(s) still have no public.profiles row. The nine '
       'foreign keys reference profiles(id), so these accounts cannot write.',
      v_missing_profiles);
  END IF;

  SELECT count(*) INTO v_missing_roles
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id);

  RAISE NOTICE 'auth.users rows with no user_roles row: %', v_missing_roles;

  IF v_missing_roles > 0 THEN
    v_problems := v_problems || format(
      E'\n  - %s auth.users row(s) still have no public.user_roles row, which '
       'this migration also backfills.',
      v_missing_roles);
  END IF;

  ----------------------------------------------------------------------------
  -- 2. The nine foreign keys
  --
  -- confdeltype: 'a' = NO ACTION, 'c' = CASCADE (pg_constraint's encoding).
  ----------------------------------------------------------------------------
  WITH expected(tbl, col, con, deltype) AS (
    VALUES
      ('certificates',           'user_id',   'certificates_user_id_profiles_fkey',           'a'),
      ('assignment_submissions', 'user_id',   'assignment_submissions_user_id_profiles_fkey', 'a'),
      ('video_analytics',        'user_id',   'video_analytics_user_id_profiles_fkey',        'c'),
      ('blog_posts',             'author_id', 'blog_posts_author_id_profiles_fkey',           'c'),
      ('content_discussions',    'user_id',   'content_discussions_user_id_profiles_fkey',    'c'),
      ('mock_sessions',          'user1_id',  'mock_sessions_user1_id_profiles_fkey',         'a'),
      ('mock_sessions',          'user2_id',  'mock_sessions_user2_id_profiles_fkey',         'a'),
      ('course_assignments',     'user_id',   'course_assignments_user_id_profiles_fkey',     'c'),
      ('course_instructors',     'user_id',   'course_instructors_user_id_profiles_fkey',     'c')
  ),
  actual AS (
    -- confkey is resolved, not just confrelid. Checking only the referenced
    -- TABLE would accept a same-named, validated key pointing at some other
    -- unique column on profiles — the constraint would exist, be valid, and
    -- still not be the profiles(id) relationship PostgREST needs to embed
    -- through. The column count is checked for the same reason: conkey[1]
    -- alone would silently accept a composite key on its first column.
    SELECT c.conname::text        AS con,
           rel.relname::text      AS tbl,
           att.attname::text      AS col,
           c.confdeltype::text    AS deltype,
           c.convalidated         AS validated,
           fre.relname::text      AS ref_tbl,
           refatt.attname::text   AS ref_col,
           array_length(c.conkey, 1)   AS ncols,
           array_length(c.confkey, 1)  AS nrefcols
    FROM pg_constraint c
    JOIN pg_class     rel ON rel.oid = c.conrelid
    JOIN pg_namespace n   ON n.oid   = rel.relnamespace
    JOIN pg_class     fre ON fre.oid = c.confrelid
    JOIN pg_namespace fn  ON fn.oid  = fre.relnamespace
    JOIN pg_attribute att ON att.attrelid = c.conrelid
                         AND att.attnum   = c.conkey[1]
    JOIN pg_attribute refatt ON refatt.attrelid = c.confrelid
                            AND refatt.attnum   = c.confkey[1]
    WHERE c.contype = 'f'
      AND n.nspname  = 'public'
      AND fn.nspname = 'public'
  )
  SELECT string_agg(problem, ''), count(*) FILTER (WHERE problem IS NULL)
    INTO v_constraint_probs, v_present
  FROM (
    SELECT
      CASE
        WHEN a.con IS NULL THEN
          format(E'\n  - MISSING   %s on public.%s(%s)', e.con, e.tbl, e.col)
        WHEN a.tbl <> e.tbl OR a.col <> e.col THEN
          format(E'\n  - WRONG COLUMN %s is on public.%s(%s), expected public.%s(%s)',
                 e.con, a.tbl, a.col, e.tbl, e.col)
        WHEN a.ref_tbl <> 'profiles' OR a.ref_col <> 'id' THEN
          format(E'\n  - WRONG TARGET %s references public.%s(%s), expected public.profiles(id)',
                 e.con, a.ref_tbl, a.ref_col)
        WHEN a.ncols <> 1 OR a.nrefcols <> 1 THEN
          format(E'\n  - COMPOSITE %s spans %s column(s) referencing %s column(s); '
                  'this migration specifies a single-column key', e.con, a.ncols, a.nrefcols)
        WHEN NOT a.validated THEN
          format(E'\n  - NOT VALIDATED %s exists but is NOT VALID, so the rows that '
                  'were already there have never been checked', e.con)
        WHEN a.deltype <> e.deltype THEN
          format(E'\n  - WRONG ON DELETE %s is %s, expected %s. Mismatched actions can '
                  'block user deletion entirely.',
                 e.con,
                 CASE a.deltype WHEN 'a' THEN 'NO ACTION' WHEN 'c' THEN 'CASCADE'
                                WHEN 'r' THEN 'RESTRICT'  WHEN 'n' THEN 'SET NULL'
                                WHEN 'd' THEN 'SET DEFAULT' ELSE a.deltype END,
                 CASE e.deltype WHEN 'a' THEN 'NO ACTION' WHEN 'c' THEN 'CASCADE'
                                ELSE e.deltype END)
        ELSE NULL
      END AS problem
    FROM expected e
    LEFT JOIN actual a ON a.con = e.con
  ) checked;

  RAISE NOTICE 'foreign keys present, validated and correct: % of 9', v_present;

  IF v_constraint_probs IS NOT NULL THEN
    v_problems := v_problems || v_constraint_probs;
  END IF;

  ----------------------------------------------------------------------------
  -- 3. Verdict
  ----------------------------------------------------------------------------
  IF v_problems <> '' THEN
    -- RAISE's placeholder is %, not %s. format() inside the CASE arms above is
    -- the one that takes %s; mixing them up leaves a stray 's' in the message.
    RAISE EXCEPTION
      E'20260801000300_profiles_foreign_keys.sql has NOT fully taken effect. '
       'Nothing recorded. Outstanding:%',
      v_problems;
  END IF;

  RAISE NOTICE 'All checks passed. Recording 20260801000300.';
END $$;

-- Reached only if every assertion above held, because a RAISE EXCEPTION aborts
-- the transaction this runs in. ON CONFLICT so a second run is a no-op rather
-- than a duplicate-key failure that looks like something went wrong.
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('20260801000300')
ON CONFLICT DO NOTHING;

-- The migration's own last statement, and the reason it is repeated here: the
-- constraints are only half the effect. PostgREST caches the relationships it
-- can embed through, and the migration ends with this NOTIFY because the embeds
-- stay broken until it reloads. If these keys were installed by hand, or by a
-- process that stopped before the notification, every assertion above passes
-- while the user-facing symptom — "Error loading submissions" on the grading
-- page — is still there.
--
-- Recording the version would then mark the migration permanently done while
-- the thing it was written to fix remains visibly broken. Issuing it costs
-- nothing when the cache is already fresh, so it runs unconditionally.
-- Delivered on commit, so it is sent only if every assertion held.
NOTIFY pgrst, 'reload schema';

SELECT version
FROM supabase_migrations.schema_migrations
WHERE version = '20260801000300';
