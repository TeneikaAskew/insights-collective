-- ABOUTME: UNRUN PROPOSAL. Minimal seed for the no-quiz authentic UI journey: ONE draft course shell taught by e2e-instructor
-- ABOUTME: (one page + one 10-point upload assignment) and ONE published control course (J0 positive control). Rest is UI-written.
--
-- Applied only after gates 1 to 4 pass and only to an owned, disposable stack whose pairing proof was produced BEFORE
-- this file runs (e2e/gradebook-roles/journey/pairing-proof.mjs). Never against any hosted project.
--
-- What this file does NOT create, on purpose (the journey must create them through the app's own UI and the real
-- API/Storage/RLS): course publication, enrollment, progression, submission, storage object, attachment, grade,
-- audit event, notification, certificate. It creates no policy, function, trigger, grant or bucket; it updates and
-- deletes nothing. Inserts are ON CONFLICT DO NOTHING; the final block REFUSES unless the exact pristine state holds,
-- so a used stack fails instead of running a journey on top of an earlier one.
begin;

-- Draft course: published=false, legacy status mirror 'draft' (publishPatch contract). Instructor is courses.instructor_id.
insert into public.courses (id, title, description, category, level, published, status, instructor_id)
values ('9b6c0000-0000-4000-8000-000000000001', 'Journey Fixture Course', 'Synthetic course for the authentic UI journey',
        'data-science', 'beginner', false, 'draft', 'e2e00000-0000-4000-8000-000000000002')
on conflict (id) do nothing;
insert into public.modules (id, course_id, title, week, position, published)
values ('9b6c0000-0000-4000-8000-000000000002', '9b6c0000-0000-4000-8000-000000000001', 'Journey module', 1, 1, true)
on conflict (id) do nothing;

-- Two published items: the readiness guard passes, and both count in check_course_completion and the issuer.
insert into public.content_items (id, course_id, module_id, type, title, content, position, published)
values ('9b6c0000-0000-4000-8000-000000000101', '9b6c0000-0000-4000-8000-000000000001', '9b6c0000-0000-4000-8000-000000000002',
        'page', 'Journey reading', '<p>Read this short page to the end.</p>', 1, true),
       ('9b6c0000-0000-4000-8000-000000000102', '9b6c0000-0000-4000-8000-000000000001', '9b6c0000-0000-4000-8000-000000000002',
        'assignment', 'Journey essay upload', '<p>Upload your essay as a PDF.</p>', 2, true)
on conflict (id) do nothing;
-- Upload-only, 10 points, one attempt, no due date (no "late" semantics are exercised), no rubric.
insert into public.assignments (id, course_id, module_id, content_item_id, title, instructions, points, submission_types, max_attempts, is_published)
values ('9b6c0000-0000-4000-8000-000000000202', '9b6c0000-0000-4000-8000-000000000001', '9b6c0000-0000-4000-8000-000000000002',
        '9b6c0000-0000-4000-8000-000000000102', 'Journey essay upload', 'Upload your essay as a PDF.', 10, array['online_upload'], 1, true)
on conflict (id) do nothing;

