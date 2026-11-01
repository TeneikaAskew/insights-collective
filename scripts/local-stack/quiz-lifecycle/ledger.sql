-- ABOUTME: Read-only ledger for one scenario quiz of the learner lifecycle mode: every attempt and every answer row,
-- ABOUTME: as tab-separated lines with no auth columns. Run with psql -At -F $'\t' -v quiz=<uuid>.
-- Columns, attempts:  A <attempt> <submission id> <workflow_state> <score> <started_at> <finished_at> <answers count>
-- Columns, answers:   W <attempt> <question id> <answer json> <correct> <points> <answer row updated_at or created_at>
-- Columns, progress:  P <content item id> <workflow_state>
-- Nothing here writes; the session is set read-only first so a mistaken edit fails instead of mutating evidence.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
SELECT 'A', s.attempt, s.id, s.workflow_state, coalesce(s.score::text, ''), s.started_at, coalesce(s.finished_at::text, ''),
       (SELECT count(*) FROM public.quiz_submission_answers a WHERE a.quiz_submission_id = s.id)
  FROM public.quiz_submissions s
 WHERE s.quiz_id = :'quiz' AND s.user_id = '9c000000-0000-4000-8000-0000000000a1'
 ORDER BY s.attempt;
SELECT 'W', s.attempt, a.quiz_question_id, a.answer_data -> 'answer', coalesce(a.correct::text, ''), coalesce(a.points::text, ''),
       to_jsonb(a) ->> 'updated_at'
  FROM public.quiz_submission_answers a
  JOIN public.quiz_submissions s ON s.id = a.quiz_submission_id
 WHERE s.quiz_id = :'quiz' AND s.user_id = '9c000000-0000-4000-8000-0000000000a1'
 ORDER BY s.attempt, a.quiz_question_id;
SELECT 'P', p.content_item_id, p.workflow_state
  FROM public.content_item_progressions p
  JOIN public.quizzes q ON q.content_item_id = p.content_item_id
 WHERE q.id = :'quiz' AND p.user_id = '9c000000-0000-4000-8000-0000000000a1';
