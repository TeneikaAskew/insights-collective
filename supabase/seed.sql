
-- Basic seed data for development
-- Insert default page visibility settings
INSERT INTO page_visibility (page_name, page_path, visible_to_users, visible_to_instructors) 
VALUES 
  ('Home', '/', true, true),
  ('Courses', '/courses', true, true),
  ('Events', '/events', true, true),
  ('Resources', '/resources', true, true),
  ('Resume', '/resume', true, true)
ON CONFLICT (page_path) DO NOTHING;

-- Insert sample career quiz data for testing
INSERT INTO career_quiz_attempts (
  user_id,
  session_id,
  q1_coding_comfort,
  q2_stat_modeling_interest,
  q3_systems_vs_trends,
  result_ai_ml_score,
  result_analytics_score,
  result_data_engineering_score,
  result_business_intelligence_score,
  top_recommended_path
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'sample_session_123',
  4,
  3,
  4,
  85,
  75,
  90,
  70,
  'Data Engineering'
) ON CONFLICT DO NOTHING;
