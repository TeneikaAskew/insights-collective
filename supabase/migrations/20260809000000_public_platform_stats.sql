-- Public platform statistics for the signed-out home page.
--
-- CTASection read three tables directly to build its trust markers, and one of
-- those reads could never succeed: `anon` holds no SELECT grant on
-- `enrollments`, so the query failed with 42501 on every load, logged a console
-- error, and left "Avg. Completion" showing a dash. Index redirects an
-- authenticated visitor to /dashboard, so every visitor that section renders for
-- is anonymous — the stat was unreachable by construction, not intermittently
-- broken.
--
-- Reading the table from the client cannot be made to work without granting anon
-- access to individual enrolment rows, which would expose who is enrolled in
-- what to the public internet. This returns the aggregate instead: three
-- integers, no row ever crossing the boundary.
--
-- SECURITY DEFINER, unlike the SECURITY INVOKER aggregates elsewhere in this
-- schema (course_roster_stats, form_submission_counts). Those work because their
-- callers can already read the underlying rows under RLS; this one exists
-- precisely because the caller cannot, and a definer function is the only way to
-- compute an average over rows the caller may not see. search_path is pinned so
-- the body cannot be redirected at a shadowed table.
create or replace function public.platform_stats()
returns table (
  published_courses integer,
  community_members integer,
  avg_completion integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.courses where published)::integer,
    -- Every account, not just learners: the UI labels this "Community Members"
    -- for that reason.
    (select count(*) from public.profiles)::integer,
    -- Enrolments with no recorded progress count as 0% rather than dropping out
    -- of the average, which is what the client-side version did.
    (select coalesce(round(avg(coalesce(completion_status, 0))), 0)
       from public.enrollments)::integer
$$;

comment on function public.platform_stats() is
  'Aggregate-only platform counters for the public home page. Returns no row-level data.';

-- EXECUTE is granted to PUBLIC by default on new functions, which would include
-- any future role; name the two roles that should have it instead.
revoke all on function public.platform_stats() from public;
grant execute on function public.platform_stats() to anon, authenticated;

-- Supabase's security advisor reports this function under
-- `anon_security_definer_function_executable`, and that is expected: its own
-- wording is "if that is not intentional", and here it is the point. What
-- bounds the exposure is that the function takes no arguments, so there is
-- nothing to parameterise toward a particular row; returns three integers, so
-- no row can come back; and is STABLE, so it cannot write. Twenty-two functions
-- in this schema already carry the same advisory, including
-- admin_user_role_counts.
