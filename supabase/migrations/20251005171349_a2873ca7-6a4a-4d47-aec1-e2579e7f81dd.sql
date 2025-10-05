
-- Delete old partial data and repopulate with correct module titles
DELETE FROM content_items WHERE course_id IN (
  SELECT id FROM courses WHERE title IN (
    'Advanced Machine Learning', 
    'Introduction to Data Science', 
    'Data Engineering Fundamentals'
  )
);

-- Populate with actual module titles
DO $$
DECLARE
  v_course_id uuid;
  v_module_id uuid;
  v_instructor_id uuid;
  v_position int;
BEGIN
  -- Get instructor
  SELECT id INTO v_instructor_id FROM profiles WHERE 'instructor' = ANY(roles) LIMIT 1;
  IF v_instructor_id IS NULL THEN
    SELECT id INTO v_instructor_id FROM profiles LIMIT 1;
  END IF;

  -- ADVANCED MACHINE LEARNING
  SELECT id INTO v_course_id FROM courses WHERE title = 'Advanced Machine Learning';
  
  -- Module: Supervised Learning Algorithms
  SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND week = 1;
  IF v_module_id IS NOT NULL THEN
    INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by) VALUES
    (v_course_id, v_module_id, 'page', 'Introduction to Supervised Learning', '<h2>Welcome to Supervised Learning</h2><p>Learn the fundamentals of supervised machine learning algorithms.</p>', 0, true, v_instructor_id),
    (v_course_id, v_module_id, 'assignment', 'Linear Regression Project', '<h3>Build a Linear Regression Model</h3><p>Implement linear regression from scratch.</p>', 1, true, v_instructor_id),
    (v_course_id, v_module_id, 'page', 'Decision Trees and Random Forests', '<h2>Tree-Based Models</h2><p>Understand decision trees and ensemble methods.</p>', 2, true, v_instructor_id),
    (v_course_id, v_module_id, 'quiz', 'Supervised Learning Quiz', '<p>Test your understanding of supervised learning concepts.</p>', 3, true, v_instructor_id);
  END IF;

  -- Module: Unsupervised Learning  
  SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND week = 2;
  IF v_module_id IS NOT NULL THEN
    INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by) VALUES
    (v_course_id, v_module_id, 'page', 'Clustering Algorithms', '<h2>Introduction to Clustering</h2><p>Explore K-means, hierarchical clustering, and DBSCAN.</p>', 0, true, v_instructor_id),
    (v_course_id, v_module_id, 'assignment', 'Customer Segmentation Analysis', '<h3>Clustering Project</h3><p>Segment customers using clustering algorithms.</p>', 1, true, v_instructor_id),
    (v_course_id, v_module_id, 'page', 'Dimensionality Reduction', '<h2>PCA and t-SNE</h2><p>Learn techniques to reduce data dimensions.</p>', 2, true, v_instructor_id);
  END IF;

  -- Module: Deep Learning Foundations
  SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND week = 3;
  IF v_module_id IS NOT NULL THEN
    INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by) VALUES
    (v_course_id, v_module_id, 'page', 'Neural Networks Basics', '<h2>Introduction to Neural Networks</h2><p>Understand perceptrons, activation functions, and backpropagation.</p>', 0, true, v_instructor_id),
    (v_course_id, v_module_id, 'assignment', 'Build a Neural Network', '<h3>Neural Network Implementation</h3><p>Create a multi-layer perceptron for classification.</p>', 1, true, v_instructor_id),
    (v_course_id, v_module_id, 'quiz', 'Deep Learning Fundamentals Quiz', '<p>Assess your knowledge of neural networks.</p>', 2, true, v_instructor_id);
  END IF;

  -- INTRODUCTION TO DATA SCIENCE
  SELECT id INTO v_course_id FROM courses WHERE title = 'Introduction to Data Science';
  
  -- Module: Foundations of Data Science
  SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND week = 1;
  IF v_module_id IS NOT NULL THEN
    DELETE FROM content_items WHERE module_id = v_module_id;
    INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by) VALUES
    (v_course_id, v_module_id, 'page', 'What is Data Science?', '<h2>Introduction to Data Science</h2><p>Explore the field of data science and its applications.</p>', 0, true, v_instructor_id),
    (v_course_id, v_module_id, 'page', 'Python for Data Science', '<h2>Python Basics</h2><p>Learn Python programming for data analysis.</p>', 1, true, v_instructor_id),
    (v_course_id, v_module_id, 'assignment', 'Python Data Analysis', '<h3>Exploratory Data Analysis Project</h3><p>Analyze a dataset using Python.</p>', 2, true, v_instructor_id),
    (v_course_id, v_module_id, 'quiz', 'Foundations Quiz', '<p>Test your knowledge of data science fundamentals.</p>', 3, true, v_instructor_id);
  END IF;

  -- Module: Python for Data Analysis
  SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND week = 2;
  IF v_module_id IS NOT NULL THEN
    INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by) VALUES
    (v_course_id, v_module_id, 'page', 'Pandas for Data Manipulation', '<h2>Working with Pandas</h2><p>Master DataFrame operations and data cleaning.</p>', 0, true, v_instructor_id),
    (v_course_id, v_module_id, 'assignment', 'Data Cleaning Exercise', '<h3>Clean and Transform Data</h3><p>Process a messy dataset using Pandas.</p>', 1, true, v_instructor_id),
    (v_course_id, v_module_id, 'page', 'Data Visualization', '<h2>Visualizing Data with Matplotlib</h2><p>Create effective visualizations.</p>', 2, true, v_instructor_id);
  END IF;

  -- Module: Statistical Methods
  SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND week = 3;
  IF v_module_id IS NOT NULL THEN
    INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by) VALUES
    (v_course_id, v_module_id, 'page', 'Descriptive Statistics', '<h2>Statistical Analysis</h2><p>Learn measures of central tendency and dispersion.</p>', 0, true, v_instructor_id),
    (v_course_id, v_module_id, 'assignment', 'Statistical Analysis Project', '<h3>Analyze Survey Data</h3><p>Perform statistical analysis on survey results.</p>', 1, true, v_instructor_id),
    (v_course_id, v_module_id, 'quiz', 'Statistics Quiz', '<p>Test your statistical knowledge.</p>', 2, true, v_instructor_id);
  END IF;

  -- DATA ENGINEERING FUNDAMENTALS
  SELECT id INTO v_course_id FROM courses WHERE title = 'Data Engineering Fundamentals';
  
  -- Module: Database Design
  SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND week = 1;
  IF v_module_id IS NOT NULL THEN
    DELETE FROM content_items WHERE module_id = v_module_id;
    INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by) VALUES
    (v_course_id, v_module_id, 'page', 'Database Fundamentals', '<h2>Introduction to Databases</h2><p>Learn relational database concepts and SQL.</p>', 0, true, v_instructor_id),
    (v_course_id, v_module_id, 'assignment', 'Design a Database Schema', '<h3>Database Design Project</h3><p>Create a normalized database schema.</p>', 1, true, v_instructor_id),
    (v_course_id, v_module_id, 'page', 'SQL Queries', '<h2>Writing SQL</h2><p>Master SELECT, JOIN, and aggregation queries.</p>', 2, true, v_instructor_id),
    (v_course_id, v_module_id, 'quiz', 'Database Quiz', '<p>Test your database knowledge.</p>', 3, true, v_instructor_id);
  END IF;

  -- Module: ETL Processes
  SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND week = 2;
  IF v_module_id IS NOT NULL THEN
    INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by) VALUES
    (v_course_id, v_module_id, 'page', 'ETL Pipeline Design', '<h2>Extract, Transform, Load</h2><p>Build data pipelines for processing.</p>', 0, true, v_instructor_id),
    (v_course_id, v_module_id, 'assignment', 'Build an ETL Pipeline', '<h3>ETL Project</h3><p>Create a complete ETL workflow.</p>', 1, true, v_instructor_id),
    (v_course_id, v_module_id, 'page', 'Data Quality', '<h2>Ensuring Data Quality</h2><p>Implement data validation and quality checks.</p>', 2, true, v_instructor_id);
  END IF;

  -- Module: Big Data Technologies
  SELECT id INTO v_module_id FROM modules WHERE course_id = v_course_id AND week = 3;
  IF v_module_id IS NOT NULL THEN
    INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by) VALUES
    (v_course_id, v_module_id, 'page', 'Introduction to Big Data', '<h2>Big Data Ecosystem</h2><p>Explore Hadoop, Spark, and distributed computing.</p>', 0, true, v_instructor_id),
    (v_course_id, v_module_id, 'assignment', 'Spark Data Processing', '<h3>Big Data Project</h3><p>Process large datasets using Apache Spark.</p>', 1, true, v_instructor_id),
    (v_course_id, v_module_id, 'quiz', 'Big Data Quiz', '<p>Assess your big data knowledge.</p>', 2, true, v_instructor_id);
  END IF;

END $$;
