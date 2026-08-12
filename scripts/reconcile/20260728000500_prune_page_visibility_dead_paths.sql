-- ABOUTME: Verifies that 20260728000500_prune_page_visibility_dead_paths.sql's
-- ABOUTME: effects hold in the live database, and records it only if so.
--
-- WHY THIS FILE EXISTS
--
-- The migration was numbered 20260728000000, the same version as
-- 20260728000000_hide_quiz_answer_key.sql. Supabase tracks by version, so the
-- version was recorded once — for hide_quiz_answer_key, as the recorded row's
-- name still shows — and the prune migration was silently skipped. It has never
-- run against production. Renumbering it to 20260728000500 makes it pending,
-- and the question becomes how to settle that: run it, or record it.
--
-- Running it is the wrong answer, and not for a cautious reason. Its closing
-- INSERT seeds 28 canonical paths, two of which — /user-dashboard and /calendar
-- — have since been retired from src/config/pageManifest.ts. Executing it today
-- would insert rows for two pages that no longer exist, which is precisely the
-- dead-row drift its own DELETE was written to clear. The in-app Sync
-- (PageVisibilityContext.syncAvailablePages) performs the same reconciliation
-- and has kept the table current; that is why the live state already matches
-- the manifest despite the migration never running.
--
-- So this script asserts the migration's durable intent, which Sync has
-- independently satisfied, and records the version. The assertions and the
-- INSERT share one transaction, so they cannot disagree.
--
-- WHAT IS ASSERTED, AND WHAT DELIBERATELY IS NOT
--
--   1. No page_visibility row lies outside the migration's canonical list.
--      This is the DELETE's effect and the load-bearing half: a row for a dead
--      route is a page an admin can toggle that no longer resolves.
--   2. '/' and '/blog' are visible to both users and instructors. This is the
--      UPDATE's effect, and the one with teeth — these flags predate
--      enforcement, and left set they take the landing page and blog dark.
--   3. Every path in the migration's list that is STILL current has a row.
--
-- Point 3 is the deliberate narrowing, and it is stated rather than hidden: the
-- migration's seed is not asserted for /user-dashboard and /calendar, because
-- the manifest no longer contains them and Sync has correctly removed them. A
-- script that demanded all 28 would fail forever on two paths whose absence is
-- the correct end state.

begin;

-- 1. No row outside what is legitimately allowed to be there.
--
-- That set is the union of two lists, and it has to be, because "stale" is not
-- the same question as "in the migration's list". The migration's list is a
-- snapshot of 2026-07-28; the manifest has grown since. Sync creates a row for
-- every CURRENT manifest path, so a path added after that date — today,
-- /resources/salary-guide — is a perfectly valid row that the July list knows
-- nothing about. Judging it against the snapshot alone would abort this script
-- on a database that is entirely correct.
--
-- The second list is a snapshot too, taken 2026-08-11 from
-- src/config/pageManifest.ts. That is acceptable here in a way it would not be
-- in application code: this script runs once, to record one version, and is
-- then history. If it is ever re-run long afterwards, refresh the list from the
-- manifest first.
do $$
declare
  v_stale text;
begin
  select string_agg(pv.page_path, ', ')
    into v_stale
    from public.page_visibility pv
   where pv.page_path not in (
     -- The migration's own canonical list (2026-07-28).
     '/', '/dashboard', '/user-dashboard', '/notifications', '/calendar',
     '/profile', '/courses', '/course-management', '/enrolled-courses',
     '/interview-prep', '/interview-prep/code-practice',
     '/interview-prep/job-description', '/interview-prep/mock-interview-room',
     '/interview-prep/mock-interviews', '/interview-prep/star-practice',
     '/career-pathway', '/assistants', '/explore-data-careers', '/resume',
     '/events', '/messages', '/portfolio-explorer', '/portfolio-editor',
     '/blog', '/resources', '/teneika-linkedin', '/teneika-tweets', '/survey',
     -- Manifest paths added since (2026-08-11 snapshot).
     '/resources/salary-guide'
   );

  if v_stale is not null then
    raise exception
      'page_visibility holds rows outside the migration''s canonical list: %',
      v_stale;
  end if;

  raise notice 'OK: no page_visibility row lies outside the canonical list.';
end $$;

-- 2. The flags the migration resets are reset.
do $$
declare
  v_bad text;
begin
  select string_agg(page_path, ', ')
    into v_bad
    from public.page_visibility
   where page_path in ('/', '/blog')
     and not (visible_to_users and visible_to_instructors);

  if v_bad is not null then
    raise exception
      'these should be visible to users and instructors but are not: %', v_bad;
  end if;

  if (select count(*) from public.page_visibility
       where page_path in ('/', '/blog')) <> 2 then
    raise exception 'expected rows for both / and /blog';
  end if;

  raise notice 'OK: / and /blog are visible to users and instructors.';
end $$;

-- 3. Every still-current path from the migration's seed has a row.
--    /user-dashboard and /calendar are excluded by design — see the header.
do $$
declare
  v_missing text;
begin
  select string_agg(p, ', ')
    into v_missing
    from unnest(array[
      '/', '/dashboard', '/notifications', '/profile', '/courses',
      '/course-management', '/enrolled-courses', '/interview-prep',
      '/interview-prep/code-practice', '/interview-prep/job-description',
      '/interview-prep/mock-interview-room', '/interview-prep/mock-interviews',
      '/interview-prep/star-practice', '/career-pathway', '/assistants',
      '/explore-data-careers', '/resume', '/events', '/messages',
      '/portfolio-explorer', '/portfolio-editor', '/blog', '/resources',
      '/teneika-linkedin', '/teneika-tweets', '/survey'
    ]) as p
   where not exists (
     select 1 from public.page_visibility pv where pv.page_path = p
   );

  if v_missing is not null then
    raise exception 'canonical paths with no page_visibility row: %', v_missing;
  end if;

  raise notice 'OK: every still-current seeded path has a row.';
end $$;

insert into supabase_migrations.schema_migrations (version)
values ('20260728000500');

commit;
