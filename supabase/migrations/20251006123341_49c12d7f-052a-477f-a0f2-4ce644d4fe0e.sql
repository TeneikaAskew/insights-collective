-- Add complete quiz data to Visualization with Tableau course
DO $$
DECLARE
  v_course_id UUID := '660e8400-e29b-41d4-a716-446655440005';
  v_module1_id UUID;
  v_module2_id UUID;
  v_content_item1_id UUID;
  v_content_item2_id UUID;
  v_quiz1_id UUID;
  v_quiz2_id UUID;
BEGIN
  -- Get existing modules for this course
  SELECT id INTO v_module1_id FROM modules WHERE course_id = v_course_id ORDER BY position LIMIT 1;
  SELECT id INTO v_module2_id FROM modules WHERE course_id = v_course_id ORDER BY position LIMIT 1 OFFSET 1;
  
  -- Create content items for quizzes
  INSERT INTO content_items (id, course_id, module_id, title, type, position, published, created_by)
  VALUES 
    (gen_random_uuid(), v_course_id, v_module1_id, 'Tableau Basics Quiz', 'quiz', 100, true, (SELECT instructor_id FROM courses WHERE id = v_course_id))
  RETURNING id INTO v_content_item1_id;
  
  INSERT INTO content_items (id, course_id, module_id, title, type, position, published, created_by)
  VALUES 
    (gen_random_uuid(), v_course_id, v_module2_id, 'Advanced Visualization Quiz', 'quiz', 100, true, (SELECT instructor_id FROM courses WHERE id = v_course_id))
  RETURNING id INTO v_content_item2_id;
  
  -- Create quizzes
  INSERT INTO quizzes (id, content_item_id, title, description, quiz_type, time_limit, allowed_attempts)
  VALUES 
    (gen_random_uuid(), v_content_item1_id, 'Tableau Basics Quiz', '<p>Test your knowledge of Tableau fundamentals.</p>', 'graded', 30, 3)
  RETURNING id INTO v_quiz1_id;
  
  INSERT INTO quizzes (id, content_item_id, title, description, quiz_type, time_limit, allowed_attempts)
  VALUES 
    (gen_random_uuid(), v_content_item2_id, 'Advanced Visualization Quiz', '<p>Test your advanced Tableau skills.</p>', 'graded', 45, 3)
  RETURNING id INTO v_quiz2_id;
  
  -- Add quiz questions with options and correct answers
  INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, points, position)
  VALUES 
    (v_quiz1_id, 'What is the primary purpose of Tableau?', 'multiple_choice', 
     '["Data visualization", "Database management", "Programming", "Text editing"]'::jsonb,
     '["Data visualization"]'::jsonb, 10, 1),
    (v_quiz1_id, 'Which type of chart is best for showing trends over time?', 'multiple_choice',
     '["Line chart", "Pie chart", "Bar chart", "Scatter plot"]'::jsonb,
     '["Line chart"]'::jsonb, 10, 2),
    (v_quiz2_id, 'How do you create calculated fields in Tableau?', 'multiple_choice',
     '["Using the calculation editor", "Importing from Excel", "Writing SQL", "Manual entry"]'::jsonb,
     '["Using the calculation editor"]'::jsonb, 15, 1),
    (v_quiz2_id, 'What is a LOD expression in Tableau?', 'short_answer',
     NULL, '["Level of Detail expression"]'::jsonb, 15, 2);
  
END $$;
