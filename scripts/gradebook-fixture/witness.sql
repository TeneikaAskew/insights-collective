-- ABOUTME: Read-only witness for the gradebook fixture: exact state of every fixture submission, its audit trail,
-- ABOUTME: and full-row hashes of everything the run must NOT touch. run.sh captures it before and after the browser run.
-- Ids are printed IN FULL (never a suffix: a different user/row with the same last digits must not match).
-- Output lines are plain text, ids and hashes only: no bodies, no feedback text (feedback is reported as md5).
\pset tuples_only on
\pset format unaligned
select 'STATE ' || s.id::text
    || ' grade=' || coalesce(trim_scale(s.grade::numeric)::text, 'NULL')
    || ' score=' || coalesce(trim_scale(s.score::numeric)::text, 'NULL')
    || ' state=' || coalesce(s.workflow_state, 'NULL')
    || ' comments_md5=' || coalesce(md5(s.grader_comments), 'NULL')
    || ' graded_at=' || case when s.graded_at is null then 'NULL' else 'set' end
    || ' attempt=' || s.attempt
  from public.assignment_submissions s
 where s.id::text like '9b6b0000-0000-4000-8000-0000000003%'
 order by s.id;
select 'AUDIT ' || e.submission_id::text || ' #' || row_number() over (partition by e.submission_id order by e.created_at, e.id)
    || ' action=' || e.action
    || ' actor=' || coalesce(e.actor_id::text, 'NULL')
    || ' old_grade=' || coalesce(trim_scale((e.details ->> 'old_grade')::numeric)::text, 'NULL')
    || ' new_grade=' || coalesce(trim_scale((e.details ->> 'new_grade')::numeric)::text, 'NULL')
    || ' old_state=' || coalesce(e.details ->> 'old_workflow_state', 'NULL')
    || ' new_state=' || coalesce(e.details ->> 'new_workflow_state', 'NULL')
    || ' comments_changed=' || coalesce(e.details ->> 'grader_comments_changed', 'NULL')
  from public.submission_audit_events e
 where e.submission_id::text like '9b6b0000-0000-4000-8000-0000000003%'
 order by e.submission_id, e.created_at, e.id;
-- Protected: every row the run must leave byte-identical (full row text, including updated_at).
select 'HASH other_submissions ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty')
  from public.assignment_submissions t where t.id::text not like '9b6b0000-0000-4000-8000-0000000003%';
select 'HASH other_audit_events ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty')
  from public.submission_audit_events t where t.submission_id is null or t.submission_id::text not like '9b6b0000-0000-4000-8000-0000000003%';
select 'HASH grades ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.grades t;
select 'HASH grade_history ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.grade_history t;
select 'HASH certificates ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.certificates t;
select 'HASH fixture_assignments ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty')
  from public.assignments t where t.id::text like '9b6b0000-0000-4000-8000-0000000002%';
-- Immutable parts of the fixture itself: submission identity/content (everything a grader must never change), and the
-- course/module/item/assignment/enrollment rows the fixture stands on.
-- Encoded as a JSON array: every field keeps its POSITION and NULL stays a distinct JSON null (concat_ws would skip NULLs,
-- so body='x',url=NULL and body=NULL,url='x' used to hash the same; see the relocation negative in the rehearsal).
select 'HASH fixture_submission_immutable ' || count(*) || ' ' || md5(string_agg(jsonb_build_array(t.id, t.assignment_id, t.user_id, t.body, t.url,
         t.submission_type, t.submitted_at, t.attempt, t.rubric_scores, t.excused, t.late, t.missing, t.created_at)::text, '#' order by t.id))
  from public.assignment_submissions t where t.id::text like '9b6b0000-0000-4000-8000-0000000003%';
select 'HASH fixture_courses ' || count(*) || ' ' || md5(string_agg(t::text, '|' order by t.id)) from public.courses t where t.id::text like '9b6b0000-0000-4000-8000-00000000000%' or t.id::text like '9b6b0000-0000-4000-8000-00000000001%' or t.id::text like '9b6b0000-0000-4000-8000-00000000002%';
select 'HASH fixture_modules ' || count(*) || ' ' || md5(string_agg(t::text, '|' order by t.id)) from public.modules t where t.id = '9b6b0000-0000-4000-8000-000000000002';
select 'HASH fixture_items ' || count(*) || ' ' || md5(string_agg(t::text, '|' order by t.id)) from public.content_items t where t.id::text like '9b6b0000-0000-4000-8000-0000000001%';
select 'HASH fixture_enrollments ' || count(*) || ' ' || md5(string_agg(jsonb_build_array(t.id, t.user_id, t.course_id, t.enrolled_at, t.completion_status)::text, '#' order by t.id))
  from public.enrollments t where t.course_id::text like '9b6b0000-0000-4000-8000-0000000000%';
-- Observed only, NOT asserted: progress on fixture items (a learner opening a lesson may legitimately record it).
select 'OBSERVED fixture_item_progressions ' || count(*) from public.content_item_progressions where content_item_id::text like '9b6b0000-0000-4000-8000-0000000001%';
-- Notifications on the two fixture courses are ASSERTED as an exact multiset (sorted lines; id, created_at, is_read and
-- email_digest_sent_at excluded because they are row identity or reader state, not trigger output). The grade trigger
-- (notify_student_on_grade) must add exactly one row per real grade/feedback change and none for pinned, zero-row or
-- feedback-less changes. Every other notification row is protected byte-identical.
select line from (
  select 'NOTIF user=' || coalesce(n.user_id::text, 'NULL') || ' course=' || n.course_id::text
      || ' type=' || coalesce(n.type, 'NULL') || ' title=' || coalesce(n.title, 'NULL') || ' message=' || coalesce(n.message, 'NULL')
      || ' link=' || coalesce(n.link, 'NULL') as line
    from public.notifications n
   where n.course_id in ('9b6b0000-0000-4000-8000-000000000001', '9b6b0000-0000-4000-8000-000000000011')) x
 order by line collate "C";
select 'HASH other_notifications ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty')
  from public.notifications t
 where t.course_id is null or t.course_id not in ('9b6b0000-0000-4000-8000-000000000001', '9b6b0000-0000-4000-8000-000000000011');
-- Observed only: reader state of the fixture-course notifications (the learner UI may mark them read).
select 'OBSERVED fixture_notifications_read ' || count(*) filter (where is_read) || '/' || count(*)
  from public.notifications where course_id in ('9b6b0000-0000-4000-8000-000000000001', '9b6b0000-0000-4000-8000-000000000011');
