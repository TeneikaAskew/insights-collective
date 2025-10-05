-- Populate ALL remaining assignment and quiz backend records
INSERT INTO assignments (course_id, content_item_id, title, description, points, due_date, is_published)
SELECT ci.course_id, ci.id, ci.title, ci.content, 100, now() + interval '14 days', true
FROM content_items ci
WHERE ci.type = 'assignment'
AND NOT EXISTS (SELECT 1 FROM assignments WHERE content_item_id = ci.id);

INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, allowed_attempts)
SELECT ci.id, ci.title, ci.content, 'graded', 30, 3
FROM content_items ci
WHERE ci.type = 'quiz'
AND NOT EXISTS (SELECT 1 FROM quizzes WHERE content_item_id = ci.id);

INSERT INTO quiz_questions (quiz_id, question_text, question_type, points, position)
SELECT q.id, 'Q' || gs.n || ': ' || q.title,
  CASE WHEN gs.n % 3 = 0 THEN 'essay' WHEN gs.n % 3 = 1 THEN 'multiple_choice' ELSE 'true_false' END,
  10, gs.n - 1
FROM quizzes q
CROSS JOIN generate_series(1, 7) AS gs(n)
WHERE NOT EXISTS (SELECT 1 FROM quiz_questions WHERE quiz_id = q.id);