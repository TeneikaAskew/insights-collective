-- Add the 'answers' JSONB column to quiz_questions that the frontend expects.
-- The existing 'options' column stores plain string arrays; 'answers' stores
-- structured objects: [{id, text, correct, weight?, feedback?}].

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '[]'::jsonb;

-- Populate the Supervised Learning Quiz (3ea7cb2b-af45-4282-a215-3d74b7df6baf)
-- with real questions and answer options so the inline quiz player works.

UPDATE public.quiz_questions SET
  question_text = 'Which of the following best describes supervised learning?',
  question_type = 'multiple_choice',
  answers = '[
    {"id": "a1", "text": "Learning from labeled training data with known outcomes", "correct": true},
    {"id": "a2", "text": "Learning from unlabeled data to find hidden patterns", "correct": false},
    {"id": "a3", "text": "Learning through trial and error with rewards", "correct": false},
    {"id": "a4", "text": "Learning without any data at all", "correct": false}
  ]'::jsonb,
  points = 10
WHERE id = 'b4310680-6a2f-4c30-8fa2-9d3221bac324';

UPDATE public.quiz_questions SET
  question_text = 'True or False: In supervised learning, the model is trained on data that includes both input features and correct output labels.',
  question_type = 'true_false',
  answers = '[
    {"id": "t1", "text": "True", "correct": true},
    {"id": "t2", "text": "False", "correct": false}
  ]'::jsonb,
  points = 10
WHERE id = '6aa76a4f-083a-4128-af90-967125fdd7b1';

UPDATE public.quiz_questions SET
  question_text = 'Which algorithm is commonly used for classification tasks in supervised learning?',
  question_type = 'multiple_choice',
  answers = '[
    {"id": "b1", "text": "K-Means Clustering", "correct": false},
    {"id": "b2", "text": "Logistic Regression", "correct": true},
    {"id": "b3", "text": "Principal Component Analysis", "correct": false},
    {"id": "b4", "text": "DBSCAN", "correct": false}
  ]'::jsonb,
  points = 10
WHERE id = '8164e722-bfa1-47de-b591-d1f5f04954c5';

UPDATE public.quiz_questions SET
  question_text = 'What is the difference between regression and classification in supervised learning?',
  question_type = 'multiple_choice',
  answers = '[
    {"id": "c1", "text": "Regression predicts continuous values; classification predicts discrete categories", "correct": true},
    {"id": "c2", "text": "They are the same thing", "correct": false},
    {"id": "c3", "text": "Classification predicts continuous values; regression predicts categories", "correct": false},
    {"id": "c4", "text": "Neither uses labeled data", "correct": false}
  ]'::jsonb,
  points = 10
WHERE id = '71e86347-6b3b-4e69-a367-1c6aa5a9dcab';

UPDATE public.quiz_questions SET
  question_text = 'Which of the following are examples of supervised learning algorithms? (Select all that apply)',
  question_type = 'multiple_answers',
  answers = '[
    {"id": "d1", "text": "Decision Trees", "correct": true},
    {"id": "d2", "text": "K-Nearest Neighbors", "correct": true},
    {"id": "d3", "text": "K-Means Clustering", "correct": false},
    {"id": "d4", "text": "Support Vector Machines", "correct": true},
    {"id": "d5", "text": "Autoencoders", "correct": false}
  ]'::jsonb,
  points = 15
WHERE id = 'e956cd30-6ec8-4002-8d69-d43cbdb8aaac';

UPDATE public.quiz_questions SET
  question_text = 'What is overfitting in the context of supervised learning?',
  question_type = 'multiple_choice',
  answers = '[
    {"id": "e1", "text": "When a model performs well on training data but poorly on unseen data", "correct": true},
    {"id": "e2", "text": "When a model is too simple to capture the underlying pattern", "correct": false},
    {"id": "e3", "text": "When the training dataset is too large", "correct": false},
    {"id": "e4", "text": "When features are perfectly correlated", "correct": false}
  ]'::jsonb,
  points = 10
WHERE id = 'bd940116-ad72-495d-ba85-26328d5b936a';

UPDATE public.quiz_questions SET
  question_text = 'Briefly explain why splitting data into training and test sets is important in supervised learning.',
  question_type = 'short_answer',
  answers = '[]'::jsonb,
  points = 15
WHERE id = '3d9fec59-db90-482a-a3f9-39498523f264';
