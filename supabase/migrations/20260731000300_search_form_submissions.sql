-- =====================================================================
-- Server-side, paginated search over form submissions
-- =====================================================================
-- The admin submissions list previously filtered client-side over only the
-- current 10-row page, so a search silently missed matches on other pages.
-- This function searches the whole submission set for a form (submission JSON,
-- submitter name, and user id) and returns one page plus the total match count
-- via a window function.
--
-- SECURITY INVOKER: the function runs under the caller's RLS, so it can only
-- return submissions/profiles the caller is already allowed to read (admins via
-- the form_submissions/profiles admin SELECT policies). It grants no new access.

CREATE OR REPLACE FUNCTION public.search_form_submissions(
  p_form_id uuid,
  p_search text,
  p_limit int,
  p_offset int
)
RETURNS TABLE (
  id uuid,
  form_id uuid,
  user_id uuid,
  submission_data jsonb,
  created_at timestamptz,
  first_name text,
  last_name text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT s.id, s.form_id, s.user_id, s.submission_data, s.created_at,
           p.first_name, p.last_name
    FROM public.form_submissions s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE s.form_id = p_form_id
      AND (
        p_search IS NULL OR btrim(p_search) = ''
        OR s.submission_data::text ILIKE '%' || p_search || '%'
        OR coalesce(p.first_name, '') ILIKE '%' || p_search || '%'
        OR coalesce(p.last_name, '') ILIKE '%' || p_search || '%'
        OR s.user_id::text ILIKE '%' || p_search || '%'
      )
  )
  SELECT f.id, f.form_id, f.user_id, f.submission_data, f.created_at,
         f.first_name, f.last_name,
         count(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.search_form_submissions(uuid, text, int, int) TO authenticated;
