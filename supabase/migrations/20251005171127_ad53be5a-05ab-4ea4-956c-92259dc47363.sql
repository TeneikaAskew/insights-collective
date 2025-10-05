-- CONSOLIDATION MIGRATION: Single Canvas-Style System
-- This removes dual systems and uses content_items as the single source of truth

-- First, create a service function to populate test data that bypasses RLS
CREATE OR REPLACE FUNCTION populate_course_test_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_module_id uuid;
  v_content_id uuid;
  v_instructor_id uuid;
  v_position int;
BEGIN
  -- Get instructor ID (first admin/instructor in system)
  SELECT id INTO v_instructor_id FROM profiles WHERE 'instructor' = ANY(roles) LIMIT 1;
  IF v_instructor_id IS NULL THEN
    SELECT id INTO v_instructor_id FROM profiles LIMIT 1;
  END IF;

  -- COURSE 1: Advanced Machine Learning
  SELECT id INTO v_course_id FROM courses WHERE title = 'Advanced Machine Learning' LIMIT 1;
  IF v_course_id IS NOT NULL THEN
    -- Module 1: Neural Networks Fundamentals
    SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND title = 'Neural Networks Fundamentals' LIMIT 1;
    IF v_module_id IS NOT NULL THEN
      v_position := 0;
      
      -- Lesson 1: Introduction to Neural Networks (as content_item type='page')
      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
      VALUES (v_course_id, v_module_id, 'page', 'Introduction to Neural Networks', 
        '<h2>Welcome to Neural Networks</h2><p>Neural networks are the foundation of modern AI systems. In this lesson, you will learn about perceptrons, activation functions, and forward propagation.</p><h3>Key Concepts:</h3><ul><li>Perceptron architecture</li><li>Activation functions (ReLU, Sigmoid, Tanh)</li><li>Forward propagation</li><li>Loss functions</li></ul>', 
        v_position, true, v_instructor_id)
      RETURNING id INTO v_content_id;
      v_position := v_position + 1;

      -- Assignment 1: Neural Network Basics
      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
      VALUES (v_course_id, v_module_id, 'assignment', 'Neural Network Basics Assignment', 
        '<h3>Assignment: Build Your First Neural Network</h3><p>Implement a simple neural network from scratch using NumPy.</p><h4>Requirements:</h4><ul><li>Create a 2-layer neural network</li><li>Implement forward propagation</li><li>Calculate loss using MSE</li><li>Test with XOR problem</li></ul><p><strong>Due:</strong> End of Week 1</p>', 
        v_position, true, v_instructor_id,
        jsonb_build_object('points_possible', 100, 'submission_types', ARRAY['online_upload', 'text_entry'], 'allowed_attempts', 3))
      RETURNING id INTO v_content_id;
      v_position := v_position + 1;

      -- Lesson 2: Backpropagation
      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
      VALUES (v_course_id, v_module_id, 'page', 'Backpropagation Algorithm', 
        '<h2>Understanding Backpropagation</h2><p>Backpropagation is the key algorithm for training neural networks. It efficiently computes gradients using the chain rule.</p><h3>Topics Covered:</h3><ul><li>Chain rule in calculus</li><li>Gradient descent optimization</li><li>Weight updates</li><li>Learning rate tuning</li></ul>', 
        v_position, true, v_instructor_id);
      v_position := v_position + 1;

      -- Quiz 1: Neural Networks Fundamentals
      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
      VALUES (v_course_id, v_module_id, 'quiz', 'Neural Networks Fundamentals Quiz', 
        '<h3>Test Your Knowledge</h3><p>This quiz covers the fundamental concepts of neural networks including architecture, activation functions, and backpropagation.</p>', 
        v_position, true, v_instructor_id,
        jsonb_build_object('time_limit', 30, 'points_possible', 50, 'allowed_attempts', 2, 'quiz_type', 'assignment'));
      v_position := v_position + 1;
    END IF;

    -- Module 2: Deep Learning Architectures
    SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND title = 'Deep Learning Architectures' LIMIT 1;
    IF v_module_id IS NOT NULL THEN
      v_position := 0;
      
      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
      VALUES (v_course_id, v_module_id, 'page', 'Convolutional Neural Networks', 
        '<h2>CNNs for Image Processing</h2><p>Learn how CNNs revolutionized computer vision with hierarchical feature learning.</p><h3>Architecture Components:</h3><ul><li>Convolutional layers</li><li>Pooling layers</li><li>Fully connected layers</li><li>Common architectures (VGG, ResNet, Inception)</li></ul>', 
        v_position, true, v_instructor_id);
      v_position := v_position + 1;

      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
      VALUES (v_course_id, v_module_id, 'assignment', 'CNN Image Classification Project', 
        '<h3>Project: Build an Image Classifier</h3><p>Create a CNN to classify images from the CIFAR-10 dataset.</p><h4>Deliverables:</h4><ul><li>Trained model achieving >80% accuracy</li><li>Training visualization plots</li><li>Analysis of misclassified images</li><li>Written report (2-3 pages)</li></ul>', 
        v_position, true, v_instructor_id,
        jsonb_build_object('points_possible', 150, 'submission_types', ARRAY['online_upload'], 'allowed_attempts', 2));
      v_position := v_position + 1;

      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
      VALUES (v_course_id, v_module_id, 'page', 'Recurrent Neural Networks', 
        '<h2>RNNs for Sequential Data</h2><p>Understand how RNNs process sequential data and handle temporal dependencies.</p><h3>Key Topics:</h3><ul><li>LSTM and GRU architectures</li><li>Sequence-to-sequence models</li><li>Attention mechanisms</li><li>Applications in NLP</li></ul>', 
        v_position, true, v_instructor_id);
    END IF;
  END IF;

  -- COURSE 2: Introduction to Data Science
  SELECT id INTO v_course_id FROM courses WHERE title = 'Introduction to Data Science' LIMIT 1;
  IF v_course_id IS NOT NULL THEN
    -- Module 1: Python for Data Science
    SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND week = 1 LIMIT 1;
    IF v_module_id IS NOT NULL THEN
      v_position := 0;
      
      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
      VALUES (v_course_id, v_module_id, 'page', 'Python Basics for Data Science', 
        '<h2>Getting Started with Python</h2><p>Master the essential Python skills needed for data science work.</p><h3>What You Will Learn:</h3><ul><li>Python syntax and data structures</li><li>NumPy for numerical computing</li><li>Pandas for data manipulation</li><li>Basic plotting with Matplotlib</li></ul>', 
        v_position, true, v_instructor_id);
      v_position := v_position + 1;

      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
      VALUES (v_course_id, v_module_id, 'assignment', 'Python Data Analysis Exercise', 
        '<h3>Assignment: Exploratory Data Analysis</h3><p>Perform EDA on a provided dataset using Python.</p><h4>Tasks:</h4><ul><li>Load and clean the dataset</li><li>Calculate summary statistics</li><li>Create 5 visualizations</li><li>Document insights found</li></ul>', 
        v_position, true, v_instructor_id,
        jsonb_build_object('points_possible', 100, 'submission_types', ARRAY['online_upload'], 'allowed_attempts', 3));
      v_position := v_position + 1;

      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
      VALUES (v_course_id, v_module_id, 'page', 'Data Cleaning and Preparation', 
        '<h2>Data Preprocessing Essentials</h2><p>Learn techniques to clean and prepare data for analysis.</p><h3>Topics:</h3><ul><li>Handling missing values</li><li>Outlier detection</li><li>Data transformation</li><li>Feature engineering</li></ul>', 
        v_position, true, v_instructor_id);
      v_position := v_position + 1;

      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
      VALUES (v_course_id, v_module_id, 'quiz', 'Python Fundamentals Quiz', 
        '<h3>Check Your Understanding</h3><p>Test your knowledge of Python basics for data science.</p>', 
        v_position, true, v_instructor_id,
        jsonb_build_object('time_limit', 20, 'points_possible', 30, 'allowed_attempts', 3, 'quiz_type', 'practice'));
    END IF;
  END IF;

  -- COURSE 3: Data Engineering Fundamentals  
  SELECT id INTO v_course_id FROM courses WHERE title = 'Data Engineering Fundamentals' LIMIT 1;
  IF v_course_id IS NOT NULL THEN
    SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id LIMIT 1;
    IF v_module_id IS NOT NULL THEN
      v_position := 0;
      
      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
      VALUES (v_course_id, v_module_id, 'page', 'Introduction to Data Pipelines', 
        '<h2>Building Data Pipelines</h2><p>Learn to design and implement scalable data pipelines.</p><h3>Core Concepts:</h3><ul><li>ETL vs ELT processes</li><li>Batch vs streaming</li><li>Data quality checks</li><li>Pipeline orchestration</li></ul>', 
        v_position, true, v_instructor_id);
      v_position := v_position + 1;

      INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
      VALUES (v_course_id, v_module_id, 'assignment', 'Build an ETL Pipeline', 
        '<h3>Project: ETL Pipeline Development</h3><p>Create a complete ETL pipeline for processing data.</p><h4>Requirements:</h4><ul><li>Extract data from API</li><li>Transform and clean data</li><li>Load into database</li><li>Add error handling and logging</li></ul>', 
        v_position, true, v_instructor_id,
        jsonb_build_object('points_possible', 120, 'submission_types', ARRAY['online_upload'], 'allowed_attempts', 2));
    END IF;
  END IF;

END;
$$;

-- Execute the population function
SELECT populate_course_test_data();

-- Drop the function after use
DROP FUNCTION IF EXISTS populate_course_test_data();