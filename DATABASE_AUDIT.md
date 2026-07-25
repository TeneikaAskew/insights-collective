# Database Audit — Insight Collective (siuqvhscuiycvdrtiqsh)

**Date:** 2026-07-25. Live review of schema, data integrity, RLS rules, and Supabase security/performance advisors.

## Data integrity: CLEAN

Checked every course-flow relationship on the live database — all pass with **zero problems**:
- No orphans: enrollments→courses/profiles, modules→courses, content_items→modules, assignment_submissions→assignments, quiz_submissions→quizzes, certificates→courses, progressions→content_items, quizzes→content_items, assignments→courses
- No duplicate certificate verification codes
- No published courses without modules
- Every profile has a `user_roles` row (68 profiles / 76 role rows)

**Content cleanup needed (data, not code):** 3 modules in the *published* "Visualization with Tableau" course (titled FIRST/SECOND/THIRD) have Lorem Ipsum descriptions; course artwork across the catalog is stock unsplash URLs stored in `image_url`.

## Schema reality

- 103 tables in `public`, **all with RLS enabled**.
- The repo's `supabase/migrations/` folder contains many migrations that were **never applied** (live DB has 44 applied migrations). That is why `grades`, `grade_history`, `lesson_completions`, `lesson_completion_requirements`, `content_progress`, `submission_comments`, and `grading_sessions` don't exist — matching the code-side findings in `COURSES_FALLBACK_AUDIT.md`. Decide deliberately per feature whether to apply those migrations or drop the migration files; don't let the folder imply state that isn't real.

## Security fixes APPLIED (3 migrations)

1. **`module_progressions` was deny-all** (RLS enabled, zero policies) — every client read silently returned no rows. Added own-rows read/write policies + instructor/admin read.
2. **Instructors couldn't see student progress**: `content_item_progressions` had own-rows-only SELECT, so instructor insight views were silently RLS-filtered to empty. Added an instructor/admin SELECT policy (mirroring the one `quiz_submissions` already had).
3. **Dropped 7 "always-true" policies that opened tables to public writes.** Policies named "Service role can …" with `USING/WITH CHECK (true)` are a misconception — the service role bypasses RLS entirely, so these policies only granted *client* write access to `tweets` (×2), `linkedin_posts` (×2), `scrape_metadata`, `progress_snapshots`, and `quiz_attempt_questions`. None had a legitimate client writer.
4. **Pinned `search_path`** on all 16 functions flagged as hijackable (`function_search_path_mutable`).
5. **Performance:** added covering indexes for 12 hot course-flow foreign keys (assignments, submissions, progressions, certificates, courses.instructor_id, etc. — these columns are hit on every course page load and inside RLS policies) and dropped 2 duplicate indexes.

Code fix landed alongside: `StudentInsightsDashboard` derived "modules completed" from `module_progressions`, which **nothing in the system writes** — it now derives module completion from real `content_item_progressions` data.

Security advisor lints: 116 → 108, with `rls_enabled_no_policy` eliminated and `rls_policy_always_true` reduced 10 → 3.

## Remaining items — deliberate tradeoffs (documented, not changed)

- `blog_post_views` "Anyone can insert views" — intentional anonymous view tracking.
- `events` "Authenticated users can create events" — the calendar UI inserts events client-side; tightening needs a `created_by = auth.uid()` check wired through the app.
- `notifications` service-role-named INSERT policy — **load-bearing**: `MockInterviews` inserts notifications for other users. Tightening requires moving that insert into a SECURITY DEFINER function. Until then, any authenticated user can insert notifications for anyone.
- 5 public storage buckets allow file **listing** (Blog Images, blog-media, Course Materials, project-images, user-avatars) — the blog media library depends on listing; restricting requires app changes.
- 41 SECURITY DEFINER functions callable by anon/authenticated — spot-checked the sensitive ones (`update_user_roles` correctly requires the caller to be admin via `auth.uid()`); a full review pass is future work.

## Remaining items — only you can do these (Supabase dashboard)

1. **Upgrade Postgres** — current 15.8.1.054 has outstanding security patches (Settings → Infrastructure).
2. **Enable leaked-password protection** (Auth → Providers → Password — HaveIBeenPwned check).

## Migration-folder reconciliation (2026-07-25)

The repo held 124 migration files but the live ledger only recorded 44. Object-level verification (probing every `CREATE TABLE` target against the live DB) classified them:

- **78 files: applied-but-unledgered** — all their objects exist live (they were executed directly, outside the ledger). `scripts/reconcile_migration_ledger.sql` records them in `supabase_migrations.schema_migrations` so `supabase db push` stops treating them as pending. ⚠️ **This script still needs to be run** — the Supabase connection dropped before it executed. It's idempotent.
- **1 file: partially applied with a live-code dependency** — `submission_attachments` (from `20250716000000-canvas-style-content-system.sql`) never existed, yet the assignment-submission page inserts into it, so **every file-upload attachment record has been failing**. Created via the `create_submission_attachments` migration (applied live, with own-rows + instructor RLS); table added to `types.ts`.
- **3 files: never applied, dead features** — moved to `supabase/migrations/unapplied/` with a README (grade-history stack, lesson-completions/grades/module-prerequisites stack, legacy content-blocks). Re-split deliberately if those features are ever built.
- **1 filename collision fixed** — two files shared version `20260412000000`; `fix_forms_rls_insert` renamed to `20260412000500`.

## Performance advisor backlog (informational)

- 263 policies re-evaluate `auth.uid()` per row (`auth_rls_initplan`) — wrapping as `(SELECT auth.uid())` across policies is a worthwhile sweep as data grows.
- 253 overlapping permissive policies — partially by design (own-rows + instructor policies); consolidation is optional.
- 44 unused indexes and ~60 remaining unindexed FKs on colder tables — revisit when usage patterns settle.