-- Published control course (J0's positive control: the catalog and detail routes render real data for this learner).
-- One published module and one published page; no assignment, no enrollment. It is never written to by the journey.
insert into public.courses (id, title, description, category, level, published, status, instructor_id)
values ('9b6c0000-0000-4000-8000-000000000011', 'Journey Control Course', 'Synthetic published control course for the journey',
        'data-science', 'beginner', true, 'published', 'e2e00000-0000-4000-8000-000000000002')
on conflict (id) do nothing;
insert into public.modules (id, course_id, title, week, position, published)
values ('9b6c0000-0000-4000-8000-000000000012', '9b6c0000-0000-4000-8000-000000000011', 'Control module', 1, 1, true)
on conflict (id) do nothing;
insert into public.content_items (id, course_id, module_id, type, title, content, position, published)
values ('9b6c0000-0000-4000-8000-000000000111', '9b6c0000-0000-4000-8000-000000000011', '9b6c0000-0000-4000-8000-000000000012',
        'page', 'Control reading', '<p>Control page.</p>', 1, true)
on conflict (id) do nothing;

-- Pristine-state check: refuse anything but the exact starting state.
do $$
declare n int;
begin
  select count(*) into n from public.courses where id = '9b6c0000-0000-4000-8000-000000000001' and published = false and status = 'draft'
     and instructor_id = 'e2e00000-0000-4000-8000-000000000002';
  if n <> 1 then raise exception 'JOURNEY SEED REFUSED: the journey course is not a draft taught by e2e-instructor'; end if;
  if not public.is_course_instructor('e2e00000-0000-4000-8000-000000000002', '9b6c0000-0000-4000-8000-000000000001') then
    raise exception 'JOURNEY SEED REFUSED: e2e-instructor does not teach the journey course';
  end if;
  if public.is_course_instructor('e2e00000-0000-4000-8000-000000000003', '9b6c0000-0000-4000-8000-000000000001')
     or public.has_admin_access('e2e00000-0000-4000-8000-000000000003') then
    raise exception 'JOURNEY SEED REFUSED: e2e-member is staff, so learner RLS would not be exercised';
  end if;
  select count(*) into n from public.content_items where course_id = '9b6c0000-0000-4000-8000-000000000001' and published = true;
  if n <> 2 then raise exception 'JOURNEY SEED REFUSED: % of 2 journey items are published', n; end if;
  select count(*) into n from public.assignments where id = '9b6c0000-0000-4000-8000-000000000202' and points = 10 and max_attempts = 1
     and submission_types = array['online_upload'];
  if n <> 1 then raise exception 'JOURNEY SEED REFUSED: the journey assignment is not the 10-point single-attempt upload'; end if;
  if exists (select 1 from public.enrollments where course_id = '9b6c0000-0000-4000-8000-000000000001') then
    raise exception 'JOURNEY SEED REFUSED: the journey course already has an enrollment (used stack)';
  end if;
  if exists (select 1 from public.assignment_submissions where assignment_id = '9b6c0000-0000-4000-8000-000000000202') then
    raise exception 'JOURNEY SEED REFUSED: the journey assignment already has a submission (used stack)';
  end if;
  if exists (select 1 from public.content_item_progressions where content_item_id::text like '9b6c0000-0000-4000-8000-0000000001%') then
    raise exception 'JOURNEY SEED REFUSED: journey items already have progress (used stack)';
  end if;
  if exists (select 1 from public.certificates where course_id = '9b6c0000-0000-4000-8000-000000000001') then
    raise exception 'JOURNEY SEED REFUSED: a journey certificate already exists (used stack)';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'course-documents' and name like 'submissions/9b6c0000-0000-4000-8000-000000000001/%') then
    raise exception 'JOURNEY SEED REFUSED: journey submission objects already exist in Storage (used stack)';
  end if;
  select count(*) into n from public.courses where id = '9b6c0000-0000-4000-8000-000000000011' and published = true and status = 'published';
  if n <> 1 then raise exception 'JOURNEY SEED REFUSED: the control course is not published'; end if;
  if exists (select 1 from public.enrollments where course_id = '9b6c0000-0000-4000-8000-000000000011')
     or exists (select 1 from public.content_item_progressions where content_item_id = '9b6c0000-0000-4000-8000-000000000111') then
    raise exception 'JOURNEY SEED REFUSED: the control course has learner state (used stack)';
  end if;
  if not exists (select 1 from storage.buckets where id = 'course-documents' and public = false) then
    raise exception 'JOURNEY SEED REFUSED: course-documents is missing or public, so private-bucket Storage policies would not be exercised';
  end if;
end $$;
commit;
select 'PASS journey seed: 1 draft course (1 module, page + 10-point upload assignment) and 1 published control course (1 module, 1 page); nothing else' as result;
