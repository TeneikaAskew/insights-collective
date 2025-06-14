
-- Create blog_posts table to replace mock data
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  excerpt text NOT NULL,
  slug text UNIQUE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  image_url text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  featured boolean DEFAULT false,
  seo_title text,
  seo_description text,
  category_id uuid,
  view_count integer DEFAULT 0,
  read_time integer DEFAULT 0,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create blog_categories table for better category management
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create blog_post_tags table for tag management
CREATE TABLE IF NOT EXISTS public.blog_post_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_post_id uuid REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  tag_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(blog_post_id, tag_name)
);

-- Create blog_post_views table for analytics tracking
CREATE TABLE IF NOT EXISTS public.blog_post_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  post_slug text NOT NULL,
  visitor_id text NOT NULL,
  view_duration integer DEFAULT 0,  
  view_date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Add foreign key constraint for categories
ALTER TABLE public.blog_posts 
ADD CONSTRAINT fk_blog_posts_category 
FOREIGN KEY (category_id) REFERENCES public.blog_categories(id) ON DELETE SET NULL;

-- Enable RLS on all blog tables
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blog_posts
CREATE POLICY "Public can view published blog posts" ON public.blog_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Authenticated users can view all blog posts" ON public.blog_posts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authors can manage their own posts" ON public.blog_posts
  FOR ALL TO authenticated USING (author_id = auth.uid());

CREATE POLICY "Admins can manage all blog posts" ON public.blog_posts
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND 'admin' = ANY(profiles.roles)
    )
  );

-- RLS Policies for blog_categories
CREATE POLICY "Anyone can view categories" ON public.blog_categories
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories" ON public.blog_categories
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND 'admin' = ANY(profiles.roles)
    )
  );

-- RLS Policies for blog_post_tags
CREATE POLICY "Anyone can view tags" ON public.blog_post_tags
  FOR SELECT USING (true);

CREATE POLICY "Authors can manage tags for their posts" ON public.blog_post_tags
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM blog_posts 
      WHERE blog_posts.id = blog_post_tags.blog_post_id 
      AND blog_posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all tags" ON public.blog_post_tags
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND 'admin' = ANY(profiles.roles)
    )
  );

-- RLS Policies for blog_post_views
CREATE POLICY "Anyone can insert views" ON public.blog_post_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authors can view stats for their posts" ON public.blog_post_views
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM blog_posts 
      WHERE blog_posts.id = blog_post_views.post_id 
      AND blog_posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all analytics" ON public.blog_post_views
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND 'admin' = ANY(profiles.roles)
    )
  );

-- Create updated_at trigger for blog_posts
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_posts_updated_at_trigger
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_posts_updated_at();

-- Insert some default categories
INSERT INTO public.blog_categories (name, slug, description) VALUES
  ('Fundamentals', 'fundamentals', 'Core concepts and foundational knowledge'),
  ('Career', 'career', 'Career development and guidance'),
  ('Technical', 'technical', 'Technical tutorials and deep dives'),
  ('Industry', 'industry', 'Industry trends and insights'),
  ('Case Studies', 'case-studies', 'Real-world examples and case studies'),
  ('Tools', 'tools', 'Tool reviews and tutorials'),
  ('Ethics', 'ethics', 'Ethics and best practices')
ON CONFLICT (name) DO NOTHING;

-- Create function to get blog post with tags
CREATE OR REPLACE FUNCTION get_blog_post_with_tags(post_slug text)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  excerpt text,
  slug text,
  author_id uuid,
  image_url text,
  status text,
  featured boolean,
  seo_title text,
  seo_description text,
  category_name text,
  view_count integer,
  read_time integer,
  published_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  tags text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.title,
    bp.content,
    bp.excerpt,
    bp.slug,
    bp.author_id,
    bp.image_url,
    bp.status,
    bp.featured,
    bp.seo_title,
    bp.seo_description,
    bc.name as category_name,
    bp.view_count,
    bp.read_time,
    bp.published_at,
    bp.created_at,
    bp.updated_at,
    COALESCE(
      ARRAY(
        SELECT bpt.tag_name 
        FROM blog_post_tags bpt 
        WHERE bpt.blog_post_id = bp.id
      ), 
      ARRAY[]::text[]
    ) as tags
  FROM blog_posts bp
  LEFT JOIN blog_categories bc ON bp.category_id = bc.id
  WHERE bp.slug = post_slug;
END;
$$;
