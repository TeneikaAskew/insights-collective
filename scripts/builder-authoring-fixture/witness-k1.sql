-- ABOUTME: Read-only witness for the K1-only run (UNRUN), taken before the specs and again after them, before teardown.
-- ABOUTME: Courses A, B and S: every row WHOLE (every column). Nothing in this run may reorder, delete or create there.
--
-- Kinds (ba-db.mjs `witness-k1` runs this with psql variable :nonce = the run's nonce):
--   a_course, a_module, a_item   course A, its sections, its lessons: the whole row (no projection: no expected reorder or delete)
--   b_course, b_module, b_item   course B: the whole row
--   s_course, s_module, s_item   course S, the copy source: the whole row
--   other_*                      one digest over every course/module/content_item/quiz/assignment outside this fixture and
--                                outside the run's own copies (title = 'BA Wizard Copy <nonce>'). A C1 'BA Wizard Course'
--                                course is NOT excluded: any creation other than the copies changes other_courses.
--   copies                       the number of courses titled 'BA Wizard Copy <nonce>' (0 before; 3 after a complete run)
--   learner                      learner history on fixture courses; expected EMPTY (preservation not exercised)
select 'a_course ' || c.id || ' ' || md5(row(c.*)::text) from public.courses c where c.id = '9b6e0000-0000-4000-8000-000000000001'
union all select 'a_module ' || m.id || ' ' || md5(row(m.*)::text) from public.modules m where m.course_id = '9b6e0000-0000-4000-8000-000000000001'
union all select 'a_item ' || i.id || ' ' || md5(row(i.*)::text) from public.content_items i where i.course_id = '9b6e0000-0000-4000-8000-000000000001'
union all select 'b_course ' || c.id || ' ' || md5(row(c.*)::text) from public.courses c where c.id = '9b6e0000-0000-4000-8000-000000000002'
union all select 'b_module ' || m.id || ' ' || md5(row(m.*)::text) from public.modules m where m.course_id = '9b6e0000-0000-4000-8000-000000000002'
union all select 'b_item ' || i.id || ' ' || md5(row(i.*)::text) from public.content_items i where i.course_id = '9b6e0000-0000-4000-8000-000000000002'
union all select 's_course ' || c.id || ' ' || md5(row(c.*)::text) from public.courses c where c.id = '9b6e0000-0000-4000-8000-000000000003'
union all select 's_module ' || m.id || ' ' || md5(row(m.*)::text) from public.modules m where m.course_id = '9b6e0000-0000-4000-8000-000000000003'
union all select 's_item ' || i.id || ' ' || md5(row(i.*)::text) from public.content_items i where i.course_id = '9b6e0000-0000-4000-8000-000000000003'
union all select 'other_courses ' || count(*) || ' ' || coalesce(md5(string_agg(md5(row(c.*)::text), ',' order by c.id)), 'none') from public.courses c
  where c.id::text not like '9b6e0000-%' and c.title is distinct from ('BA Wizard Copy ' || :'nonce')
union all select 'other_modules ' || count(*) || ' ' || coalesce(md5(string_agg(md5(row(m.*)::text), ',' order by m.id)), 'none') from public.modules m
  where m.course_id::text not like '9b6e0000-%' and m.course_id not in (select id from public.courses where title = 'BA Wizard Copy ' || :'nonce')
union all select 'other_items ' || count(*) || ' ' || coalesce(md5(string_agg(md5(row(i.*)::text), ',' order by i.id)), 'none') from public.content_items i
  where i.course_id::text not like '9b6e0000-%' and i.course_id not in (select id from public.courses where title = 'BA Wizard Copy ' || :'nonce')
union all select 'other_quizzes ' || count(*) || ' ' || coalesce(md5(string_agg(md5(row(q.*)::text), ',' order by q.id)), 'none') from public.quizzes q
  where q.content_item_id is null or q.content_item_id not in (select i.id from public.content_items i join public.courses c on c.id = i.course_id where c.title = 'BA Wizard Copy ' || :'nonce')
union all select 'other_assignments ' || count(*) || ' ' || coalesce(md5(string_agg(md5(row(a.*)::text), ',' order by a.id)), 'none') from public.assignments a
  where a.course_id is null or a.course_id not in (select id from public.courses where title = 'BA Wizard Copy ' || :'nonce')
union all select 'copies ' || count(*) from public.courses where title = 'BA Wizard Copy ' || :'nonce'
union all select 'learner enrollments ' || count(*) from public.enrollments where course_id::text like '9b6e0000-%'
union all select 'learner progressions ' || count(*) from public.content_item_progressions where content_item_id::text like '9b6e0000-%'
union all select 'learner certificates ' || count(*) from public.certificates where course_id::text like '9b6e0000-%'
order by 1;
