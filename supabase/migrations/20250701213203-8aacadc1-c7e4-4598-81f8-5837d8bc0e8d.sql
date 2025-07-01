-- Create blog_settings table for persistent blog configuration
CREATE TABLE IF NOT EXISTS public.blog_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- General Settings
  blog_title text NOT NULL DEFAULT 'The Data Blueprint Series',
  blog_description text DEFAULT 'A comprehensive guide to breaking in, leveling up, and leading in data careers',
  blog_url text DEFAULT '',
  
  -- Data Blueprint Series Integration
  series_title text DEFAULT 'The Data Blueprint Series',
  series_description text DEFAULT 'A 10-Part Guide to Breaking In, Leveling Up, and Leading in Data Careers',
  series_url text DEFAULT '/data-blueprint-series',
  series_featured boolean DEFAULT true,
  
  -- SEO Defaults  
  default_meta_title text DEFAULT '',
  default_meta_description text DEFAULT '',
  default_meta_keywords text DEFAULT '',
  
  -- Site-wide SEO
  site_meta_title text DEFAULT 'Data Career Platform',
  site_meta_description text DEFAULT 'Your comprehensive platform for data career development',
  site_meta_keywords text DEFAULT 'data science, data analytics, career development',
  site_favicon_url text DEFAULT '',
  site_logo_url text DEFAULT '',
  
  -- Analytics
  google_analytics_id text DEFAULT '',
  google_tag_manager_id text DEFAULT '',
  enable_analytics boolean DEFAULT true,
  
  -- Comments & Social
  allow_comments boolean DEFAULT true,
  moderate_comments boolean DEFAULT true,
  social_sharing boolean DEFAULT true,
  
  -- Email Notifications
  email_notifications boolean DEFAULT true,
  notification_email text DEFAULT '',
  
  -- Publishing
  default_post_status text DEFAULT 'draft' CHECK (default_post_status IN ('draft', 'published')),
  auto_generate_excerpts boolean DEFAULT true,
  posts_per_page integer DEFAULT 10 CHECK (posts_per_page > 0 AND posts_per_page <= 50),
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view blog settings" 
ON public.blog_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage blog settings" 
ON public.blog_settings 
FOR ALL 
USING (has_admin_access(auth.uid()));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_blog_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_settings_updated_at
  BEFORE UPDATE ON public.blog_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blog_settings_updated_at();

-- Insert default settings
INSERT INTO public.blog_settings (id) VALUES (gen_random_uuid()) 
ON CONFLICT DO NOTHING;