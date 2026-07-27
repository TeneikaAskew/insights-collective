-- Atomic, anon-callable view counter for public blog posts.
--
-- Why this exists: the public blog is read overwhelmingly by anonymous
-- visitors, but `blog_posts` has no UPDATE policy for `anon` (see
-- 20260728002000_tighten_blog_posts_rls.sql — anon gets SELECT on published
-- rows only). A client-side `update({ view_count: n + 1 })` therefore matches
-- zero rows and fails silently, which is why view counts never moved.
--
-- A SECURITY DEFINER function is the narrow way to allow exactly one
-- privileged write without opening `blog_posts` to anonymous UPDATE. It also
-- makes the increment atomic; the previous client-side read-then-write lost
-- counts under concurrency.

CREATE OR REPLACE FUNCTION public.increment_blog_post_view(p_post_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
-- Pin the search path: a SECURITY DEFINER function without this can be
-- hijacked via a caller-controlled search_path.
SET search_path = public, pg_temp
AS $$
  UPDATE public.blog_posts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_post_id
    -- Only published posts accrue views. This also stops the function being
    -- used as an oracle to probe which draft ids exist.
    AND status = 'published';
$$;

COMMENT ON FUNCTION public.increment_blog_post_view(uuid) IS
  'Atomically increments view_count for a published blog post. SECURITY DEFINER so anonymous readers can be counted without granting anon UPDATE on blog_posts.';

REVOKE ALL ON FUNCTION public.increment_blog_post_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_blog_post_view(uuid) TO anon, authenticated;
