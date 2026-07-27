-- =====================================================================
-- FIX: every public blog post renders "Unknown Author"
-- =====================================================================
--
-- Background
-- ----------
-- blogService resolves a post's byline by looking author_id up in
-- public.profiles and falling back to the literal 'Unknown Author' when the
-- lookup returns nothing. RLS on profiles grants `anon` no read at all, so for
-- a signed-out visitor — the overwhelming majority of blog traffic — every
-- lookup comes back empty and every post is attributed to "Unknown Author".
--
-- Measured on the live project before this migration:
--     distinct authors of published posts : 2
--     profiles readable as anon           : 0
--
-- Why not just grant anon read on profiles
-- ----------------------------------------
-- That is the one-line fix and it is the wrong one: it would publish every
-- user's profile row — including users who have never written anything — to
-- the entire internet in order to render a byline.
--
-- This function is the proportionate version. It exposes exactly two columns,
-- and only for users who have authored a post that is already public. Nothing
-- here is readable that a visitor could not already infer from the blog
-- itself: if a post is published, its author's display name is a byline by
-- definition.
--
-- SECURITY DEFINER is required — the caller is `anon`, who cannot read
-- profiles — so the function pins its search_path and returns a fixed,
-- non-parameterised projection. There is no input to inject through.

CREATE OR REPLACE FUNCTION public.blog_post_authors()
RETURNS TABLE (id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT
    p.id,
    NULLIF(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') AS display_name
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1
    FROM public.blog_posts b
    WHERE b.author_id = p.id
      AND b.status = 'published'
  );
$$;

COMMENT ON FUNCTION public.blog_post_authors() IS
  'Display names of users who have authored at least one PUBLISHED blog post. SECURITY DEFINER so anonymous readers can render bylines without granting anon read on profiles. Returns no row for any user who has not published.';

REVOKE ALL ON FUNCTION public.blog_post_authors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blog_post_authors() TO anon, authenticated;

-- Fail the migration if the function leaks beyond published authors, rather
-- than shipping a widened surface that looks fine.
DO $$
DECLARE
  exposed  bigint;
  expected bigint;
BEGIN
  SELECT count(*) INTO exposed  FROM public.blog_post_authors();
  SELECT count(DISTINCT b.author_id) INTO expected
    FROM public.blog_posts b
    WHERE b.status = 'published' AND b.author_id IS NOT NULL;

  IF exposed <> expected THEN
    RAISE EXCEPTION
      'blog_post_authors() returned % rows but only % users have published a post', exposed, expected;
  END IF;

  RAISE NOTICE 'blog_post_authors() exposes % published author(s), as expected.', exposed;
END $$;
