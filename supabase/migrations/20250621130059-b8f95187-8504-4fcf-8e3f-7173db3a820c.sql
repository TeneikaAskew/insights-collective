
-- Only create buckets if they don't exist
DO $$
BEGIN
  -- Create course-images bucket if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'course-images') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('course-images', 'course-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  END IF;
  
  -- Create course-videos bucket if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'course-videos') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('course-videos', 'course-videos', true, 524288000, ARRAY['video/mp4', 'video/mov', 'video/avi', 'video/webm']);
  END IF;
  
  -- Create course-documents bucket if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'course-documents') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('course-documents', 'course-documents', true, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']);
  END IF;
END $$;

-- Create storage policies (only if they don't exist)
DO $$
BEGIN
  -- Policies for course-images
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated users to upload course images') THEN
    CREATE POLICY "Allow authenticated users to upload course images" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'course-images' AND auth.role() = 'authenticated');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public read access to course images') THEN
    CREATE POLICY "Allow public read access to course images" ON storage.objects
      FOR SELECT USING (bucket_id = 'course-images');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow course instructors to delete course images') THEN
    CREATE POLICY "Allow course instructors to delete course images" ON storage.objects
      FOR DELETE USING (bucket_id = 'course-images' AND auth.role() = 'authenticated');
  END IF;
  
  -- Policies for course-videos
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated users to upload course videos') THEN
    CREATE POLICY "Allow authenticated users to upload course videos" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'course-videos' AND auth.role() = 'authenticated');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public read access to course videos') THEN
    CREATE POLICY "Allow public read access to course videos" ON storage.objects
      FOR SELECT USING (bucket_id = 'course-videos');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow course instructors to delete course videos') THEN
    CREATE POLICY "Allow course instructors to delete course videos" ON storage.objects
      FOR DELETE USING (bucket_id = 'course-videos' AND auth.role() = 'authenticated');
  END IF;
  
  -- Policies for course-documents
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated users to upload course documents') THEN
    CREATE POLICY "Allow authenticated users to upload course documents" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'course-documents' AND auth.role() = 'authenticated');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public read access to course documents') THEN
    CREATE POLICY "Allow public read access to course documents" ON storage.objects
      FOR SELECT USING (bucket_id = 'course-documents');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow course instructors to delete course documents') THEN
    CREATE POLICY "Allow course instructors to delete course documents" ON storage.objects
      FOR DELETE USING (bucket_id = 'course-documents' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- Extend module_content table to support rich content blocks
ALTER TABLE module_content 
ADD COLUMN IF NOT EXISTS block_type VARCHAR(50) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS file_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS duration INTEGER,
ADD COLUMN IF NOT EXISTS is_interactive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS completion_required BOOLEAN DEFAULT false;

-- Create content blocks table for more structured content
CREATE TABLE IF NOT EXISTS content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  block_type VARCHAR(50) NOT NULL DEFAULT 'text',
  title TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  file_path TEXT,
  file_url TEXT,
  file_size INTEGER,
  file_type VARCHAR(100),
  thumbnail_url TEXT,
  duration INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  is_interactive BOOLEAN DEFAULT false,
  completion_required BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for content_blocks
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_blocks' AND policyname = 'Users can view content blocks for courses they have access to') THEN
    CREATE POLICY "Users can view content blocks for courses they have access to" 
      ON content_blocks FOR SELECT 
      USING (
        EXISTS (
          SELECT 1 FROM modules m 
          JOIN courses c ON m.course_id = c.id 
          WHERE m.id = content_blocks.module_id 
          AND (
            c.instructor_id = auth.uid() 
            OR EXISTS (
              SELECT 1 FROM course_assignments ca 
              WHERE ca.course_id = c.id AND ca.user_id = auth.uid()
            )
            OR 'admin' = ANY(public.get_user_roles(auth.uid()))
            OR EXISTS (
              SELECT 1 FROM enrollments e 
              WHERE e.course_id = c.id AND e.user_id = auth.uid()
            )
          )
        )
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_blocks' AND policyname = 'Course instructors can manage content blocks') THEN
    CREATE POLICY "Course instructors can manage content blocks" 
      ON content_blocks FOR ALL 
      USING (
        EXISTS (
          SELECT 1 FROM modules m 
          JOIN courses c ON m.course_id = c.id 
          WHERE m.id = content_blocks.module_id 
          AND (
            c.instructor_id = auth.uid() 
            OR EXISTS (
              SELECT 1 FROM course_assignments ca 
              WHERE ca.course_id = c.id AND ca.user_id = auth.uid() AND ca.role = 'instructor'
            )
            OR 'admin' = ANY(public.get_user_roles(auth.uid()))
          )
        )
      );
  END IF;
END $$;

-- Create quizzes table for interactive content
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_block_id UUID NOT NULL REFERENCES content_blocks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  time_limit INTEGER, -- in minutes
  attempts_allowed INTEGER DEFAULT 1,
  passing_score INTEGER DEFAULT 70,
  randomize_questions BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quiz questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL DEFAULT 'multiple_choice', -- multiple_choice, true_false, fill_blank, essay
  options JSONB DEFAULT '[]', -- Array of answer options
  correct_answer JSONB, -- Correct answer(s)
  explanation TEXT,
  points INTEGER DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create student progress tracking
CREATE TABLE IF NOT EXISTS content_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content_block_id UUID NOT NULL REFERENCES content_blocks(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completion_percentage INTEGER DEFAULT 0,
  time_spent INTEGER DEFAULT 0, -- in seconds
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, content_block_id)
);

-- Add RLS for progress tracking
ALTER TABLE content_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_progress' AND policyname = 'Users can manage their own progress') THEN
    CREATE POLICY "Users can manage their own progress" 
      ON content_progress FOR ALL 
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create or replace updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist and recreate them
DROP TRIGGER IF EXISTS update_content_blocks_updated_at ON content_blocks;
CREATE TRIGGER update_content_blocks_updated_at 
  BEFORE UPDATE ON content_blocks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quizzes_updated_at ON quizzes;
CREATE TRIGGER update_quizzes_updated_at 
  BEFORE UPDATE ON quizzes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
