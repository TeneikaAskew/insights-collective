-- Migration: Add video analytics and inline discussions support
-- Date: 2025-10-06
-- Purpose: Complete partial implementations from COURSES_ROADMAP.md

-- ============================================================================
-- PART 1: VIDEO ANALYTICS
-- ============================================================================

-- Create video_analytics table for tracking video engagement
CREATE TABLE IF NOT EXISTS video_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE NOT NULL,

  -- Playback tracking
  watch_time INTEGER DEFAULT 0, -- Total seconds watched
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  last_position INTEGER DEFAULT 0, -- Resume point in seconds
  video_duration INTEGER, -- Total video duration in seconds

  -- Engagement metrics
  play_count INTEGER DEFAULT 0, -- Number of times played
  pause_count INTEGER DEFAULT 0,
  seek_count INTEGER DEFAULT 0, -- Number of times user seeked
  playback_speed NUMERIC(3,2) DEFAULT 1.0, -- Last used playback speed

  -- Completion tracking
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  first_watched_at TIMESTAMPTZ DEFAULT NOW(),
  last_watched_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one analytics record per user per video
  UNIQUE(user_id, content_item_id)
);

-- Create indexes for video analytics
CREATE INDEX IF NOT EXISTS idx_video_analytics_user_id ON video_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_content_item_id ON video_analytics(content_item_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_completed ON video_analytics(completed);
CREATE INDEX IF NOT EXISTS idx_video_analytics_completion_pct ON video_analytics(completion_percentage);

-- Add comments
COMMENT ON TABLE video_analytics IS 'Tracks video viewing behavior and progress for students';
COMMENT ON COLUMN video_analytics.watch_time IS 'Total seconds watched (may exceed duration due to rewatching)';
COMMENT ON COLUMN video_analytics.completion_percentage IS 'Percentage of video completed (0-100)';
COMMENT ON COLUMN video_analytics.last_position IS 'Resume point in seconds for "continue watching" feature';

-- ============================================================================
-- PART 2: INLINE DISCUSSIONS (Content-Level Comments)
-- ============================================================================

-- Create content_discussions table for inline discussions on content items
CREATE TABLE IF NOT EXISTS content_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Comment content
  comment_text TEXT NOT NULL,
  comment_type TEXT DEFAULT 'question' CHECK (comment_type IN ('question', 'comment', 'note', 'suggestion')),

  -- Threading support
  parent_comment_id UUID REFERENCES content_discussions(id) ON DELETE CASCADE,
  thread_position INTEGER DEFAULT 0, -- Position in thread

  -- Status and visibility
  is_resolved BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,

  -- Instructor features
  instructor_endorsed BOOLEAN DEFAULT false, -- Instructor marked as helpful
  endorsed_at TIMESTAMPTZ,
  endorsed_by UUID REFERENCES auth.users(id),

  -- Edit tracking
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,

  -- Engagement
  upvote_count INTEGER DEFAULT 0,

  -- Timestamp-specific comments (for videos)
  timestamp_seconds INTEGER, -- For video comments at specific time

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for content discussions
CREATE INDEX IF NOT EXISTS idx_content_discussions_content_item ON content_discussions(content_item_id);
CREATE INDEX IF NOT EXISTS idx_content_discussions_user ON content_discussions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_discussions_parent ON content_discussions(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_content_discussions_timestamp ON content_discussions(timestamp_seconds) WHERE timestamp_seconds IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_discussions_resolved ON content_discussions(is_resolved);
CREATE INDEX IF NOT EXISTS idx_content_discussions_endorsed ON content_discussions(instructor_endorsed) WHERE instructor_endorsed = true;

-- Add comments
COMMENT ON TABLE content_discussions IS 'Inline discussions and comments on content items (pages, videos, etc.)';
COMMENT ON COLUMN content_discussions.timestamp_seconds IS 'For video comments, the timestamp in the video where comment was made';
COMMENT ON COLUMN content_discussions.instructor_endorsed IS 'Instructor marked this comment as helpful/correct';

-- Create table for discussion upvotes
CREATE TABLE IF NOT EXISTS content_discussion_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID REFERENCES content_discussions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one upvote per user per comment
  UNIQUE(discussion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_discussion_upvotes_discussion ON content_discussion_upvotes(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_upvotes_user ON content_discussion_upvotes(user_id);

-- ============================================================================
-- PART 3: FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update video analytics updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_analytics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_watched_at = NOW();

  -- Auto-mark as completed if completion >= 90%
  IF NEW.completion_percentage >= 90 AND NEW.completed = false THEN
    NEW.completed = true;
    NEW.completed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_video_analytics_timestamp
  BEFORE UPDATE ON video_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_video_analytics_timestamp();

-- Function to update content_discussions timestamp
CREATE OR REPLACE FUNCTION update_content_discussion_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Mark as edited if comment_text changed (but not on insert)
  IF TG_OP = 'UPDATE' AND OLD.comment_text != NEW.comment_text THEN
    NEW.is_edited = true;
    NEW.edited_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_content_discussion_timestamp
  BEFORE UPDATE ON content_discussions
  FOR EACH ROW
  EXECUTE FUNCTION update_content_discussion_timestamp();

-- Function to sync upvote counts
CREATE OR REPLACE FUNCTION sync_discussion_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE content_discussions
    SET upvote_count = upvote_count + 1
    WHERE id = NEW.discussion_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content_discussions
    SET upvote_count = GREATEST(0, upvote_count - 1)
    WHERE id = OLD.discussion_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_upvote_count
  AFTER INSERT OR DELETE ON content_discussion_upvotes
  FOR EACH ROW
  EXECUTE FUNCTION sync_discussion_upvote_count();

-- ============================================================================
-- PART 4: HELPER FUNCTIONS FOR QUERIES
-- ============================================================================

-- Function to get student video analytics summary
CREATE OR REPLACE FUNCTION get_student_video_progress(student_id UUID, course_id_param UUID)
RETURNS TABLE(
  total_videos BIGINT,
  completed_videos BIGINT,
  total_watch_time_minutes NUMERIC,
  average_completion_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT ci.id)::BIGINT as total_videos,
    COUNT(DISTINCT CASE WHEN va.completed THEN ci.id END)::BIGINT as completed_videos,
    COALESCE(SUM(va.watch_time) / 60.0, 0)::NUMERIC as total_watch_time_minutes,
    COALESCE(AVG(va.completion_percentage), 0)::NUMERIC as average_completion_percentage
  FROM content_items ci
  LEFT JOIN video_analytics va ON ci.id = va.content_item_id AND va.user_id = student_id
  WHERE ci.course_id = course_id_param
    AND ci.type IN ('page', 'external_url') -- Video content types
  GROUP BY student_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_student_video_progress IS 'Returns video watching progress summary for a student in a course';

-- Function to get most discussed content items
CREATE OR REPLACE FUNCTION get_most_discussed_content(course_id_param UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  content_item_id UUID,
  content_title TEXT,
  discussion_count BIGINT,
  unresolved_count BIGINT,
  endorsed_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id as content_item_id,
    ci.title as content_title,
    COUNT(cd.id)::BIGINT as discussion_count,
    COUNT(CASE WHEN cd.is_resolved = false THEN 1 END)::BIGINT as unresolved_count,
    COUNT(CASE WHEN cd.instructor_endorsed THEN 1 END)::BIGINT as endorsed_count
  FROM content_items ci
  LEFT JOIN content_discussions cd ON ci.id = cd.content_item_id
  WHERE ci.course_id = course_id_param
  GROUP BY ci.id, ci.title
  HAVING COUNT(cd.id) > 0
  ORDER BY discussion_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_most_discussed_content IS 'Returns content items with the most discussions';

-- ============================================================================
-- PART 5: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE video_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_discussion_upvotes ENABLE ROW LEVEL SECURITY;

-- Video Analytics Policies
-- Users can view and update their own analytics
CREATE POLICY "Users can view own video analytics"
  ON video_analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own video analytics"
  ON video_analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own video analytics"
  ON video_analytics FOR UPDATE
  USING (auth.uid() = user_id);

-- Instructors can view all analytics for their courses
CREATE POLICY "Instructors can view course video analytics"
  ON video_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      JOIN courses c ON ci.course_id = c.id
      JOIN profiles p ON p.id = auth.uid()
      WHERE ci.id = video_analytics.content_item_id
        AND (c.instructor_id = auth.uid() OR p.roles @> ARRAY['admin', 'instructor'])
    )
  );

-- Content Discussions Policies
-- Anyone can view non-hidden discussions on content they can access
CREATE POLICY "Users can view content discussions"
  ON content_discussions FOR SELECT
  USING (
    is_hidden = false AND
    EXISTS (
      SELECT 1 FROM content_items ci
      WHERE ci.id = content_discussions.content_item_id
    )
  );

-- Users can insert their own discussions
CREATE POLICY "Users can create content discussions"
  ON content_discussions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own discussions
CREATE POLICY "Users can update own content discussions"
  ON content_discussions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own discussions
CREATE POLICY "Users can delete own content discussions"
  ON content_discussions FOR DELETE
  USING (auth.uid() = user_id);

-- Instructors can manage all discussions on their content
CREATE POLICY "Instructors can manage course discussions"
  ON content_discussions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM content_items ci
      JOIN courses c ON ci.course_id = c.id
      JOIN profiles p ON p.id = auth.uid()
      WHERE ci.id = content_discussions.content_item_id
        AND (c.instructor_id = auth.uid() OR p.roles @> ARRAY['admin', 'instructor'])
    )
  );

-- Discussion Upvotes Policies
CREATE POLICY "Users can view discussion upvotes"
  ON content_discussion_upvotes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own upvotes"
  ON content_discussion_upvotes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- PART 6: MIGRATION VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Video Analytics and Inline Discussions migration completed successfully!';
  RAISE NOTICE 'New tables: video_analytics, content_discussions, content_discussion_upvotes';
  RAISE NOTICE 'New functions: get_student_video_progress, get_most_discussed_content';
END $$;
