-- Fix blog table RLS policies to use security definer functions

-- Drop existing admin policies that cause recursion
DROP POLICY IF EXISTS "Admins can manage categories" ON blog_categories;
DROP POLICY IF EXISTS "Admins can manage all tags" ON blog_post_tags;
DROP POLICY IF EXISTS "Admins can view all analytics" ON blog_post_views;
DROP POLICY IF EXISTS "Admins can manage all blog posts" ON blog_posts;

-- Create new policies using security definer functions
CREATE POLICY "blog_categories_admin_access" ON blog_categories
  FOR ALL TO authenticated
  USING (public.has_admin_access(auth.uid()));

CREATE POLICY "blog_post_tags_admin_access" ON blog_post_tags
  FOR ALL TO authenticated
  USING (public.has_admin_access(auth.uid()));

CREATE POLICY "blog_post_views_admin_access" ON blog_post_views
  FOR SELECT TO authenticated
  USING (public.has_admin_access(auth.uid()));

CREATE POLICY "blog_posts_admin_access" ON blog_posts
  FOR ALL TO authenticated
  USING (public.has_admin_access(auth.uid()));