-- ABOUTME: Read-only witness for the gradebook fixture: exact state of every fixture submission, its audit trail,
-- ABOUTME: and full-row hashes of everything the run must NOT touch. run.sh captures it before and after the browser run.
-- Output lines are plain text, ids and hashes only: no bodies, no feedback text (feedback is reported as md5).
\pset tuples_only on
\pset format unaligned
select 'STATE ' || right(s.id::text, 3)
    || ' grade=' || coalesce(trim_scale(s.grade::numeric)::text, 'NULL')
    || ' score=' || coalesce(trim_scale(s.score::numeric)::text, 'NULL')
    || ' state=' || coalesce(s.workflow_state, 'NULL')
    || ' comments_md5=' || coalesce(md5(s.grader_comments), 'NULL')
    || ' graded_at=' || case when s.graded_at is null then 'NULL' else 'set' end
    || ' attempt=' || s.attempt
  from public.assignment_submissions s
 where s.id::text like '9b6b0000-0000-4000-8000-0000000003%'
 order by s.id;
select 'AUDIT ' || right(e.submission_id::text, 3) || ' #' || row_number() over (partition by e.submission_id order by e.created_at, e.id)
    || ' action=' || e.action
    || ' actor=' || coalesce(right(e.actor_id::text, 3), 'NULL')
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
-- Observed only (the grade notification trigger is expected to add rows for the member; not asserted as policy).
select 'OBSERVED member_notifications ' || count(*) from public.notifications where user_id = 'e2e00000-0000-4000-8000-000000000003';
