-- ABOUTME: UNRUN PROPOSAL. Read-only witness for the no-quiz journey, captured before and after the browser run. It prints the
-- ABOUTME: exact journey-scope state, a MANIFEST of every row the run created (full UUIDs), and hashes of everything else.
--
-- Output is ids, states, counts, timestamps-as-order and hashes only: no bodies, no feedback text (md5), no storage
-- content, no tokens and no URLs. Journey scope = rows keyed to course 9b6c...0001, its items/assignment, the learner's
-- submissions/<course>/<learner>/ storage prefix, and audit/notification rows that point at that course.
\pset tuples_only on
\pset format unaligned

-- Course publication (written by J1 through the builder).
select 'COURSE ' || c.id::text || ' published=' || coalesce(c.published::text, 'NULL') || ' status=' || coalesce(c.status, 'NULL')
  from public.courses c where c.id = '9b6c0000-0000-4000-8000-000000000001';

-- Enrollment (J2a). Exactly one row for e2e-member is expected after the run, none before.
select 'ENROLL ' || e.id::text || ' user=' || e.user_id::text || ' completion_status=' || coalesce(e.completion_status::text, 'NULL')
  from public.enrollments e where e.course_id = '9b6c0000-0000-4000-8000-000000000001' order by e.id;

-- Progress (J2b page read, J2c assignment completion).
select 'PROG ' || p.id::text || ' user=' || p.user_id::text || ' item=' || p.content_item_id::text || ' state=' || coalesce(p.workflow_state, 'NULL')
  from public.content_item_progressions p where p.content_item_id::text like '9b6c0000-0000-4000-8000-0000000001%' order by p.content_item_id, p.id;

-- Submission (J2c) and grade (J3b).
select 'SUB ' || s.id::text || ' user=' || s.user_id::text || ' assignment=' || s.assignment_id::text
    || ' state=' || coalesce(s.workflow_state, 'NULL') || ' type=' || coalesce(s.submission_type, 'NULL') || ' attempt=' || s.attempt
    || ' submitted_at=' || case when s.submitted_at is null then 'NULL' else 'set' end
    || ' grade=' || coalesce(trim_scale(s.grade::numeric)::text, 'NULL') || ' score=' || coalesce(trim_scale(s.score::numeric)::text, 'NULL')
    || ' comments_md5=' || coalesce(md5(s.grader_comments), 'NULL') || ' graded_at=' || case when s.graded_at is null then 'NULL' else 'set' end
  from public.assignment_submissions s where s.assignment_id = '9b6c0000-0000-4000-8000-000000000202' order by s.id;

-- Attachment rows and the Storage objects they name (J2c). Size and MIME come from Storage metadata, not from the row.
select 'ATT ' || a.id::text || ' submission=' || a.submission_id::text || ' filename=' || a.filename || ' size=' || coalesce(a.size::text, 'NULL')
    || ' key_in_learner_prefix=' || (a.url like 'submissions/9b6c0000-0000-4000-8000-000000000001/e2e00000-0000-4000-8000-000000000003/%')::text
    || ' object_exists=' || exists (select 1 from storage.objects o where o.bucket_id = 'course-documents' and o.name = a.url)::text
  from public.submission_attachments a
  join public.assignment_submissions s on s.id = a.submission_id
 where s.assignment_id = '9b6c0000-0000-4000-8000-000000000202' order by a.id;
select 'OBJ ' || o.id::text || ' bucket=' || o.bucket_id || ' owner=' || coalesce(o.owner::text, 'NULL')
    || ' in_learner_prefix=' || (o.name like 'submissions/9b6c0000-0000-4000-8000-000000000001/e2e00000-0000-4000-8000-000000000003/%')::text
    || ' size=' || coalesce(o.metadata ->> 'size', 'NULL') || ' mimetype=' || coalesce(o.metadata ->> 'mimetype', 'NULL')
  from storage.objects o where o.bucket_id = 'course-documents' and o.name like 'submissions/9b6c0000-0000-4000-8000-000000000001/%' order by o.id;

