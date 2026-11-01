-- ABOUTME: LOCAL-ONLY fixture for the gradebook real-role run: one course taught by e2e-instructor with four 10-point
-- ABOUTME: assignments, each holding one SUBMITTED, ungraded e2e-member submission with score NULL; plus one course the
-- ABOUTME: instructor does NOT teach (zero-row control). Applied only through run.sh, after the loopback target guard.
--
-- Ids are fixed (9b6b0000-...), so the witness can name every row. Inserts are ON CONFLICT DO NOTHING, and the final
-- block REFUSES unless every fixture row is in its exact pristine state: a second run on a used stack fails instead of
-- grading on top of an earlier result. No existing row is updated; no policy, function or trigger is created.
begin;

-- Course GB: e2e-instructor teaches it (courses.instructor_id), e2e-member is enrolled.
insert into public.courses (id, title, description, category, level, published, instructor_id)
values ('9b6b0000-0000-4000-8000-000000000001', 'Gradebook Points Fixture', 'Synthetic course for the 10-point grading run',
        'data-science', 'beginner', true, 'e2e00000-0000-4000-8000-000000000002')
on conflict (id) do nothing;
insert into public.modules (id, course_id, title, week, position, published)
values ('9b6b0000-0000-4000-8000-000000000002', '9b6b0000-0000-4000-8000-000000000001', 'Graded work', 1, 1, true)
on conflict (id) do nothing;

-- Four 10-point assignments: SG0/SG7 are graded in SpeedGrader, GB0/GB7 in the course gradebook.
insert into public.content_items (id, course_id, module_id, type, title, content, position, published)
select ci, '9b6b0000-0000-4000-8000-000000000001', '9b6b0000-0000-4000-8000-000000000002', 'assignment', t, '<p>Answer in a paragraph.</p>', p, true
from (values ('9b6b0000-0000-4000-8000-000000000101'::uuid, 'Points SG0', 1),
             ('9b6b0000-0000-4000-8000-000000000102'::uuid, 'Points SG7', 2),
             ('9b6b0000-0000-4000-8000-000000000103'::uuid, 'Points GB0', 3),
             ('9b6b0000-0000-4000-8000-000000000104'::uuid, 'Points GB7', 4)) v(ci, t, p)
on conflict (id) do nothing;
insert into public.assignments (id, course_id, module_id, content_item_id, title, instructions, points, submission_types, is_published)
select a, '9b6b0000-0000-4000-8000-000000000001', '9b6b0000-0000-4000-8000-000000000002', ci, t, 'Answer in a paragraph.', 10,
       array['online_text_entry'], true
from (values ('9b6b0000-0000-4000-8000-000000000201'::uuid, '9b6b0000-0000-4000-8000-000000000101'::uuid, 'Points SG0'),
             ('9b6b0000-0000-4000-8000-000000000202'::uuid, '9b6b0000-0000-4000-8000-000000000102'::uuid, 'Points SG7'),
             ('9b6b0000-0000-4000-8000-000000000203'::uuid, '9b6b0000-0000-4000-8000-000000000103'::uuid, 'Points GB0'),
             ('9b6b0000-0000-4000-8000-000000000204'::uuid, '9b6b0000-0000-4000-8000-000000000104'::uuid, 'Points GB7')) v(a, ci, t)
on conflict (id) do nothing;

