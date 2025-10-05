
-- Populate missing quiz backend for Visualization with Tableau course
-- Get the quiz content_items first, then create quiz records with questions

DO $$
DECLARE
  v_quiz1_id uuid;
  v_quiz2_id uuid;
  v_content_item1_id uuid;
  v_content_item2_id uuid;
BEGIN
  -- Find the quiz content items for Tableau course
  SELECT id INTO v_content_item1_id 
  FROM content_items 
  WHERE course_id = '660e8400-e29b-41d4-a716-446655440005' 
    AND type = 'quiz' 
    AND title LIKE '%Fundamentals%'
  LIMIT 1;
  
  SELECT id INTO v_content_item2_id 
  FROM content_items 
  WHERE course_id = '660e8400-e29b-41d4-a716-446655440005' 
    AND type = 'quiz' 
    AND title LIKE '%Advanced%'
  LIMIT 1;

  -- Create quiz records if content items exist
  IF v_content_item1_id IS NOT NULL THEN
    INSERT INTO quizzes (id, content_item_id, quiz_type, time_limit, points_possible, allowed_attempts)
    VALUES (gen_random_uuid(), v_content_item1_id, 'assignment', 30, 100, -1)
    RETURNING id INTO v_quiz1_id;

    -- Add questions for first quiz
    INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers)
    VALUES
      (v_quiz1_id, 'multiple_choice', 'What is the primary purpose of data visualization?', 10, 0, 
       '[{"id": "a", "text": "To make data look pretty", "correct": false}, 
         {"id": "b", "text": "To communicate insights effectively", "correct": true},
         {"id": "c", "text": "To hide data complexity", "correct": false},
         {"id": "d", "text": "To replace statistical analysis", "correct": false}]'::jsonb),
      (v_quiz1_id, 'multiple_choice', 'Which chart type is best for showing trends over time?', 10, 1,
       '[{"id": "a", "text": "Pie chart", "correct": false},
         {"id": "b", "text": "Bar chart", "correct": false},
         {"id": "c", "text": "Line chart", "correct": true},
         {"id": "d", "text": "Scatter plot", "correct": false}]'::jsonb),
      (v_quiz1_id, 'multiple_choice', 'What does a dashboard typically contain?', 10, 2,
       '[{"id": "a", "text": "A single chart", "correct": false},
         {"id": "b", "text": "Multiple related visualizations", "correct": true},
         {"id": "c", "text": "Raw data tables only", "correct": false},
         {"id": "d", "text": "Text documents", "correct": false}]'::jsonb),
      (v_quiz1_id, 'true_false', 'Tableau is primarily used for statistical modeling.', 10, 3,
       '[{"id": "true", "text": "True", "correct": false},
         {"id": "false", "text": "False", "correct": true}]'::jsonb),
      (v_quiz1_id, 'multiple_choice', 'What is a calculated field in Tableau?', 10, 4,
       '[{"id": "a", "text": "A field imported from the data source", "correct": false},
         {"id": "b", "text": "A custom formula created by the user", "correct": true},
         {"id": "c", "text": "A field that calculates automatically", "correct": false},
         {"id": "d", "text": "A visualization type", "correct": false}]'::jsonb);
  END IF;

  IF v_content_item2_id IS NOT NULL THEN
    INSERT INTO quizzes (id, content_item_id, quiz_type, time_limit, points_possible, allowed_attempts)
    VALUES (gen_random_uuid(), v_content_item2_id, 'assignment', 45, 100, -1)
    RETURNING id INTO v_quiz2_id;

    -- Add questions for second quiz
    INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers)
    VALUES
      (v_quiz2_id, 'multiple_choice', 'What is a dimension in Tableau?', 10, 0,
       '[{"id": "a", "text": "A quantitative field", "correct": false},
         {"id": "b", "text": "A categorical field", "correct": true},
         {"id": "c", "text": "A calculated metric", "correct": false},
         {"id": "d", "text": "A type of chart", "correct": false}]'::jsonb),
      (v_quiz2_id, 'multiple_choice', 'What does LOD stand for in Tableau?', 10, 1,
       '[{"id": "a", "text": "Level of Detail", "correct": true},
         {"id": "b", "text": "Load on Demand", "correct": false},
         {"id": "c", "text": "List of Data", "correct": false},
         {"id": "d", "text": "Logic of Display", "correct": false}]'::jsonb),
      (v_quiz2_id, 'true_false', 'Parameters in Tableau allow for user input to change visualizations.', 10, 2,
       '[{"id": "true", "text": "True", "correct": true},
         {"id": "false", "text": "False", "correct": false}]'::jsonb),
      (v_quiz2_id, 'multiple_choice', 'What is the purpose of blending data in Tableau?', 10, 3,
       '[{"id": "a", "text": "To mix colors", "correct": false},
         {"id": "b", "text": "To combine data from multiple sources", "correct": true},
         {"id": "c", "text": "To smooth out data", "correct": false},
         {"id": "d", "text": "To delete duplicates", "correct": false}]'::jsonb),
      (v_quiz2_id, 'multiple_choice', 'What is a measure in Tableau?', 10, 4,
       '[{"id": "a", "text": "A categorical field", "correct": false},
         {"id": "b", "text": "A quantitative field that can be aggregated", "correct": true},
         {"id": "c", "text": "A type of filter", "correct": false},
         {"id": "d", "text": "A dashboard component", "correct": false}]'::jsonb);
  END IF;
END $$;