-- Certificate (auto-issued by the existing trigger). Issued-before-graded is printed as an ORDER fact, not a time.
select 'CERT ' || c.id::text || ' user=' || c.user_id::text || ' type=' || c.certificate_type
    || ' auto_issued=' || coalesce(c.certificate_data ->> 'auto_issued', 'NULL') || ' total_items=' || coalesce(c.certificate_data ->> 'total_items', 'NULL')
    || ' code_shape_ok=' || (c.verification_code ~ '^[0-9A-F]{12}$')::text
    || ' issued_before_graded=' || coalesce((select (c.issued_at < s.graded_at)::text from public.assignment_submissions s
                                              where s.assignment_id = '9b6c0000-0000-4000-8000-000000000202' and s.user_id = c.user_id and s.graded_at is not null), 'NO_GRADE')
  from public.certificates c where c.course_id = '9b6c0000-0000-4000-8000-000000000001' order by c.id;

-- Audit trail for journey submissions, in order, every column the comparator pins (details as jsonb text, key order fixed by
-- jsonb). Expected from source: file_downloaded (log_submission_file_access, J3a) then grade_posted (audit_submission_grade, J3b).
select 'AUDIT #' || row_number() over (order by e.created_at, e.id) || ' action=' || e.action || ' actor=' || coalesce(e.actor_id::text, 'NULL')
    || ' submission=' || coalesce(e.submission_id::text, 'NULL') || ' student=' || coalesce(e.student_id::text, 'NULL')
    || ' assignment=' || coalesce(e.assignment_id::text, 'NULL') || ' course=' || coalesce(e.course_id::text, 'NULL')
    || ' module=' || coalesce(e.module_id::text, 'NULL') || ' attachment=' || coalesce(e.attachment_id::text, 'NULL')
    || ' filename=' || coalesce(e.filename, 'NULL') || ' details=' || coalesce(e.details::text, 'NULL')
  from public.submission_audit_events e
 where e.course_id = '9b6c0000-0000-4000-8000-000000000001'
    or e.submission_id in (select s.id from public.assignment_submissions s where s.assignment_id = '9b6c0000-0000-4000-8000-000000000202')
 order by e.created_at, e.id;

-- Notifications on the journey course, as a sorted multiset without row identity or reader state (title, message, link pinned).
select line from (
  select 'NOTIF user=' || coalesce(n.user_id::text, 'NULL') || ' type=' || coalesce(n.type, 'NULL') || ' title=' || coalesce(n.title, 'NULL')
      || ' message=' || coalesce(n.message, 'NULL') || ' link=' || coalesce(n.link, 'NULL') as line
    from public.notifications n where n.course_id = '9b6c0000-0000-4000-8000-000000000001') x order by line collate "C";

-- MANIFEST: every journey-scope row id, by table. The runner diffs pre vs post: the ADDED ids are the run-created rows.
-- There is NO cleanup SQL: the disposable stack is destroyed with the job. The manifest is the ownership record.
select 'MANIFEST ' || t || ' ' || id from (
  select 'enrollments' t, id::text id from public.enrollments where course_id = '9b6c0000-0000-4000-8000-000000000001'
  union all select 'content_item_progressions', id::text from public.content_item_progressions where content_item_id::text like '9b6c0000-0000-4000-8000-0000000001%'
  union all select 'assignment_submissions', id::text from public.assignment_submissions where assignment_id = '9b6c0000-0000-4000-8000-000000000202'
  union all select 'submission_attachments', a.id::text from public.submission_attachments a join public.assignment_submissions s on s.id = a.submission_id where s.assignment_id = '9b6c0000-0000-4000-8000-000000000202'
  union all select 'storage.objects', id::text from storage.objects where bucket_id = 'course-documents' and name like 'submissions/9b6c0000-0000-4000-8000-000000000001/%'
  union all select 'certificates', id::text from public.certificates where course_id = '9b6c0000-0000-4000-8000-000000000001'
  union all select 'submission_audit_events', id::text from public.submission_audit_events where course_id = '9b6c0000-0000-4000-8000-000000000001'
  union all select 'notifications', id::text from public.notifications where course_id = '9b6c0000-0000-4000-8000-000000000001'
) m order by t, id;

