-- Function to increment blog post views
CREATE OR REPLACE FUNCTION increment_blog_views(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts 
  SET views_count = views_count + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track blog post views with analytics
CREATE OR REPLACE FUNCTION track_blog_view(
  post_id UUID,
  view_date DATE,
  referrer_url TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  existing_record UUID;
BEGIN
  -- Check if analytics record exists for this post and date
  SELECT id INTO existing_record
  FROM blog_analytics
  WHERE blog_post_id = post_id AND date = view_date;
  
  IF existing_record IS NULL THEN
    -- Create new analytics record
    INSERT INTO blog_analytics (
      blog_post_id,
      date,
      views,
      unique_visitors,
      referrer_data
    ) VALUES (
      post_id,
      view_date,
      1,
      1,
      CASE 
        WHEN referrer_url IS NOT NULL 
        THEN jsonb_build_object(referrer_url, 1)
        ELSE '{}'::jsonb
      END
    );
  ELSE
    -- Update existing record
    UPDATE blog_analytics
    SET 
      views = views + 1,
      unique_visitors = unique_visitors + 1, -- This should be smarter with session tracking
      referrer_data = CASE
        WHEN referrer_url IS NOT NULL THEN
          CASE
            WHEN referrer_data ? referrer_url THEN
              jsonb_set(
                referrer_data,
                ARRAY[referrer_url],
                to_jsonb((referrer_data->>referrer_url)::int + 1)
              )
            ELSE
              referrer_data || jsonb_build_object(referrer_url, 1)
          END
        ELSE referrer_data
      END
    WHERE id = existing_record;
  END IF;
  
  -- Also increment the post's view count
  UPDATE blog_posts 
  SET views_count = views_count + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get popular posts
CREATE OR REPLACE FUNCTION get_popular_posts(
  days_back INTEGER DEFAULT 7,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  slug VARCHAR(200),
  views_count INTEGER,
  likes_count INTEGER,
  published_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.title,
    bp.slug,
    bp.views_count,
    bp.likes_count,
    bp.published_at
  FROM blog_posts bp
  WHERE 
    bp.status = 'published'
    AND bp.published_at >= NOW() - INTERVAL '1 day' * days_back
  ORDER BY bp.views_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get related posts by category and tags
CREATE OR REPLACE FUNCTION get_related_posts(
  post_id UUID,
  limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  slug VARCHAR(200),
  excerpt TEXT,
  featured_image VARCHAR(500),
  published_at TIMESTAMPTZ,
  similarity_score INTEGER
) AS $$
DECLARE
  post_category_id UUID;
  post_tag_ids UUID[];
BEGIN
  -- Get the category and tags of the current post
  SELECT category_id INTO post_category_id
  FROM blog_posts
  WHERE id = post_id;
  
  SELECT ARRAY_AGG(tag_id) INTO post_tag_ids
  FROM blog_post_tags
  WHERE blog_post_id = post_id;
  
  RETURN QUERY
  WITH scored_posts AS (
    SELECT DISTINCT
      bp.id,
      bp.title,
      bp.slug,
      bp.excerpt,
      bp.featured_image,
      bp.published_at,
      (
        -- Score based on same category
        CASE WHEN bp.category_id = post_category_id THEN 10 ELSE 0 END +
        -- Score based on shared tags
        (
          SELECT COUNT(*)::INTEGER * 5
          FROM blog_post_tags bpt
          WHERE bpt.blog_post_id = bp.id 
          AND bpt.tag_id = ANY(post_tag_ids)
        )
      ) as similarity_score
    FROM blog_posts bp
    WHERE 
      bp.id != post_id
      AND bp.status = 'published'
      AND (
        bp.category_id = post_category_id
        OR EXISTS (
          SELECT 1 
          FROM blog_post_tags bpt
          WHERE bpt.blog_post_id = bp.id 
          AND bpt.tag_id = ANY(post_tag_ids)
        )
      )
  )
  SELECT * FROM scored_posts
  WHERE similarity_score > 0
  ORDER BY similarity_score DESC, published_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_blog_views(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION track_blog_view(UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_posts(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_related_posts(UUID, INTEGER) TO authenticated;