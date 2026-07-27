-- =====================================================================
-- Server-side search / filter / pagination for the admin Users list
-- =====================================================================
-- The admin Users page fetched every profile plus every user's roles and then
-- searched, role-filtered, and (soon) paginated in the browser. These two
-- admin-gated functions move that work into the database so the page can load
-- one page at a time.
--
-- Both are SECURITY DEFINER (they read across all profiles/user_roles) and are
-- therefore explicitly gated to admins via has_admin_access(auth.uid()); a
-- non-admin caller gets zero rows.

-- Paginated, searchable, role-filterable user list + total match count.
CREATE OR REPLACE FUNCTION public.search_admin_users(
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
  bio text,
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
      pr.id, pr.first_name, pr.last_name, pr.avatar_url, pr.bio, pr.created_at,
      COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL),
               ARRAY[]::app_role[]) AS roles
    FROM public.profiles pr
    LEFT JOIN public.user_roles ur ON ur.user_id = pr.id
    WHERE public.has_admin_access(auth.uid())  -- admin gate (DEFINER)
    GROUP BY pr.id, pr.first_name, pr.last_name, pr.avatar_url, pr.bio, pr.created_at
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
  SELECT f.id, f.first_name, f.last_name, f.avatar_url, f.bio, f.created_at, f.roles,
         count(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.search_admin_users(text, text, int, int) TO authenticated;

-- Global per-role counts for the tab badges (independent of search/paging).
CREATE OR REPLACE FUNCTION public.admin_user_role_counts()
RETURNS TABLE (total bigint, students bigint, instructors bigint, admins bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.user_roles WHERE role = 'student'::app_role),
    (SELECT count(*) FROM public.user_roles WHERE role = 'instructor'::app_role),
    (SELECT count(*) FROM public.user_roles WHERE role = 'admin'::app_role)
  WHERE public.has_admin_access(auth.uid());  -- admin gate (DEFINER)
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_role_counts() TO authenticated;
