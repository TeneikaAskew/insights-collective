-- Create blog_categories table
CREATE TABLE IF NOT EXISTS blog_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES blog_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create blog_tags table
CREATE TABLE IF NOT EXISTS blog_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend blog_posts table with new fields
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS reading_time INTEGER;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS meta_title VARCHAR(160);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS meta_description VARCHAR(320);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS meta_keywords TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS og_image VARCHAR(500);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT TRUE;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS custom_slug VARCHAR(200);

-- Create blog_post_tags junction table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_post_tags') THEN
    CREATE TABLE blog_post_tags (
      blog_post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
      tag_id UUID REFERENCES blog_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (blog_post_id, tag_id)
    );
  ELSE
    -- Table exists, ensure columns are named correctly
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'blog_post_tags' AND column_name = 'tag_id') THEN
      -- If using old schema, might have different column names - add tag_id if missing
      ALTER TABLE blog_post_tags ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES blog_tags(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Create blog_media table
CREATE TABLE IF NOT EXISTS blog_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255),
  caption TEXT,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  file_type VARCHAR(50),
  width INTEGER,
  height INTEGER,
  metadata JSONB,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create blog_post_versions table for content versioning
CREATE TABLE IF NOT EXISTS blog_post_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  version_number INTEGER NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blog_post_id, version_number)
);

-- Create blog_analytics table
CREATE TABLE IF NOT EXISTS blog_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  avg_time_on_page INTERVAL,
  bounce_rate DECIMAL(5,2),
  referrer_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blog_post_id, date)
);

-- Create blog_comments table
CREATE TABLE IF NOT EXISTS blog_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  is_spam BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_scheduled_at ON blog_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_post ON blog_post_tags(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag ON blog_post_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_blog_analytics_post_date ON blog_analytics(blog_post_id, date);
CREATE INDEX IF NOT EXISTS idx_blog_comments_post ON blog_comments(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_approved ON blog_comments(is_approved);

-- Create RLS policies
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

-- Categories: Anyone can read, only admins can modify
CREATE POLICY "Categories are viewable by everyone" ON blog_categories FOR SELECT USING (true);
CREATE POLICY "Only admins can insert categories" ON blog_categories FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE 'admin' = ANY(roles)));
CREATE POLICY "Only admins can update categories" ON blog_categories FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE 'admin' = ANY(roles)));
CREATE POLICY "Only admins can delete categories" ON blog_categories FOR DELETE USING (auth.uid() IN (SELECT id FROM profiles WHERE 'admin' = ANY(roles)));

-- Tags: Anyone can read, authenticated users can create, admins can modify all
CREATE POLICY "Tags are viewable by everyone" ON blog_tags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tags" ON blog_tags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Only admins can update tags" ON blog_tags FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE 'admin' = ANY(roles)));
CREATE POLICY "Only admins can delete tags" ON blog_tags FOR DELETE USING (auth.uid() IN (SELECT id FROM profiles WHERE 'admin' = ANY(roles)));

-- Post tags: Inherit from blog_posts permissions
CREATE POLICY "Post tags are viewable by everyone" ON blog_post_tags FOR SELECT USING (true);
CREATE POLICY "Authors can manage their post tags" ON blog_post_tags FOR ALL USING (
  auth.uid() IN (SELECT author_id FROM blog_posts WHERE id = blog_post_tags.blog_post_id)
);

-- Media: Users can manage their own uploads, admins can manage all
CREATE POLICY "Media is viewable by everyone" ON blog_media FOR SELECT USING (true);
CREATE POLICY "Users can upload media" ON blog_media FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their own media" ON blog_media FOR UPDATE USING (auth.uid() = author_id OR auth.uid() IN (SELECT id FROM profiles WHERE 'admin' = ANY(roles)));
CREATE POLICY "Users can delete their own media" ON blog_media FOR DELETE USING (auth.uid() = author_id OR auth.uid() IN (SELECT id FROM profiles WHERE 'admin' = ANY(roles)));

-- Post versions: Only authors and admins can access
CREATE POLICY "Authors can view their post versions" ON blog_post_versions FOR SELECT USING (
  auth.uid() IN (SELECT author_id FROM blog_posts WHERE id = blog_post_versions.blog_post_id) OR
  auth.uid() IN (SELECT id FROM profiles WHERE 'admin' = ANY(roles))
);
CREATE POLICY "Authors can create post versions" ON blog_post_versions FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT author_id FROM blog_posts WHERE id = blog_post_versions.blog_post_id)
);

-- Analytics: Only post authors and admins can view
CREATE POLICY "Authors can view their post analytics" ON blog_analytics FOR SELECT USING (
  auth.uid() IN (SELECT author_id FROM blog_posts WHERE id = blog_analytics.blog_post_id) OR
  auth.uid() IN (SELECT id FROM profiles WHERE 'admin' = ANY(roles))
);

-- Comments: Public read for approved, authenticated users can create
CREATE POLICY "Approved comments are viewable by everyone" ON blog_comments FOR SELECT USING (is_approved = true OR author_id = auth.uid());
CREATE POLICY "Authenticated users can create comments" ON blog_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their own comments" ON blog_comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete their own comments" ON blog_comments FOR DELETE USING (auth.uid() = author_id OR auth.uid() IN (SELECT id FROM profiles WHERE 'admin' = ANY(roles)));

-- Create storage bucket for blog media
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-media', 'blog-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for blog media
CREATE POLICY "Anyone can view blog media" ON storage.objects FOR SELECT USING (bucket_id = 'blog-media');
CREATE POLICY "Authenticated users can upload blog media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'blog-media' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own blog media" ON storage.objects FOR UPDATE USING (bucket_id = 'blog-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own blog media" ON storage.objects FOR DELETE USING (bucket_id = 'blog-media' AND auth.uid()::text = (storage.foldername(name))[1]);