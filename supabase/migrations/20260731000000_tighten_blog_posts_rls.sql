-- =====================================================================
-- SECURITY FIX: blog_posts draft visibility + authorship
-- =====================================================================
--
-- Background
-- ----------
-- 20250614194630 created blog_posts with these policies:
--   "Authenticated users can view all blog posts" FOR SELECT USING (true)
--   "Authors can manage their own posts"          FOR ALL    USING (author_id = auth.uid())
--   "Admins can manage all blog posts"            FOR ALL    USING (EXISTS ... profiles.roles)
--
-- Two problems:
--   1. USING (true) SELECT lets ANY authenticated user read every draft,
--      archived, and unpublished post.
--   2. The author FOR ALL policy lets ANY authenticated user INSERT/UPDATE/
--      DELETE posts they own — authorship is not restricted to a role, so a
--      plain student who reaches a create path can publish blog content.
--   3. The admin policy reads profiles.roles, the legacy self-writable mirror,
--      instead of the canonical user_roles table.
--
-- This migration replaces the blog_posts policies so that:
--   * the public still reads published posts,
--   * drafts are readable only by their author, admins, and instructors,
--   * only admins and instructors may author (and only their own rows),
--   * admin authorization goes through has_admin_access() (user_roles).
--
-- Authorship is intentionally admin-OR-instructor to match the admin-only
-- Manage Blog UI while preserving any instructor authoring workflow. To lock
-- authoring to admins only, drop the instructor branch in the two policies
-- below.
--
-- blog_categories / blog_post_tags / blog_post_views admin policies are also
-- repointed off profiles.roles onto has_admin_access() for consistency.

-- ---------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view published blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authenticated users can view all blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authors can manage their own posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can manage all blog posts" ON public.blog_posts;

-- Public + anon: only published posts are visible.
CREATE POLICY "Public can view published blog posts"
ON public.blog_posts
FOR SELECT
USING (status = 'published');

-- Authenticated non-public reads: author sees own drafts; admins and
-- instructors see everything (for the admin/authoring surfaces).
CREATE POLICY "Authors admins instructors can view posts"
ON public.blog_posts
FOR SELECT
TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_admin_access(auth.uid())
  OR 'instructor' = ANY(public.get_user_roles(auth.uid()))
);

-- Authoring is limited to admins and instructors, and only for their own rows.
CREATE POLICY "Instructors and admins manage own posts"
ON public.blog_posts
FOR ALL
TO authenticated
USING (
  author_id = auth.uid()
  AND (
    public.has_admin_access(auth.uid())
    OR 'instructor' = ANY(public.get_user_roles(auth.uid()))
  )
)
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.has_admin_access(auth.uid())
    OR 'instructor' = ANY(public.get_user_roles(auth.uid()))
  )
);

-- Admins may manage any post (canonical user_roles source).
CREATE POLICY "Admins can manage all blog posts"
ON public.blog_posts
FOR ALL
TO authenticated
USING (public.has_admin_access(auth.uid()))
WITH CHECK (public.has_admin_access(auth.uid()));

-- ---------------------------------------------------------------------
-- blog_categories — repoint admin policy off profiles.roles
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage categories" ON public.blog_categories;
CREATE POLICY "Admins can manage categories"
ON public.blog_categories
FOR ALL
TO authenticated
USING (public.has_admin_access(auth.uid()))
WITH CHECK (public.has_admin_access(auth.uid()));

-- ---------------------------------------------------------------------
-- blog_post_tags — repoint admin policy off profiles.roles
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage all tags" ON public.blog_post_tags;
CREATE POLICY "Admins can manage all tags"
ON public.blog_post_tags
FOR ALL
TO authenticated
USING (public.has_admin_access(auth.uid()))
WITH CHECK (public.has_admin_access(auth.uid()));

-- ---------------------------------------------------------------------
-- blog_post_views — repoint admin analytics read off profiles.roles
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all analytics" ON public.blog_post_views;
CREATE POLICY "Admins can view all analytics"
ON public.blog_post_views
FOR SELECT
TO authenticated
USING (public.has_admin_access(auth.uid()));