-- PROTECTED: everything outside journey scope must be byte-identical before and after (NULL- and position-preserving).
select 'HASH other_courses ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.courses t where t.id <> '9b6c0000-0000-4000-8000-000000000001';
select 'HASH other_enrollments ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.enrollments t where t.course_id <> '9b6c0000-0000-4000-8000-000000000001';
select 'HASH other_progressions ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.content_item_progressions t where t.content_item_id::text not like '9b6c0000-0000-4000-8000-0000000001%';
select 'HASH other_submissions ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.assignment_submissions t where t.assignment_id <> '9b6c0000-0000-4000-8000-000000000202';
select 'HASH other_attachments ' || count(*) || ' ' || coalesce(md5(string_agg(a::text, '|' order by a.id)), 'empty') from public.submission_attachments a join public.assignment_submissions s on s.id = a.submission_id where s.assignment_id <> '9b6c0000-0000-4000-8000-000000000202';
select 'HASH other_objects ' || count(*) || ' ' || coalesce(md5(string_agg(jsonb_build_array(t.id, t.bucket_id, t.name, t.owner, t.metadata, t.updated_at)::text, '#' order by t.id)), 'empty') from storage.objects t where not (t.bucket_id = 'course-documents' and t.name like 'submissions/9b6c0000-0000-4000-8000-000000000001/%');
select 'HASH buckets ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from storage.buckets t;
select 'HASH other_certificates ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.certificates t where t.course_id <> '9b6c0000-0000-4000-8000-000000000001';
select 'HASH other_audit_events ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.submission_audit_events t where t.course_id is distinct from '9b6c0000-0000-4000-8000-000000000001';
select 'HASH other_notifications ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.notifications t where t.course_id is distinct from '9b6c0000-0000-4000-8000-000000000001';
select 'HASH other_modules ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.modules t where t.course_id <> '9b6c0000-0000-4000-8000-000000000001';
select 'HASH other_items ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.content_items t where t.course_id <> '9b6c0000-0000-4000-8000-000000000001';
select 'HASH other_assignments ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.assignments t where t.id <> '9b6c0000-0000-4000-8000-000000000202';
select 'HASH quiz_submissions ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.quiz_submissions t;
select 'HASH quiz_submission_answers ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.quiz_submission_answers t;
select 'HASH grade_change_notifications ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.grade_change_notifications t;
-- certificate_verification_attempts exists only where its migration is applied; absence is printed, never skipped silently.
select to_regclass('public.certificate_verification_attempts') is not null as has_cva \gset
\if :has_cva
select 'HASH certificate_verification_attempts ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.certificate_verification_attempts t;
\else
select 'HASH certificate_verification_attempts ABSENT';
\endif
-- Full Storage (every object, journey prefix included, as id/bucket/name/owner/metadata) is listed in OBJ/MANIFEST and
-- other_objects; the bucket rows are hashed whole.
select 'HASH grades ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.grades t;
select 'HASH grade_history ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.grade_history t;
-- Journey course row minus the two columns J1 writes and its updated_at: nothing else on the course may change.
select 'HASH journey_course_rest ' || md5((to_jsonb(c) - 'published' - 'status' - 'updated_at')::text) from public.courses c where c.id = '9b6c0000-0000-4000-8000-000000000001';
-- Journey shell rows the run must not change (the course row changes only in published/status, checked by COURSE above).
select 'HASH journey_modules_items_assignment ' || md5(
       (select string_agg(t::text, '|' order by t.id) from public.modules t where t.id = '9b6c0000-0000-4000-8000-000000000002')
    || (select string_agg(t::text, '|' order by t.id) from public.content_items t where t.course_id = '9b6c0000-0000-4000-8000-000000000001')
    || (select string_agg(t::text, '|' order by t.id) from public.assignments t where t.id = '9b6c0000-0000-4000-8000-000000000202'));
