-- ABOUTME: Removes the global-instructor clause from learner-data SELECT policies so an instructor
-- ABOUTME: can read progressions, quiz submissions and quiz answers only for courses they teach.
--
-- STATUS: PREPARED ON A BRANCH. NOT APPLIED TO PRODUCTION. Apply only through db-migrate.yml
-- after review (CLAUDE.md "Apply migrations through db-migrate.yml").
--
-- Problem (confirmed against the live catalog on 2026-10-31, pg_policies):
--   content_item_progressions  "Instructors can view course progressions"
--   quiz_submissions           "Instructors can view quiz submissions"
--   quiz_submission_answers    "Instructors can view quiz submission answers"
-- each carry the predicate
--   c.instructor_id = auth.uid() OR 'instructor' = ANY(get_user_roles(auth.uid())) OR 'admin' = ANY(get_user_roles(auth.uid()))
-- The middle disjunct grants EVERY account holding the instructor role read access to EVERY
-- course's learner rows. The UI's .eq('course_id', …) filters are not a security boundary
-- (handoff WP-02). assignment_submissions is already course-scoped via can_access_submission().
--
-- Fix: course scope through the course owner OR a course_assignments instructor row
-- (is_course_instructor), with admins unchanged. Learners' own-row policies are untouched, so
-- students keep seeing their own records. No table grants change. Additive-safe: narrows reads only.

begin;

drop policy if exists "Instructors can view course progressions" on public.content_item_progressions;
create policy "Instructors can view course progressions"
  on public.content_item_progressions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.content_items ci
      join public.courses c on c.id = ci.course_id
      where ci.id = content_item_progressions.content_item_id
        and (
          c.instructor_id = auth.uid()
          or public.is_course_instructor(auth.uid(), c.id)
          or public.has_admin_access(auth.uid())
        )
    )
  );

drop policy if exists "Instructors can view quiz submissions" on public.quiz_submissions;
create policy "Instructors can view quiz submissions"
  on public.quiz_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quizzes q
      join public.content_items ci on ci.id = q.content_item_id
      join public.courses c on c.id = ci.course_id
      where q.id = quiz_submissions.quiz_id
        and (
          c.instructor_id = auth.uid()
          or public.is_course_instructor(auth.uid(), c.id)
          or public.has_admin_access(auth.uid())
        )
    )
  );

drop policy if exists "Instructors can view quiz submission answers" on public.quiz_submission_answers;
create policy "Instructors can view quiz submission answers"
  on public.quiz_submission_answers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quiz_submissions qs
      join public.quizzes q on q.id = qs.quiz_id
      join public.content_items ci on ci.id = q.content_item_id
      join public.courses c on c.id = ci.course_id
      where qs.id = quiz_submission_answers.quiz_submission_id
        and (
          c.instructor_id = auth.uid()
          or public.is_course_instructor(auth.uid(), c.id)
          or public.has_admin_access(auth.uid())
        )
    )
  );

commit;
