-- ABOUTME: K1-only run seed addition (UNRUN): course S, the source of "Copy from another course" (ids.mjs S), owned by
-- ABOUTME: e2e-instructor. Applied right after seed.sql (A, B) in the K1 run only; plain INSERTs, refuses a used stack.
--
-- Applied only by ba-db.mjs `seed-k1`, with psql variable :pairing set to the pairing proof's carrier (the same binding as
-- seed.sql). Refuses unless this database holds exactly that carrier, holds exactly the two seed.sql courses of this lane
-- (A and B, nothing else in the 9b6e0000 namespace), and holds no course titled 'BA Wizard Copy ...' or 'BA Wizard Course ...'.
\set ON_ERROR_STOP on
begin;
select set_config('ba.pairing', :'pairing', true) is not null as ba_pairing_set \gset
do $$
begin
  if (select count(*) from public.courses where id = '9b6c0000-0000-4000-8000-000000000011' and description = current_setting('ba.pairing')) <> 1 then
    raise exception 'BA_SEED_E_CARRIER';
  end if;
  if (select count(*) from public.courses where id::text like '9b6e0000-%') <> 2
     or (select count(*) from public.courses where id in ('9b6e0000-0000-4000-8000-000000000001', '9b6e0000-0000-4000-8000-000000000002')) <> 2
     or exists (select 1 from public.courses where title like 'BA Wizard Copy %' or title like 'BA Wizard Course %') then
    raise exception 'BA_SEED_E_USED_STACK';
  end if;
end $$;
insert into public.courses (id, title, description, category, level, published, status, instructor_id) values
  ('9b6e0000-0000-4000-8000-000000000003', 'Builder Acceptance Copy Source', 'Synthetic builder acceptance fixture.', 'General', 'beginner', false, 'draft', 'e2e00000-0000-4000-8000-000000000002');
insert into public.modules (id, course_id, title, position, published) values
  ('9b6e0000-0000-4000-8000-000000000031', '9b6e0000-0000-4000-8000-000000000003', 'BS Section One', 0, true),
  ('9b6e0000-0000-4000-8000-000000000032', '9b6e0000-0000-4000-8000-000000000003', 'BS Section Two', 1, true);
insert into public.content_items (id, course_id, module_id, type, title, content, position, published, settings) values
  ('9b6e0000-0000-4000-8000-000000000301', '9b6e0000-0000-4000-8000-000000000003', '9b6e0000-0000-4000-8000-000000000031', 'page', 'BS Lesson Text', '<p>Read <a href="/courses">the catalog</a> and <a href="https://example.org/guide?page=2#intro">the guide</a>.</p>', 0, false, '{}'),
  ('9b6e0000-0000-4000-8000-000000000302', '9b6e0000-0000-4000-8000-000000000003', '9b6e0000-0000-4000-8000-000000000031', 'quiz', 'BS Lesson Check', '', 1, false, '{}'),
  ('9b6e0000-0000-4000-8000-000000000303', '9b6e0000-0000-4000-8000-000000000003', '9b6e0000-0000-4000-8000-000000000032', 'assignment', 'BS Lesson Essay', '<p>Write 200 words.</p>', 0, false, '{}');
commit;
select 'BA_SEED_K1_OK courses=1 sections=2 lessons=3';
