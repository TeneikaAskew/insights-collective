-- ABOUTME: Read-only witness for the builder-authoring run (UNRUN), taken before the specs and again after them, before
-- ABOUTME: teardown. One line per row: a fixed kind, the row id, and an md5 of exactly the fields that must not change.
--
-- Kinds (ba-db.mjs `witness` runs this with psql variable :nonce = the run's created-title nonce):
--   b_course, b_module           course B and its sections: every column, including updated_at (nothing may touch B)
--   a_course                     course A: every authored field, not updated_at
--   a_module                     A's sections: id, course, title, published (position is the reorder's own target)
--   a_item                       A's lessons: id, course, section, type, title, content, published, settings (not position)
--   other_*                      one digest over every course/module/content_item outside this fixture and outside the
--                                run's own wizard-created courses (title = 'BA Wizard Course <nonce>'): nothing else may change
--   learner                      learner history on fixture courses; expected EMPTY, which means preservation of learner
--                                data is NOT exercised by this lane (stated, not claimed)
select 'b_course ' || c.id || ' ' || md5(row(c.*)::text) from public.courses c where c.id = '9b6e0000-0000-4000-8000-000000000002'
union all select 'b_module ' || m.id || ' ' || md5(row(m.*)::text) from public.modules m where m.course_id = '9b6e0000-0000-4000-8000-000000000002'
union all select 'b_item ' || i.id || ' ' || md5(row(i.*)::text) from public.content_items i where i.course_id = '9b6e0000-0000-4000-8000-000000000002'
union all select 'a_course ' || c.id || ' ' || md5(row(c.title, c.description, c.category, c.level, c.published, c.status, c.instructor_id)::text) from public.courses c where c.id = '9b6e0000-0000-4000-8000-000000000001'
union all select 'a_module ' || m.id || ' ' || md5(row(m.course_id, m.title, m.published)::text) from public.modules m where m.course_id = '9b6e0000-0000-4000-8000-000000000001'
union all select 'a_item ' || i.id || ' ' || md5(row(i.course_id, i.module_id, i.type, i.title, i.content, i.published, i.settings)::text) from public.content_items i where i.course_id = '9b6e0000-0000-4000-8000-000000000001'
union all select 'other_courses ' || count(*) || ' ' || coalesce(md5(string_agg(md5(row(c.*)::text), ',' order by c.id)), 'none') from public.courses c
  where c.id::text not like '9b6e0000-%' and c.title is distinct from ('BA Wizard Course ' || :'nonce')
union all select 'other_modules ' || count(*) || ' ' || coalesce(md5(string_agg(md5(row(m.*)::text), ',' order by m.id)), 'none') from public.modules m
  where m.course_id::text not like '9b6e0000-%' and m.course_id not in (select id from public.courses where title = 'BA Wizard Course ' || :'nonce')
union all select 'other_items ' || count(*) || ' ' || coalesce(md5(string_agg(md5(row(i.*)::text), ',' order by i.id)), 'none') from public.content_items i
  where i.course_id::text not like '9b6e0000-%' and i.course_id not in (select id from public.courses where title = 'BA Wizard Course ' || :'nonce')
union all select 'learner enrollments ' || count(*) from public.enrollments where course_id::text like '9b6e0000-%'
union all select 'learner progressions ' || count(*) from public.content_item_progressions where content_item_id::text like '9b6e0000-%'
union all select 'learner certificates ' || count(*) from public.certificates where course_id::text like '9b6e0000-%'
order by 1;