-- Course GX: taught by e2e-admin only. e2e-instructor has no row in course_assignments and is not instructor_id.
insert into public.courses (id, title, description, category, level, published, instructor_id)
values ('9b6b0000-0000-4000-8000-000000000011', 'Gradebook Zero-Row Fixture', 'Synthetic course the fixture instructor does not teach',
        'data-science', 'beginner', true, 'e2e00000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
insert into public.content_items (id, course_id, type, title, content, position, published)
values ('9b6b0000-0000-4000-8000-000000000111', '9b6b0000-0000-4000-8000-000000000011', 'assignment', 'Points GX', '<p>x</p>', 1, true)
on conflict (id) do nothing;
insert into public.assignments (id, course_id, content_item_id, title, points, submission_types, is_published)
values ('9b6b0000-0000-4000-8000-000000000211', '9b6b0000-0000-4000-8000-000000000011', '9b6b0000-0000-4000-8000-000000000111',
        'Points GX', 10, array['online_text_entry'], true)
on conflict (id) do nothing;

insert into public.enrollments (user_id, course_id)
select 'e2e00000-0000-4000-8000-000000000003', c
from (values ('9b6b0000-0000-4000-8000-000000000001'::uuid), ('9b6b0000-0000-4000-8000-000000000011'::uuid)) v(c)
where not exists (select 1 from public.enrollments e where e.user_id = 'e2e00000-0000-4000-8000-000000000003' and e.course_id = v.c);

-- Submissions. 301..304: e2e-member on GB (to be graded). 311: e2e-member on GX (instructor zero-row target).
-- 312: e2e-admin's own row on GX (learner zero-row target). All submitted, grade/score/comments NULL.
insert into public.assignment_submissions (id, assignment_id, user_id, submitted_at, submission_type, body, workflow_state, attempt)
values ('9b6b0000-0000-4000-8000-000000000301', '9b6b0000-0000-4000-8000-000000000201', 'e2e00000-0000-4000-8000-000000000003', now() - interval '2 hours', 'online_text_entry', '<p>SG0 answer</p>', 'submitted', 1),
       ('9b6b0000-0000-4000-8000-000000000302', '9b6b0000-0000-4000-8000-000000000202', 'e2e00000-0000-4000-8000-000000000003', now() - interval '2 hours', 'online_text_entry', '<p>SG7 answer</p>', 'submitted', 1),
       ('9b6b0000-0000-4000-8000-000000000303', '9b6b0000-0000-4000-8000-000000000203', 'e2e00000-0000-4000-8000-000000000003', now() - interval '2 hours', 'online_text_entry', '<p>GB0 answer</p>', 'submitted', 1),
       ('9b6b0000-0000-4000-8000-000000000304', '9b6b0000-0000-4000-8000-000000000204', 'e2e00000-0000-4000-8000-000000000003', now() - interval '2 hours', 'online_text_entry', '<p>GB7 answer</p>', 'submitted', 1),
       ('9b6b0000-0000-4000-8000-000000000311', '9b6b0000-0000-4000-8000-000000000211', 'e2e00000-0000-4000-8000-000000000003', now() - interval '2 hours', 'online_text_entry', '<p>GX member</p>', 'submitted', 1),
       ('9b6b0000-0000-4000-8000-000000000312', '9b6b0000-0000-4000-8000-000000000211', 'e2e00000-0000-4000-8000-000000000001', now() - interval '2 hours', 'online_text_entry', '<p>GX admin</p>', 'submitted', 1)
on conflict (id) do nothing;

-- PROTECTED CANARIES (non-fixture, never touched by the run): one graded submission on its own course, an audit event,
-- a grades row (whose trigger writes grade_history), and a certificate. They make every protected hash in witness.sql
-- non-empty, so "unchanged" is a real observation. Written with service_role claims so the grade pins allow the grade.
select set_config('request.jwt.claims', '{"sub":"e2e00000-0000-4000-8000-000000000001","role":"service_role"}', true) is not null as canary_claims \gset
insert into public.courses (id, title, description, category, level, published, instructor_id)
values ('9b6b0000-0000-4000-8000-000000000021', 'Gradebook Canary Course', 'Synthetic protected canary', 'data-science', 'beginner', true, 'e2e00000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
insert into public.content_items (id, course_id, type, title, content, position, published)
values ('9b6b0000-0000-4000-8000-000000000121', '9b6b0000-0000-4000-8000-000000000021', 'assignment', 'Canary', '<p>c</p>', 1, true)
on conflict (id) do nothing;
insert into public.assignments (id, course_id, content_item_id, title, points, submission_types, is_published)
values ('9b6b0000-0000-4000-8000-000000000221', '9b6b0000-0000-4000-8000-000000000021', '9b6b0000-0000-4000-8000-000000000121', 'Canary', 10, array['online_text_entry'], true)
on conflict (id) do nothing;
insert into public.assignment_submissions (id, assignment_id, user_id, submitted_at, submission_type, body, workflow_state, attempt, grade, graded_at, grader_comments)
values ('9b6b0000-0000-4000-8000-000000000401', '9b6b0000-0000-4000-8000-000000000221', 'e2e00000-0000-4000-8000-000000000001',
        '2026-01-01T00:00:00Z', 'online_text_entry', '<p>canary</p>', 'graded', 1, 5, '2026-01-02T00:00:00Z', '<p>canary feedback</p>')
on conflict (id) do nothing;
insert into public.submission_audit_events (id, actor_id, action, submission_id, student_id, assignment_id, course_id, details, created_at)
values ('9b6b0000-0000-4000-8000-000000000501', 'e2e00000-0000-4000-8000-000000000001', 'comment_posted', '9b6b0000-0000-4000-8000-000000000401',
        'e2e00000-0000-4000-8000-000000000001', '9b6b0000-0000-4000-8000-000000000221', '9b6b0000-0000-4000-8000-000000000021', '{"canary":true}', '2026-01-02T00:00:00Z')
on conflict (id) do nothing;
insert into public.grades (id, course_id, student_id, assignment_id, grade_type, points_earned, points_possible, percentage, comments, created_at, updated_at)
values ('9b6b0000-0000-4000-8000-000000000601', '9b6b0000-0000-4000-8000-000000000021', 'e2e00000-0000-4000-8000-000000000001',
        '9b6b0000-0000-4000-8000-000000000221', 'assignment', 5, 10, 50, 'canary', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')
on conflict (id) do nothing;
insert into public.certificates (id, user_id, course_id, certificate_type, verification_code, issued_at)
values ('9b6b0000-0000-4000-8000-000000000701', 'e2e00000-0000-4000-8000-000000000001', '9b6b0000-0000-4000-8000-000000000021', 'completion', 'GBCANARY0001', '2026-01-03T00:00:00Z')
on conflict (id) do nothing;

-- Pristine-state check: refuse anything but the exact starting state.
do $$
declare n int;
begin
  select count(*) into n from public.assignment_submissions
   where id::text like '9b6b0000-0000-4000-8000-0000000003%'
     and workflow_state = 'submitted' and grade is null and score is null and grader_comments is null and graded_at is null
     and rubric_scores is null and attempt = 1;
  if n <> 6 then raise exception 'GRADEBOOK FIXTURE REFUSED: % of 6 fixture submissions are pristine (a used stack, or a trigger rewrote a row)', n; end if;
  select count(*) into n from public.assignments where points = 10 and id in ('9b6b0000-0000-4000-8000-000000000201', '9b6b0000-0000-4000-8000-000000000202',
    '9b6b0000-0000-4000-8000-000000000203', '9b6b0000-0000-4000-8000-000000000204', '9b6b0000-0000-4000-8000-000000000211');
  if n <> 5 then raise exception 'GRADEBOOK FIXTURE REFUSED: % of 5 fixture assignments carry points = 10', n; end if;
  if public.is_course_instructor('e2e00000-0000-4000-8000-000000000002', '9b6b0000-0000-4000-8000-000000000011') then
    raise exception 'GRADEBOOK FIXTURE REFUSED: e2e-instructor teaches GX, so the zero-row control would be vacuous';
  end if;
  if not public.is_course_instructor('e2e00000-0000-4000-8000-000000000002', '9b6b0000-0000-4000-8000-000000000001') then
    raise exception 'GRADEBOOK FIXTURE REFUSED: e2e-instructor does not teach GB';
  end if;
  select count(*) into n from public.assignment_submissions where id = '9b6b0000-0000-4000-8000-000000000401' and grade = 5 and workflow_state = 'graded';
  if n <> 1 then raise exception 'GRADEBOOK FIXTURE REFUSED: canary submission missing or altered'; end if;
  select (select count(*) from public.grades where id = '9b6b0000-0000-4000-8000-000000000601')
       + (select count(*) from public.grade_history where grade_id = '9b6b0000-0000-4000-8000-000000000601')
       + (select count(*) from public.certificates where id = '9b6b0000-0000-4000-8000-000000000701')
       + (select count(*) from public.submission_audit_events where id = '9b6b0000-0000-4000-8000-000000000501') into n;
  if n < 4 then raise exception 'GRADEBOOK FIXTURE REFUSED: % of 4 protected canaries present (grades, grade_history, certificate, audit)', n; end if;
  if exists (select 1 from public.submission_audit_events where submission_id::text like '9b6b0000-0000-4000-8000-0000000003%') then
    raise exception 'GRADEBOOK FIXTURE REFUSED: audit events already exist for fixture submissions';
  end if;
end $$;
commit;
select 'PASS gradebook fixture seeded: 2 fixture courses, 5 ten-point assignments, 6 pristine submissions (score NULL); protected canaries present' as result;
