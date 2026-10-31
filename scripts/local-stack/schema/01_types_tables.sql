create type public.app_role as enum ('student', 'instructor', 'admin');
create type public.content_item_type as enum ('page', 'assignment', 'quiz', 'discussion', 'external_url', 'external_tool');
create type public.content_type as enum ('text', 'video', 'file', 'quiz', 'assignment');
create type public.course_difficulty as enum ('beginner', 'intermediate', 'advanced');
create type public.module_content_type as enum ('text', 'video', 'image');
create type public.user_role as enum ('admin', 'instructor', 'user');

create table if not exists public.action_plan_progress (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  timeframe text not null,
  milestone_index integer not null,
  milestone_text text not null default ''::text,
  completed boolean not null default false,
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.admin_actions (
  id uuid not null default gen_random_uuid(),
  admin_user_id uuid not null,
  action text not null,
  target_user_id uuid,
  target_table text,
  target_record_id uuid,
  justification text,
  created_at timestamp with time zone default now()
);
create table if not exists public.assesment_rubric (
  id uuid not null default gen_random_uuid(),
  assessment_area text not null,
  performance_level text not null,
  score integer not null,
  criteria_description text not null,
  created_at timestamp with time zone default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone default CURRENT_TIMESTAMP
);
create table if not exists public.assessment_areas (
  name character varying(50) not null,
  definition text not null,
  key_focus_areas text not null,
  created_at timestamp without time zone default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone default CURRENT_TIMESTAMP
);
create table if not exists public.assessment_questions (
  id uuid not null default gen_random_uuid(),
  question_id uuid not null default gen_random_uuid(),
  assessment_area text not null,
  question_text text not null,
  question_type text default 'Behavioral'::text,
  created_at timestamp with time zone default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone default CURRENT_TIMESTAMP
);
create table if not exists public.assessment_sessions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  session_name text,
  start_time timestamp with time zone default CURRENT_TIMESTAMP,
  end_time timestamp with time zone,
  overall_score numeric(3,2),
  status text default 'in_progress'::text
);
create table if not exists public.assignment_progress (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  content_block_id uuid not null,
  completed boolean default false,
  submitted_at timestamp with time zone,
  submission_data jsonb default '{}'::jsonb,
  grade integer,
  feedback text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.assignment_rubrics (
  id uuid not null default gen_random_uuid(),
  assignment_id uuid not null,
  rubric_id uuid not null,
  created_at timestamp with time zone default now()
);
create table if not exists public.assignment_submissions (
  id uuid not null default gen_random_uuid(),
  assignment_id uuid not null,
  user_id uuid not null,
  submitted_at timestamp with time zone,
  submission_type text,
  body text,
  url text,
  grade numeric(10,2),
  score numeric(10,2),
  excused boolean default false,
  late boolean default false,
  missing boolean default false,
  workflow_state text default 'unsubmitted'::text,
  attempt integer default 1,
  graded_at timestamp with time zone,
  grader_comments text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  rubric_scores jsonb
);
create table if not exists public.assignments (
  id uuid not null default gen_random_uuid(),
  course_id uuid not null,
  title text not null,
  description text,
  content text,
  due_date timestamp with time zone,
  points integer default 100,
  instructions text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  module_id uuid,
  is_published boolean default false,
  content_item_id uuid,
  submission_types text[] default ARRAY['file_upload'::text],
  allowed_file_extensions text[],
  max_attempts integer default 1,
  grading_type text default 'points'::text,
  peer_review_enabled boolean default false,
  peer_review_due_date timestamp with time zone,
  anonymous_grading boolean default false,
  late_policy jsonb
);
create table if not exists public.assistant_conversations (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  session_id text,
  quiz_attempt_id uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  is_active boolean default true
);
create table if not exists public.assistant_messages (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  sender_type text not null,
  content text not null,
  created_at timestamp with time zone default now(),
  response text,
  model text,
  max_tokens integer,
  stream boolean
);
create table if not exists public.audit_logs (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone default now()
);
create table if not exists public.availability_slots (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  weekday integer not null,
  time_slot text not null,
  is_available boolean not null default true,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.blog_analytics (
  id uuid not null default gen_random_uuid(),
  blog_post_id uuid,
  date date not null,
  views integer default 0,
  unique_visitors integer default 0,
  avg_time_on_page interval,
  bounce_rate numeric(5,2),
  referrer_data jsonb,
  created_at timestamp with time zone default now()
);
create table if not exists public.blog_categories (
  id uuid not null default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  created_at timestamp with time zone default now()
);
create table if not exists public.blog_comments (
  id uuid not null default gen_random_uuid(),
  blog_post_id uuid,
  author_id uuid,
  parent_id uuid,
  content text not null,
  is_approved boolean default false,
  is_spam boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.blog_media (
  id uuid not null default gen_random_uuid(),
  url character varying(500) not null,
  alt_text character varying(255),
  caption text,
  file_name character varying(255) not null,
  file_size bigint,
  file_type character varying(50),
  width integer,
  height integer,
  metadata jsonb,
  author_id uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.blog_post_tags (
  id uuid not null default gen_random_uuid(),
  blog_post_id uuid,
  tag_name text not null,
  created_at timestamp with time zone default now(),
  tag_id uuid
);
create table if not exists public.blog_post_versions (
  id uuid not null default gen_random_uuid(),
  blog_post_id uuid,
  title character varying(255) not null,
  content text not null,
  excerpt text,
  version_number integer not null,
  created_by uuid,
  created_at timestamp with time zone default now()
);
create table if not exists public.blog_post_views (
  id uuid not null default gen_random_uuid(),
  post_id uuid,
  post_slug text not null,
  visitor_id text not null,
  view_duration integer default 0,
  view_date timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);
create table if not exists public.blog_posts (
  id uuid not null default gen_random_uuid(),
  title text not null,
  content text not null,
  excerpt text not null,
  slug text not null,
  author_id uuid not null,
  image_url text,
  status text default 'draft'::text,
  featured boolean default false,
  seo_title text,
  seo_description text,
  category_id uuid,
  view_count integer default 0,
  read_time integer default 0,
  published_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  reading_time integer,
  views_count integer default 0,
  likes_count integer default 0,
  meta_title character varying(160),
  meta_description character varying(320),
  meta_keywords text,
  og_image character varying(500),
  scheduled_at timestamp with time zone,
  is_featured boolean default false,
  allow_comments boolean default true,
  custom_slug character varying(200)
);
create table if not exists public.blog_settings (
  id uuid not null default gen_random_uuid(),
  blog_title text not null default 'The Data Blueprint Series'::text,
  blog_description text default 'A comprehensive guide to breaking in, leveling up, and leading in data careers'::text,
  blog_url text default ''::text,
  series_title text default 'The Data Blueprint Series'::text,
  series_description text default 'A 10-Part Guide to Breaking In, Leveling Up, and Leading in Data Careers'::text,
  series_url text default '/data-blueprint-series'::text,
  series_featured boolean default true,
  default_meta_title text default ''::text,
  default_meta_description text default ''::text,
  default_meta_keywords text default ''::text,
  site_meta_title text default 'Data Career Platform'::text,
  site_meta_description text default 'Your comprehensive platform for data career development'::text,
  site_meta_keywords text default 'data science, data analytics, career development'::text,
  site_favicon_url text default ''::text,
  site_logo_url text default ''::text,
  google_analytics_id text default ''::text,
  google_tag_manager_id text default ''::text,
  enable_analytics boolean default true,
  allow_comments boolean default true,
  moderate_comments boolean default true,
  social_sharing boolean default true,
  email_notifications boolean default true,
  notification_email text default ''::text,
  default_post_status text default 'draft'::text,
  auto_generate_excerpts boolean default true,
  posts_per_page integer default 10,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.blog_tags (
  id uuid not null default gen_random_uuid(),
  name character varying(50) not null,
  slug character varying(50) not null,
  created_at timestamp with time zone default now()
);
create table if not exists public.bls_occupations (
  soc_code text not null,
  occupation_title text not null,
  employment integer,
  annual_mean integer,
  pct10 integer,
  pct25 integer,
  median integer,
  pct75 integer,
  pct90 integer,
  source text not null default 'seed'::text,
  reference_period text not null default 'May 2025'::text,
  source_name text not null default 'U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics'::text,
  source_url text not null default 'https://www.bls.gov/oes/'::text,
  retrieved_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.career_pathway_answers (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  session_id text not null,
  question text not null,
  answer text not null,
  created_at timestamp with time zone not null default now(),
  is_reset boolean default false,
  updated_at timestamp with time zone
);
create table if not exists public.career_pathway_results (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  session_id text not null,
  created_at timestamp with time zone not null default now(),
  report jsonb,
  action_plan jsonb
);
create table if not exists public.career_quiz_attempts (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  session_id text,
  created_at timestamp with time zone default now(),
  result_ai_ml_score integer,
  result_analytics_score integer,
  result_data_engineering_score integer,
  result_business_intelligence_score integer,
  top_recommended_path text,
  q1_coding_comfort integer,
  q2_stat_modeling_interest integer,
  q3_systems_vs_trends integer,
  q4_insight_generation integer,
  q5_stakeholder_communication integer,
  q6_business_vs_processing integer,
  q7_system_optimization integer,
  q8_modeling_patterns integer,
  q9_business_question_focus integer,
  q10_tool_choice text,
  q11_ai_product_interest integer,
  q12_strategic_influence_interest integer,
  q13_infrastructure_interest integer,
  q14_kpi_reporting_interest integer,
  self_reported_experience text
);
create table if not exists public.career_roles (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  title text not null,
  category text not null,
  soc_code text not null,
  mapping_note text,
  source text not null default 'curated'::text,
  requested_title text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.certificate_verification_attempts (
  id uuid not null default gen_random_uuid(),
  ip_hash text not null,
  code text,
  found boolean not null default false,
  attempted_at timestamp with time zone not null default now()
);
create table if not exists public.certificates (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null,
  certificate_type text not null default 'completion'::text,
  certificate_data jsonb not null default '{}'::jsonb,
  verification_code text not null,
  issued_at timestamp with time zone default now()
);
create table if not exists public.code_attempts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  challenge_id uuid not null,
  code text not null,
  language text not null,
  duration integer,
  passed_tests boolean,
  ai_review jsonb,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.code_challenges (
  id uuid not null default gen_random_uuid(),
  title text not null,
  prompt text not null,
  test_cases jsonb not null default '[]'::jsonb,
  topic_tags text[] default '{}'::text[],
  difficulty text not null,
  created_at timestamp with time zone not null default now(),
  description text,
  detail text,
  example text,
  constraints jsonb not null default '[]'::jsonb,
  hints jsonb not null default '[]'::jsonb,
  language text not null default 'python'::text,
  starter_code text,
  function_name text not null default 'solution'::text,
  runtime text not null default 'python-stdlib'::text,
  compare_mode text not null default 'exact'::text
);
create table if not exists public.content_discussion_upvotes (
  id uuid not null default gen_random_uuid(),
  discussion_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default now()
);
create table if not exists public.content_discussions (
  id uuid not null default gen_random_uuid(),
  content_item_id uuid not null,
  user_id uuid not null,
  comment_text text not null,
  comment_type text default 'question'::text,
  parent_comment_id uuid,
  thread_position integer default 0,
  is_resolved boolean default false,
  is_pinned boolean default false,
  is_hidden boolean default false,
  instructor_endorsed boolean default false,
  endorsed_at timestamp with time zone,
  endorsed_by uuid,
  is_edited boolean default false,
  edited_at timestamp with time zone,
  upvote_count integer default 0,
  timestamp_seconds integer,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.content_item_progressions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  content_item_id uuid not null,
  workflow_state text default 'unread'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.content_items (
  id uuid not null default gen_random_uuid(),
  course_id uuid not null,
  module_id uuid,
  type content_item_type not null,
  title text not null,
  content text,
  "position" integer not null default 0,
  published boolean default false,
  settings jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid
);
create table if not exists public.content_progress (
  id uuid not null default gen_random_uuid(),
  lesson_id uuid not null,
  user_id uuid not null,
  progress_percentage numeric default 0,
  time_spent numeric default 0,
  last_accessed timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);
create table if not exists public.conversation_participants (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid,
  user_id uuid,
  added_at timestamp with time zone default now(),
  archived boolean default false,
  deleted_at timestamp with time zone
);
create table if not exists public.conversations (
  id uuid not null default gen_random_uuid(),
  subject text,
  is_group boolean default false,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone,
  archived boolean default false,
  course_id uuid
);
create table if not exists public.course_announcements (
  id uuid not null default gen_random_uuid(),
  course_id uuid not null,
  title text not null,
  content text,
  author_id uuid,
  created_by uuid,
  is_pinned boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.course_assignments (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid,
  role text not null,
  created_at timestamp with time zone default now()
);
create table if not exists public.course_feedback (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid,
  path text not null,
  category text not null default 'feedback'::text,
  message text not null,
  screenshot_url text,
  user_agent text,
  status text not null default 'open'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.course_instructors (
  id uuid not null default gen_random_uuid(),
  course_id uuid,
  user_id uuid not null,
  role text default 'instructor'::text,
  created_at timestamp with time zone default now()
);
create table if not exists public.course_material_files (
  id uuid not null default gen_random_uuid(),
  course_id uuid not null,
  folder_id uuid,
  name text not null,
  storage_path text not null,
  bucket text not null default 'course-documents'::text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.course_material_folders (
  id uuid not null default gen_random_uuid(),
  course_id uuid not null,
  parent_id uuid,
  name text not null,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.course_wishlists (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null,
  created_at timestamp with time zone default now()
);
create table if not exists public.coursera_courses (
  slug text not null,
  url text not null,
  title text not null,
  partner text not null,
  format text not null,
  level text not null default 'Intermediate'::text,
  rating numeric(3,2),
  reviews integer,
  enrolled bigint,
  estimated_hours numeric(6,1),
  description text,
  skills text[] not null default '{}'::text[],
  subjects text[] not null default '{}'::text[],
  primary_subjects text[] not null default '{}'::text[],
  top_reviews jsonb not null default '[]'::jsonb,
  status text not null default 'active'::text,
  curator_note text,
  is_featured boolean not null default false,
  last_fetched_at timestamp with time zone,
  last_verified_at timestamp with time zone,
  last_http_status integer,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  languages text[] not null default '{}'::text[]
);
create table if not exists public.coursera_crawl_queue (
  url text not null,
  slug text not null,
  state text not null default 'pending'::text,
  attempts integer not null default 0,
  last_error text,
  source text not null default 'refresh'::text,
  enqueued_at timestamp with time zone not null default now(),
  processed_at timestamp with time zone
);
create table if not exists public.coursera_subject_keywords (
  subject text not null,
  keyword text not null
);
create table if not exists public.courses (
  id uuid not null default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null,
  level text not null,
  image_url text,
  thumbnail text,
  instructor_id uuid,
  published boolean default false,
  enrollment_status text default 'open'::text,
  duration smallint,
  tags text[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  status text default 'draft'::text,
  enrollment_count integer default 0,
  difficulty_level course_difficulty default 'beginner'::course_difficulty,
  estimated_hours numeric(5,2) default 1.0,
  settings jsonb not null default '{}'::jsonb
);
create table if not exists public.cron_job_logs (
  id uuid not null default gen_random_uuid(),
  job_name text not null,
  success boolean not null,
  response_data jsonb,
  error_message text,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.debug_token_attempts (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  ip_address inet,
  attempt_time timestamp with time zone not null default now(),
  success boolean not null default false
);
create table if not exists public.enrollments (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  course_id uuid,
  enrolled_at timestamp with time zone default now(),
  completion_status integer default 0,
  calendar_feed_token uuid not null default gen_random_uuid()
);
create table if not exists public.event_registrations (
  id uuid not null default gen_random_uuid(),
  event_id uuid,
  user_id uuid,
  registered_at timestamp with time zone default now()
);
create table if not exists public.events (
  id uuid not null default gen_random_uuid(),
  title text not null,
  description text not null,
  type text not null,
  format text not null,
  location text,
  link text,
  date date not null,
  start_time time without time zone,
  end_time time without time zone,
  image text,
  capacity integer,
  calendly_link text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  course_id uuid,
  zoom_meeting_id bigint,
  zoom_recurrence jsonb,
  zoom_start_url text
);
create table if not exists public.form_submissions (
  id uuid not null default gen_random_uuid(),
  form_id uuid,
  user_id uuid,
  submission_data jsonb not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  draft boolean not null default false
);
create table if not exists public.forms (
  id uuid not null default gen_random_uuid(),
  title text not null,
  description text,
  status boolean not null default false,
  deadline timestamp with time zone,
  form_link text not null,
  form_data jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  slug text,
  form_structure jsonb default '[]'::jsonb,
  featured boolean not null default false
);
create table if not exists public.forums (
  id uuid not null default gen_random_uuid(),
  course_id uuid not null,
  title text not null,
  description text,
  allow_create_threads boolean not null default true,
  allow_email_subscription boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.grade_change_notifications (
  id uuid not null default gen_random_uuid(),
  grade_history_id uuid not null,
  student_id uuid not null,
  course_id uuid not null,
  notification_type text not null,
  title text not null,
  message text,
  is_read boolean default false,
  read_at timestamp with time zone,
  delivery_method text[] default ARRAY['in_app'::text],
  created_at timestamp with time zone default now()
);
create table if not exists public.grade_history (
  id uuid not null default gen_random_uuid(),
  grade_id uuid not null,
  assignment_id uuid,
  quiz_id uuid,
  student_id uuid not null,
  course_id uuid not null,
  previous_points_earned numeric(8,2),
  previous_points_possible numeric(8,2),
  previous_percentage numeric(5,2),
  previous_letter_grade text,
  previous_comments text,
  new_points_earned numeric(8,2),
  new_points_possible numeric(8,2),
  new_percentage numeric(5,2),
  new_letter_grade text,
  new_comments text,
  change_type text not null,
  change_reason text,
  changed_by uuid not null,
  changed_at timestamp with time zone default now(),
  grading_method text,
  rubric_data jsonb,
  submission_id uuid,
  created_at timestamp with time zone default now()
);
create table if not exists public.grades (
  id uuid not null default gen_random_uuid(),
  course_id uuid not null,
  student_id uuid not null,
  assignment_id uuid,
  quiz_id uuid,
  grade_type text not null,
  points_earned numeric(8,2),
  points_possible numeric(8,2),
  percentage numeric(5,2),
  letter_grade text,
  weight numeric(5,2) default 1.0,
  comments text,
  graded_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.grading_sessions (
  id uuid not null default gen_random_uuid(),
  grader_id uuid not null,
  course_id uuid not null,
  assignment_id uuid,
  quiz_id uuid,
  session_type text not null,
  grading_method text,
  submissions_graded integer default 0,
  total_submissions integer,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  grading_criteria jsonb,
  batch_changes jsonb,
  created_at timestamp with time zone default now()
);
create table if not exists public.job_descriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  source_type text not null,
  source_url text,
  raw_text text not null,
  parsed_fields jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.lesson_completion_requirements (
  id uuid not null default gen_random_uuid(),
  lesson_id uuid not null,
  requirement_type text not null,
  requirement_data jsonb,
  created_at timestamp with time zone default now()
);
create table if not exists public.lesson_completions (
  id uuid not null default gen_random_uuid(),
  lesson_id uuid not null,
  user_id uuid not null,
  completed_at timestamp with time zone default now(),
  completion_method text
);
create table if not exists public.lesson_progress (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  lesson_id uuid not null,
  completed boolean default false,
  completion_percentage integer default 0,
  time_spent integer default 0,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  last_accessed_at timestamp with time zone default now()
);
create table if not exists public.lessons (
  id uuid not null default gen_random_uuid(),
  module_id uuid,
  title text not null,
  description text not null,
  order_num integer not null,
  content text not null,
  duration text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  content_blocks_count integer default 0,
  estimated_duration integer default 0,
  completion_required boolean default true,
  completion_criteria jsonb default '{"type": "all_blocks"}'::jsonb
);
create table if not exists public.linkedin_posts (
  id uuid not null default gen_random_uuid(),
  post_id text not null,
  content text not null,
  author_username text not null default 'teneikaaskew'::text,
  author_display_name text default 'Teneika Askew'::text,
  posted_at timestamp with time zone not null,
  scraped_at timestamp with time zone not null default now(),
  like_count integer default 0,
  comment_count integer default 0,
  share_count integer default 0,
  media_urls text[] default '{}'::text[],
  post_url text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.messages (
  id uuid not null default gen_random_uuid(),
  sender_id uuid,
  conversation_id uuid not null,
  content text not null,
  attachment_url text,
  read boolean default false,
  created_at timestamp with time zone default now()
);
create table if not exists public.mock_sessions (
  id uuid not null default gen_random_uuid(),
  user1_id uuid not null,
  user2_id uuid not null,
  role1 text not null,
  role2 text not null,
  session_time timestamp with time zone not null,
  type text not null,
  status text not null,
  study_guide_id uuid,
  created_at timestamp with time zone not null default now(),
  meeting_url text,
  start_url text,
  meeting_id text,
  end_time timestamp with time zone,
  video_platform text
);
create table if not exists public.module_content (
  id uuid not null default gen_random_uuid(),
  module_id uuid,
  type module_content_type not null,
  content text not null,
  "position" integer not null default 0,
  uploaded_by uuid not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  block_type character varying(50) default 'text'::character varying,
  metadata jsonb default '{}'::jsonb,
  file_path text,
  file_size integer,
  file_type character varying(100),
  thumbnail_url text,
  duration integer,
  is_interactive boolean default false,
  completion_required boolean default false
);
create table if not exists public.module_progress (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  module_id uuid not null,
  completed boolean default false,
  completion_percentage integer default 0,
  time_spent integer default 0,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  last_accessed_at timestamp with time zone default now()
);
create table if not exists public.module_progressions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  module_id uuid not null,
  workflow_state text default 'locked'::text,
  current_position integer,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.modules (
  id uuid not null default gen_random_uuid(),
  course_id uuid,
  title text not null,
  description text not null default ''::text,
  week integer not null default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  requirements jsonb default '[]'::jsonb,
  completion_requirements jsonb default '[]'::jsonb,
  prerequisite_module_ids uuid[] default '{}'::uuid[],
  publish_final_grade boolean default false,
  published boolean default true,
  "position" integer not null
);
create table if not exists public.no_show_reports (
  id uuid not null default gen_random_uuid(),
  session_id uuid not null,
  reporter_id uuid not null,
  reported_user_id uuid not null,
  reason text not null,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.notification_email_log (
  id uuid not null default gen_random_uuid(),
  notification_id uuid,
  user_id uuid,
  recipient text,
  provider_message_id text,
  status text not null,
  error text,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  message text not null,
  type text not null default 'general'::text,
  is_read boolean not null default false,
  link text,
  created_at timestamp with time zone not null default now(),
  course_id uuid,
  email_digest_sent_at timestamp with time zone
);
create table if not exists public.page_visibility (
  id uuid not null default gen_random_uuid(),
  page_path text not null,
  page_name text not null,
  visible_to_users boolean not null default false,
  visible_to_instructors boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.peer_reviews (
  id uuid not null default gen_random_uuid(),
  session_id uuid not null,
  reviewer_id uuid not null,
  reviewee_id uuid not null,
  rubric_scores jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.portfolio (
  created_at timestamp with time zone not null default now(),
  interests text,
  "current_role" text,
  hobbies text,
  recommendations jsonb,
  user_id uuid,
  updated_at timestamp with time zone,
  id uuid not null default gen_random_uuid()
);
create table if not exists public.portfolio_page_projects (
  id uuid not null default gen_random_uuid(),
  portfolio_page_id uuid,
  project_id uuid,
  display_order integer default 0,
  custom_description text
);
create table if not exists public.portfolio_pages (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text,
  theme text default 'default'::text,
  is_public boolean default false,
  custom_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  profile_data jsonb,
  layout text default 'classic'::text
);
create table if not exists public.portfolio_projects (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text,
  required_skills text[],
  effort_level text,
  impact text,
  roadmap jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  status text,
  github_url text,
  live_url text,
  project_images text[] default '{}'::text[]
);
create table if not exists public.posts (
  id uuid not null default gen_random_uuid(),
  thread_id uuid not null,
  user_id uuid not null,
  content text not null,
  parent_id uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.profiles (
  id uuid not null,
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  notification_settings jsonb default '{"email": true, "browser": true, "frequency": "daily"}'::jsonb,
  preferences jsonb default '{"language": "English", "timezone": "UTC"}'::jsonb,
  roles text[] default ARRAY['student'::text]
);
create table if not exists public.progress (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  lesson_id uuid,
  completed boolean default false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.progress_snapshots (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null,
  completion_percentage numeric not null default 0,
  snapshot_date date not null default CURRENT_DATE,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.project_status (
  project_id uuid not null,
  status text not null,
  updated_at timestamp with time zone default now()
);
create table if not exists public.question_bank_categories (
  id uuid not null default gen_random_uuid(),
  bank_id uuid not null,
  name text not null,
  parent_id uuid,
  created_at timestamp with time zone default now()
);
create table if not exists public.question_bank_questions (
  id uuid not null default gen_random_uuid(),
  bank_id uuid not null,
  question_type text not null,
  question_text text not null,
  rich_content jsonb,
  points numeric(5,2) default 1,
  difficulty_level text,
  topic_tags text[],
  options jsonb,
  correct_answer jsonb,
  explanation text,
  feedback jsonb,
  usage_count integer default 0,
  success_rate numeric(3,2),
  metadata jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.question_banks (
  id uuid not null default gen_random_uuid(),
  course_id uuid not null,
  title text not null,
  description text,
  created_by uuid not null,
  is_shared boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.question_category_links (
  question_id uuid not null,
  category_id uuid not null
);
create table if not exists public.quiz_attempt_questions (
  id uuid not null default gen_random_uuid(),
  attempt_id uuid not null,
  question_id uuid not null,
  question_order integer not null,
  student_answer jsonb,
  is_correct boolean,
  points_earned numeric(5,2),
  time_spent integer,
  created_at timestamp with time zone default now()
);
create table if not exists public.quiz_attempts (
  id uuid not null default gen_random_uuid(),
  quiz_id uuid not null,
  user_id uuid not null,
  score integer not null,
  answers jsonb not null default '{}'::jsonb,
  time_taken integer,
  completed_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);
create table if not exists public.quiz_question_pools (
  id uuid not null default gen_random_uuid(),
  quiz_id uuid not null,
  bank_id uuid not null,
  category_id uuid,
  number_of_questions integer not null,
  points_per_question numeric(5,2) default 1,
  difficulty_filter text,
  topic_tags_filter text[],
  "position" integer not null,
  created_at timestamp with time zone default now()
);
create table if not exists public.quiz_questions (
  id uuid not null default gen_random_uuid(),
  quiz_id uuid not null,
  question_text text not null,
  question_type character varying(20) not null default 'multiple_choice'::character varying,
  options jsonb default '[]'::jsonb,
  correct_answer jsonb,
  explanation text,
  points integer default 1,
  "position" integer not null default 0,
  created_at timestamp with time zone default now(),
  feedback text,
  answers jsonb default '[]'::jsonb
);
create table if not exists public.quiz_submission_answers (
  id uuid not null default gen_random_uuid(),
  quiz_submission_id uuid not null,
  quiz_question_id uuid not null,
  answer_data jsonb not null,
  correct boolean,
  points numeric(10,2),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.quiz_submissions (
  id uuid not null default gen_random_uuid(),
  quiz_id uuid not null,
  user_id uuid not null,
  submission_id uuid default gen_random_uuid(),
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  end_at timestamp with time zone,
  attempt integer default 1,
  extra_attempts integer default 0,
  extra_time integer default 0,
  manually_unlocked boolean default false,
  time_spent integer,
  score numeric(10,2),
  kept_score numeric(10,2),
  workflow_state text default 'untaken'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.quizzes (
  id uuid not null default gen_random_uuid(),
  content_item_id uuid not null,
  title text not null,
  description text,
  quiz_type text default 'assignment'::text,
  points_possible integer,
  time_limit integer,
  allowed_attempts integer default 1,
  shuffle_answers boolean default false,
  shuffle_questions boolean default false,
  show_correct_answers boolean default true,
  due_at timestamp with time zone,
  unlock_at timestamp with time zone,
  lock_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  module_id uuid
);
create table if not exists public.resources (
  id uuid not null default gen_random_uuid(),
  created_by uuid default '47cf8181-c9a4-4cb9-8aa4-d6967e128c36'::uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deadline timestamp with time zone,
  tweet_url text,
  tweet_likes integer default 0,
  tweet_retweets integer default 0,
  linkedin_url text,
  category text not null default 'training'::text,
  tweet_id text,
  created_at_est timestamp with time zone,
  full_text text,
  favorite_count integer,
  retweet_count integer,
  in_reply_to_screen_name text,
  lang text,
  source text,
  user_mentions jsonb,
  resource_type text,
  career_area text,
  resource_link text,
  predicted_resource_labels text,
  predicted_career_labels text
);
create table if not exists public.resumes (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  file_path text not null,
  analysis jsonb,
  career_alignment_score integer,
  target_role text,
  uploaded_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  text text,
  resume_roast text,
  sentences jsonb,
  sentences_updated_at timestamp with time zone,
  enhanced_analysis jsonb,
  fallback_analysis jsonb,
  analysis_complete boolean default false,
  career_goals text,
  improvements_complete boolean default false,
  analyzed_at timestamp with time zone
);
create table if not exists public.rubric_criteria (
  id uuid not null default gen_random_uuid(),
  rubric_id uuid not null,
  title text not null,
  description text,
  points integer not null default 0,
  order_index integer default 0,
  created_at timestamp with time zone default now(),
  levels jsonb not null default '[]'::jsonb
);
create table if not exists public.rubrics (
  id uuid not null default gen_random_uuid(),
  course_id uuid not null,
  title text not null,
  description text,
  points_possible integer default 100,
  created_by uuid not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table if not exists public.scrape_metadata (
  id uuid not null default gen_random_uuid(),
  key text not null,
  value text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.security_events (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  event_type text not null,
  severity text not null default 'info'::text,
  description text not null,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone default now()
);
create table if not exists public.star_responses (
  id uuid not null default gen_random_uuid(),
  question_id text not null,
  user_id uuid not null,
  situation text,
  task text,
  action text,
  result text,
  ai_feedback jsonb,
  submitted_at timestamp with time zone not null default now(),
  assessment_area text,
  is_assessment_question boolean default false
);
create table if not exists public.study_guides (
  id uuid not null default gen_random_uuid(),
  job_description_id uuid not null,
  user_id uuid not null,
  competencies jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  technical_checklist jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  assessment_areas jsonb default '[]'::jsonb,
  leadership_areas jsonb default '[]'::jsonb
);
create table if not exists public.submission_attachments (
  id uuid not null default gen_random_uuid(),
  submission_id uuid not null,
  filename text not null,
  content_type text,
  size integer,
  url text not null,
  created_at timestamp with time zone default now()
);
create table if not exists public.submission_audit_events (
  id uuid not null default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  submission_id uuid not null,
  student_id uuid,
  assignment_id uuid,
  course_id uuid,
  module_id uuid,
  attachment_id uuid,
  filename text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.submission_comments (
  id uuid not null default gen_random_uuid(),
  submission_id uuid not null,
  submission_type text not null,
  comment_text text not null,
  comment_type text not null,
  author_id uuid not null,
  author_type text not null,
  is_private boolean default false,
  parent_comment_id uuid,
  thread_position integer default 0,
  attachments jsonb,
  rich_content jsonb,
  is_draft boolean default false,
  is_edited boolean default false,
  edit_history jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone
);
create table if not exists public.survey_drafts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  form_id uuid not null,
  form_data jsonb not null,
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.thread_read_status (
  id uuid not null default gen_random_uuid(),
  thread_id uuid not null,
  user_id uuid not null,
  last_read_at timestamp with time zone not null default now()
);
create table if not exists public.thread_subscriptions (
  id uuid not null default gen_random_uuid(),
  thread_id uuid,
  forum_id uuid,
  user_id uuid not null,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.threads (
  id uuid not null default gen_random_uuid(),
  forum_id uuid not null,
  user_id uuid not null,
  title text not null,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.tweets (
  id uuid not null default gen_random_uuid(),
  tweet_id text not null,
  content text not null,
  author_username text not null,
  author_display_name text,
  tweeted_at timestamp with time zone not null,
  scraped_at timestamp with time zone not null default now(),
  like_count integer default 0,
  retweet_count integer default 0,
  reply_count integer default 0,
  quote_count integer default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.user_assessments (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  question_id uuid not null,
  assessment_area text not null,
  response text,
  score integer,
  performance_level text,
  assessor_notes text,
  assessment_date timestamp with time zone default CURRENT_TIMESTAMP
);
create table if not exists public.user_feedback (
  id uuid not null default gen_random_uuid(),
  page_path text not null,
  is_useful boolean not null,
  feedback_text text,
  feedback_category text,
  user_id uuid,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.user_roles (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  granted_at timestamp with time zone default now(),
  granted_by uuid
);
create table if not exists public.video_analytics (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  content_item_id uuid not null,
  watch_time integer default 0,
  completion_percentage integer default 0,
  last_position integer default 0,
  video_duration integer,
  play_count integer default 0,
  pause_count integer default 0,
  seek_count integer default 0,
  playback_speed numeric(3,2) default 1.0,
  completed boolean default false,
  completed_at timestamp with time zone,
  first_watched_at timestamp with time zone default now(),
  last_watched_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
