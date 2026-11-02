-- ABOUTME: UNRUN PROPOSAL. Pairing carrier (gate 3 producer step P1): inserts ONLY the run-owned published control course,
-- ABOUTME: whose description is this run's pairing value. Run by pairing-producer.mjs with psql variable :pairing set.
--
-- Fixed synthetic id (ids.ts journey.control.course), listed in the run's fixed journey id set. Insert only; on conflict it
-- inserts nothing and returns no row, so the producer refuses (PAIR_E_INSERT). Published, so the anon API can read it
-- (policy courses_public_read_published). The rest of the seed runs only after the DSN and API readbacks agree.
insert into public.courses (id, title, description, category, level, published, status, instructor_id)
values ('9b6c0000-0000-4000-8000-000000000011', 'Journey Control Course', :'pairing',
        'data-science', 'beginner', true, 'published', 'e2e00000-0000-4000-8000-000000000002')
on conflict (id) do nothing
returning 'PAIRING_INSERTED';
