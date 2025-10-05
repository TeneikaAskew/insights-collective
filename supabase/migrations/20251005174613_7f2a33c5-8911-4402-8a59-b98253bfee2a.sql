-- Manually populate Business Analytics with Python
INSERT INTO modules (id, course_id, title, week, description, published, position, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  '660e8400-e29b-41d4-a716-446655440004'::uuid,
  'Python Fundamentals for Business',
  1,
  'Learn Python basics for business analytics',
  true,
  0,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM modules 
  WHERE course_id = '660e8400-e29b-41d4-a716-446655440004'::uuid 
  AND week = 1
);

INSERT INTO modules (id, course_id, title, week, description, published, position, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  '660e8400-e29b-41d4-a716-446655440004'::uuid,
  'Data Analysis with Pandas',
  2,
  'Master data manipulation and analysis',
  true,
  1,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM modules 
  WHERE course_id = '660e8400-e29b-41d4-a716-446655440004'::uuid 
  AND week = 2
);

INSERT INTO modules (id, course_id, title, week, description, published, position, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  '660e8400-e29b-41d4-a716-446655440004'::uuid,
  'Business Visualization',
  3,
  'Create impactful business visualizations',
  true,
  2,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM modules 
  WHERE course_id = '660e8400-e29b-41d4-a716-446655440004'::uuid 
  AND week = 3
);

INSERT INTO modules (id, course_id, title, week, description, published, position, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  '660e8400-e29b-41d4-a716-446655440004'::uuid,
  'Statistical Analysis for Business',
  4,
  'Apply statistics to business problems',
  true,
  3,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM modules 
  WHERE course_id = '660e8400-e29b-41d4-a716-446655440004'::uuid 
  AND week = 4
);