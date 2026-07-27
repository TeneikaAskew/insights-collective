-- Server-side aggregates for two admin surfaces that previously tallied rows
-- client-side.
--
-- Why: both hooks issued an unbounded `select` and counted the result in JS.
-- PostgREST caps a response at max-rows (1,000 by default), so past that cap
-- the client silently sees only the first page — forms beyond it report zero
-- submissions, and courses beyond it report an empty roster and an understated
-- average progress. Wrong numbers presented as real ones, with nothing to
-- signal the truncation.
--
-- Aggregating in the database returns one row per form/course regardless of how
-- many underlying rows there are.
--
-- SECURITY INVOKER (the default): these run with the caller's privileges, so
-- RLS on form_submissions / enrollments still applies and no data is exposed
-- that a direct select would not already return.

-- One row per form that has at least one submission.
CREATE OR REPLACE FUNCTION public.form_submission_counts()
RETURNS TABLE (form_id uuid, submission_count bigint)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT fs.form_id, count(*)::bigint
  FROM public.form_submissions fs
  WHERE fs.form_id IS NOT NULL
  GROUP BY fs.form_id;
$$;

COMMENT ON FUNCTION public.form_submission_counts() IS
  'Per-form submission counts, aggregated server-side so the admin forms list is not truncated by the PostgREST row cap.';

-- One row per course that has at least one enrollment. avg_progress mirrors the
-- completion_status column the course drawer displays, so the roster column and
-- the drawer cannot disagree.
CREATE OR REPLACE FUNCTION public.course_roster_stats()
RETURNS TABLE (course_id uuid, enrolled bigint, avg_progress numeric)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    e.course_id,
    count(*)::bigint,
    round(avg(coalesce(e.completion_status, 0)))::numeric
  FROM public.enrollments e
  WHERE e.course_id IS NOT NULL
  GROUP BY e.course_id;
$$;

COMMENT ON FUNCTION public.course_roster_stats() IS
  'Per-course enrollment count and average completion, aggregated server-side so the Manage Courses roster is not truncated by the PostgREST row cap.';

REVOKE ALL ON FUNCTION public.form_submission_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.course_roster_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.form_submission_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.course_roster_stats() TO authenticated;
