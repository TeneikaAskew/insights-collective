-- ABOUTME: Read-only witness for the builder-authoring run (UNRUN), taken before the specs and again after them, before
-- ABOUTME: teardown. One line per row: a fixed kind, the row id, and an md5 of exactly the projection that must not change.
--
-- Kinds (ba-db.mjs `witness` runs this with psql variable :nonce = the run's created-title nonce):
--   b_course, b_module, b_item   course B, its sections and its lessons: the whole row, every column including updated_at
--   a_course                     course A: every column EXCEPT updated_at
--   a_module                     A's sections: every column EXCEPT position (the reorder's target) and updated_at
--   a_item                       A's lessons: every column EXCEPT position and updated_at (the row trigger sets it on reorder)
--   probe <kind>                 mutation negative for those three projections, computed live: for every row and every
--                                column the row has, replacing that one value must change the projection's md5, except
--                                exactly the excluded columns. Prints: rows, row-keys, sensitive row-keys, excluded row-keys.
--   other_*                      one digest over every course/module/content_item outside this fixture and outside the
--                                run's own wizard-created courses (title = 'BA Wizard Course <nonce>'): nothing else may change
--   learner                      learner history on fixture courses; expected EMPTY, which means preservation of learner
--                                data is NOT exercised by this lane (stated, not claimed)
select 'b_course ' || c.id || ' ' || md5(row(c.*)::text) from public.courses c where c.id = '9b6e0000-0000-4000-8000-000000000002'
union all select 'b_module ' || m.id || ' ' || md5(row(m.*)::text) from public.modules m where m.course_id = '9b6e0000-0000-4000-8000-000000000002'
union all select 'b_item ' || i.id || ' ' || md5(row(i.*)::text) from public.content_items i where i.course_id = '9b6e0000-0000-4000-8000-000000000002'
union all select 'a_course ' || c.id || ' ' || md5((to_jsonb(c) - 'updated_at')::text) from public.courses c where c.id = '9b6e0000-0000-4000-8000-000000000001'
union all select 'a_module ' || m.id || ' ' || md5((to_jsonb(m) - 'position' - 'updated_at')::text) from public.modules m where m.course_id = '9b6e0000-0000-4000-8000-000000000001'
union all select 'a_item ' || i.id || ' ' || md5((to_jsonb(i) - 'position' - 'updated_at')::text) from public.content_items i where i.course_id = '9b6e0000-0000-4000-8000-000000000001'
union all select 'probe a_course ' || count(distinct c.id) || ' ' || count(*) || ' ' ||
  count(*) filter (where md5((to_jsonb(c) - 'updated_at')::text) <> md5((jsonb_set(to_jsonb(c), array[k.key], '"ba-probe"'::jsonb) - 'updated_at')::text)) || ' ' ||
  count(*) filter (where k.key in ('updated_at'))
  from public.courses c cross join lateral jsonb_object_keys(to_jsonb(c)) as k(key) where c.id = '9b6e0000-0000-4000-8000-000000000001'
union all select 'probe a_module ' || count(distinct m.id) || ' ' || count(*) || ' ' ||
  count(*) filter (where md5((to_jsonb(m) - 'position' - 'updated_at')::text) <> md5((jsonb_set(to_jsonb(m), array[k.key], '"ba-probe"'::jsonb) - 'position' - 'updated_at')::text)) || ' ' ||
  count(*) filter (where k.key in ('position', 'updated_at'))
  from public.modules m cross join lateral jsonb_object_keys(to_jsonb(m)) as k(key) where m.course_id = '9b6e0000-0000-4000-8000-000000000001'
union all select 'probe a_item ' || count(distinct i.id) || ' ' || count(*) || ' ' ||
  count(*) filter (where md5((to_jsonb(i) - 'position' - 'updated_at')::text) <> md5((jsonb_set(to_jsonb(i), array[k.key], '"ba-probe"'::jsonb) - 'position' - 'updated_at')::text)) || ' ' ||
  count(*) filter (where k.key in ('position', 'updated_at'))
  from public.content_items i cross join lateral jsonb_object_keys(to_jsonb(i)) as k(key) where i.course_id = '9b6e0000-0000-4000-8000-000000000001'
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
