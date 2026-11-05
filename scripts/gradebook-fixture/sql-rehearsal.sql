-- ABOUTME: LOCAL SQL rehearsal of the fixture's expected write classes, as the authenticated role with PostgREST-style
-- ABOUTME: JWT claims. Runs inside one transaction and ROLLS BACK. It is not API evidence: no PostgREST, no GoTrue.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
begin;
create temp table r(label text, rows int, grade numeric, comments_md5 text, state text) on commit drop;
grant all on r to authenticated;
-- I = e2e-instructor (teaches GB only), M = e2e-member (learner).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2e00000-0000-4000-8000-000000000002","role":"authenticated"}', true);
with u as (update public.assignment_submissions set grade = 7, grader_comments = 'Solid argument.', graded_at = now(), workflow_state = 'graded'
            where id = '9b6b0000-0000-4000-8000-000000000302' returning grade, grader_comments, workflow_state)
insert into r select 'I grades SG7=7', count(*), max(grade), max(md5(grader_comments)), max(workflow_state) from u;
with u as (update public.assignment_submissions set grade = 0, graded_at = now(), workflow_state = 'graded'
            where id = '9b6b0000-0000-4000-8000-000000000303' returning grade, grader_comments, workflow_state)
insert into r select 'I grades GB0=0', count(*), max(grade), max(md5(grader_comments)), max(workflow_state) from u;
with u as (update public.assignment_submissions set grade = 9, graded_at = now(), workflow_state = 'graded'
            where id = '9b6b0000-0000-4000-8000-000000000311' returning grade, grader_comments, workflow_state)
insert into r select 'I grades GX member row (not my course)', count(*), max(grade), max(md5(grader_comments)), max(workflow_state) from u;
select set_config('request.jwt.claims', '{"sub":"e2e00000-0000-4000-8000-000000000003","role":"authenticated"}', true);
with u as (update public.assignment_submissions set grade = 10, grader_comments = 'self'
            where id = '9b6b0000-0000-4000-8000-000000000302' returning grade, grader_comments, workflow_state)
insert into r select 'M rewrites own SG7 grade+feedback', count(*), max(grade), max(md5(grader_comments)), max(workflow_state) from u;
with u as (update public.assignment_submissions set grade = 10
            where id = '9b6b0000-0000-4000-8000-000000000312' returning grade, grader_comments, workflow_state)
insert into r select 'M grades admin GX row', count(*), max(grade), max(md5(grader_comments)), max(workflow_state) from u;
reset role;
select label || ': rows=' || rows || ' grade=' || coalesce(trim_scale(grade)::text, 'NULL') || ' comments_md5=' || coalesce(comments_md5, 'NULL') || ' state=' || coalesce(state, 'NULL') from r;
rollback;
