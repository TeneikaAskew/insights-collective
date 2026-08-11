-- =====================================================================
-- Drop profiles.bio
-- =====================================================================
-- The bio textarea has been removed from the profile page, which was the only
-- place in the app that ever wrote this column. Rather than leave a field that
-- admins can see but nobody can edit or clear, the column goes too.
--
-- Only one database object read it: search_admin_users, which returned bio as
-- part of the admin Users list. Its return type has to change, and a plain
-- CREATE OR REPLACE cannot alter a function's signature, so it is dropped and
-- recreated below. That has to happen BEFORE the column is dropped, because a
-- non-atomic SQL function body carries no dependency on the columns it reads:
-- Postgres would let the column drop succeed and leave the function to fail at
-- call time instead.
--
-- The 10 rows holding bio text at the time of this migration all belonged to
-- seeded @example.com demo accounts, not to real users.

DROP FUNCTION IF EXISTS public.search_admin_users(text, text, int, int);

CREATE FUNCTION public.search_admin_users(
  p_search text,
  p_role text,
  p_limit int,
  p_offset int
)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamptz,
  roles app_role[],
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      pr.id, pr.first_name, pr.last_name, pr.avatar_url, pr.created_at,
      COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL),
               ARRAY[]::app_role[]) AS roles
    FROM public.profiles pr
    LEFT JOIN public.user_roles ur ON ur.user_id = pr.id
    WHERE public.has_admin_access(auth.uid())  -- admin gate (DEFINER)
    GROUP BY pr.id, pr.first_name, pr.last_name, pr.avatar_url, pr.created_at
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (
        p_search IS NULL OR btrim(p_search) = ''
        OR (coalesce(first_name, '') || ' ' || coalesce(last_name, '')) ILIKE '%' || p_search || '%'
      )
      AND (
        p_role IS NULL OR p_role = 'all'
        -- Compare as text so an invalid p_role never errors on an enum cast.
        OR p_role = ANY(roles::text[])
        -- Users with no explicit rows are treated as students.
        OR (p_role = 'student' AND cardinality(roles) = 0)
      )
  )
  SELECT f.id, f.first_name, f.last_name, f.avatar_url, f.created_at, f.roles,
         count(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.search_admin_users(text, text, int, int) TO authenticated;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS bio;
