-- Create page_visibility table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.page_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path TEXT NOT NULL UNIQUE,
  page_name TEXT NOT NULL,
  visible_to_users BOOLEAN NOT NULL DEFAULT true,
  visible_to_instructors BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.page_visibility ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage page visibility" ON public.page_visibility;
DROP POLICY IF EXISTS "Everyone can view page visibility" ON public.page_visibility;

-- Create policies
CREATE POLICY "Admins can manage page visibility" 
ON public.page_visibility 
FOR ALL 
USING (has_admin_access(auth.uid()));

CREATE POLICY "Everyone can view page visibility" 
ON public.page_visibility 
FOR SELECT 
USING (true);

-- Create update trigger
CREATE OR REPLACE FUNCTION public.update_page_visibility_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_page_visibility_updated_at ON public.page_visibility;
CREATE TRIGGER update_page_visibility_updated_at
  BEFORE UPDATE ON public.page_visibility
  FOR EACH ROW
  EXECUTE FUNCTION public.update_page_visibility_updated_at();

-- Insert initial page routes based on App.tsx routes
INSERT INTO public.page_visibility (page_path, page_name, visible_to_users, visible_to_instructors) VALUES
  ('/', 'Home', true, true),
  ('/dashboard', 'Dashboard', true, true),
  ('/user-dashboard', 'User Dashboard', true, true),
  ('/profile', 'Profile', true, true),
  ('/courses', 'Courses', true, true),
  ('/course-list', 'Course List', true, true),
  ('/interview-prep', 'Interview Prep', true, true),
  ('/career-agent', 'Career Agent', true, true),
  ('/career-pathway', 'Career Pathway', true, true),
  ('/assistants', 'AI Assistants', true, true),
  ('/explore-data-careers', 'Explore Data Careers', true, true),
  ('/resume', 'Resume', true, true),
  ('/events', 'Events', true, true),
  ('/messages', 'Messages', true, true),
  ('/forum', 'Forum', true, true),
  ('/portfolio-explorer', 'Portfolio Explorer', true, true),
  ('/resources', 'Resources', true, true),
  ('/survey', 'Survey', true, true),
  ('/admin', 'Admin Dashboard', false, false),
  ('/admin/activity', 'Admin Activity', false, false),
  ('/admin/blog-posts', 'Admin Blog Posts', false, false),
  ('/admin/courses', 'Admin Courses', false, false),
  ('/admin/events', 'Admin Events', false, false),
  ('/admin/forms', 'Admin Forms', false, false),
  ('/admin/users', 'Admin Users', false, false),
  ('/admin/page-visibility', 'Admin Page Visibility', false, false)
ON CONFLICT (page_path) DO NOTHING;