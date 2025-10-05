-- Insert Business Analytics content with correct quiz schema
WITH module_ids AS (
  SELECT id, week FROM modules WHERE course_id = '660e8400-e29b-41d4-a716-446655440004'
),
instructor AS (
  SELECT instructor_id FROM courses WHERE id = '660e8400-e29b-41d4-a716-446655440004'
)
INSERT INTO content_items (course_id, module_id, type, title, content, published, position, created_by)
SELECT 
  '660e8400-e29b-41d4-a716-446655440004'::uuid,
  m.id,
  v.type::content_item_type,
  v.title,
  v.content,
  true,
  v.pos,
  i.instructor_id
FROM module_ids m
CROSS JOIN instructor i
CROSS JOIN LATERAL (VALUES
  (1, 'page', 'Introduction to Python', '<h2>Welcome to Python</h2><p>Python basics...</p>', 0),
  (1, 'page', 'Variables', '<h2>Working with Data</h2><p>Learn Python data types...</p>', 1),
  (1, 'page', 'Control Flow', '<h2>Loops</h2><p>Master control structures...</p>', 2),
  (1, 'assignment', 'Python Exercise', '<h2>Practice</h2><p>Complete exercises...</p>', 3),
  (1, 'quiz', 'Python Quiz', '<h2>Test</h2><p>Quiz on basics...</p>', 4),
  (2, 'page', 'Intro to Pandas', '<h2>Data with Pandas</h2><p>Learn Pandas...</p>', 0),
  (2, 'page', 'DataFrames', '<h2>Pandas Structures</h2><p>Work with DataFrames...</p>', 1),
  (2, 'page', 'Data Cleaning', '<h2>Prepare Data</h2><p>Clean datasets...</p>', 2),
  (2, 'assignment', 'Pandas Analysis', '<h2>Analyze Data</h2><p>Use Pandas...</p>', 3),
  (2, 'quiz', 'Pandas Quiz', '<h2>Test Skills</h2><p>Quiz on Pandas...</p>', 4),
  (3, 'page', 'Visualization Basics', '<h2>Intro to Viz</h2><p>Learn visualization...</p>', 0),
  (3, 'page', 'Matplotlib', '<h2>Charts with Matplotlib</h2><p>Build charts...</p>', 1),
  (3, 'page', 'Seaborn', '<h2>Statistical Viz</h2><p>Use Seaborn...</p>', 2),
  (3, 'assignment', 'Dashboard', '<h2>Create Dashboard</h2><p>Build dashboard...</p>', 3),
  (3, 'quiz', 'Viz Quiz', '<h2>Test Viz Skills</h2><p>Quiz on charts...</p>', 4),
  (4, 'page', 'Statistics', '<h2>Understand Data</h2><p>Calculate statistics...</p>', 0),
  (4, 'page', 'Hypothesis Testing', '<h2>Data Decisions</h2><p>Use hypothesis testing...</p>', 1),
  (4, 'page', 'Regression', '<h2>Predictions</h2><p>Build regression models...</p>', 2),
  (4, 'assignment', 'Statistics Project', '<h2>Apply Statistics</h2><p>Statistical methods...</p>', 3),
  (4, 'quiz', 'Statistics Quiz', '<h2>Final</h2><p>Comprehensive quiz...</p>', 4)
) AS v(week, type, title, content, pos)
WHERE m.week = v.week;

-- Create assignments
INSERT INTO assignments (course_id, content_item_id, title, description, points, due_date, is_published)
SELECT ci.course_id, ci.id, ci.title, ci.content, 100, now() + interval '14 days', true
FROM content_items ci
WHERE ci.type = 'assignment' AND ci.course_id = '660e8400-e29b-41d4-a716-446655440004'
AND NOT EXISTS (SELECT 1 FROM assignments WHERE content_item_id = ci.id);

-- Create quizzes
INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, allowed_attempts)
SELECT ci.id, ci.title, ci.content, 'graded', 30, 3
FROM content_items ci
WHERE ci.type = 'quiz' AND ci.course_id = '660e8400-e29b-41d4-a716-446655440004'
AND NOT EXISTS (SELECT 1 FROM quizzes WHERE content_item_id = ci.id);

-- Create quiz questions
INSERT INTO quiz_questions (quiz_id, question_text, question_type, points, position)
SELECT q.id, 'Q' || gs.n || ': ' || q.title,
  CASE WHEN gs.n % 3 = 0 THEN 'essay' WHEN gs.n % 3 = 1 THEN 'multiple_choice' ELSE 'true_false' END,
  10, gs.n - 1
FROM quizzes q
JOIN content_items ci ON q.content_item_id = ci.id
CROSS JOIN generate_series(1, 7) AS gs(n)
WHERE ci.course_id = '660e8400-e29b-41d4-a716-446655440004'
AND NOT EXISTS (SELECT 1 FROM quiz_questions WHERE quiz_id = q.id);