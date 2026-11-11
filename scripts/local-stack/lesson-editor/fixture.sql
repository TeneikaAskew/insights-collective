-- ABOUTME: Lesson-editor acceptance fixture for the ISOLATED LOCAL stack (supabase start + snapshot bootstrap). Setup only:
-- ABOUTME: one course owned by OWNER: pages A, B, N (NULL version), a quiz with child rows, and contract-only pages K, KN.
--
-- Apply ONLY through run.sh, which sets PGOPTIONS '-c le.fixture_ack=isolated-local-stack' and passes the persona ids:
--   psql -v owner=<uuid> -v other=<uuid> -v student=<uuid> -f fixture.sql
-- Ids are patterned ed170000-... so a fixture row is obvious in any result. Nothing is deleted. No function, trigger, policy,
-- grant, setting or table is created or altered (no ALTER, no session_replication_role). No enrollment, submission,
-- progression, grade or certificate row is written. The NULL version of lesson N is set by INSERT: the version trigger is
-- BEFORE UPDATE only (05_triggers_grants.sql), so no trigger has to be bypassed.
\set ON_ERROR_STOP on
begin;

do $$
begin
  if coalesce(current_setting('le.fixture_ack', true), '') <> 'isolated-local-stack' then
    raise exception 'lesson-editor fixture refused: apply it only through scripts/local-stack/lesson-editor/run.sh';
  end if;
end $$;

-- Only synthetic accounts may exist: le-*/t09-* personas (@local.test) and the three snapshot fixture accounts
-- (auth-fixtures.sql). Any other account means this is not the isolated local stack.
do $$
declare n bigint;
begin
  select count(*) into n from auth.users
   where email is null
      or (email !~ '^(le|t09)-[a-z0-9]+-[0-9a-f]{8}@local\.test$'
          and email not in ('e2e-admin@insightscollective.org', 'e2e-instructor@insightscollective.org',
                            'e2e-member@insightscollective.org'));
  if n > 0 then
    raise exception 'lesson-editor fixture refused: % non-synthetic auth user(s); this is not the isolated local stack', n;
  end if;
end $$;

-- psql variables are not expanded inside $$ bodies; carry them as transaction-local settings for the assertions.
select set_config('le.owner', :'owner', true) as o, set_config('le.other', :'other', true) as t,
       set_config('le.student', :'student', true) as s \gset le_

do $$
declare p text;
begin
  foreach p in array array[current_setting('le.owner'), current_setting('le.other'), current_setting('le.student')] loop
    if not exists (select 1 from auth.users where id = p::uuid and email ~ '^le-[a-z]+-[0-9a-f]{8}@local\.test$') then
      raise exception 'fixture: persona % is not an le-* local.test account', p;
    end if;
  end loop;
  if current_setting('le.other') = current_setting('le.owner') then raise exception 'fixture: OTHER must differ from OWNER'; end if;
  if exists (select 1 from public.courses where id = 'ed170000-0000-4000-8000-0000000000c1') then
    raise exception 'fixture: course C1 already exists (a fixture is applied once per fresh stack, never reset)';
  end if;
end $$;

-- Roles (setup), as T-09 personas.sh does: OWNER and OTHER instructors, STUDENT a pure student.
insert into public.profiles (id) values (:'owner'), (:'other'), (:'student') on conflict (id) do nothing;
insert into public.user_roles (user_id, role)
values (:'owner', 'instructor'), (:'other', 'instructor'), (:'student', 'student')
on conflict do nothing;

insert into public.courses (id, title, description, category, level, published, status, instructor_id)
values ('ed170000-0000-4000-8000-0000000000c1', 'Editor acceptance course', 'Synthetic lesson-editor fixture',
        'data-science', 'beginner', false, 'draft', :'owner');
insert into public.modules (id, course_id, title, position, published)
values ('ed170000-0000-4000-8000-0000000000d1', 'ed170000-0000-4000-8000-0000000000c1', 'Editor section', 0, true);

-- A, B: pages. N: page with a known NULL version (R4). Q: quiz with child rows (its type must never change).
insert into public.content_items (id, course_id, module_id, type, title, content, position, published, updated_at)
values ('ed170000-0000-4000-8000-0000000000a1', 'ed170000-0000-4000-8000-0000000000c1',
        'ed170000-0000-4000-8000-0000000000d1', 'page', 'Lesson A', '<p>Body A</p>', 0, true, now()),
       ('ed170000-0000-4000-8000-0000000000a2', 'ed170000-0000-4000-8000-0000000000c1',
        'ed170000-0000-4000-8000-0000000000d1', 'page', 'Lesson B', '<p>Body B</p>', 1, true, now()),
       ('ed170000-0000-4000-8000-0000000000a3', 'ed170000-0000-4000-8000-0000000000c1',
        'ed170000-0000-4000-8000-0000000000d1', 'page', 'Lesson N', '<p>Body N</p>', 2, true, null),
       ('ed170000-0000-4000-8000-0000000000a4', 'ed170000-0000-4000-8000-0000000000c1',
        'ed170000-0000-4000-8000-0000000000d1', 'quiz', 'Graded quiz', '', 3, true, now()),
       -- K and KN are used only by backend-contract.mjs (API-level checks), never by the browser spec.
       ('ed170000-0000-4000-8000-0000000000b1', 'ed170000-0000-4000-8000-0000000000c1',
        'ed170000-0000-4000-8000-0000000000d1', 'page', 'Contract K', '<p>K</p>', 4, false, now()),
       ('ed170000-0000-4000-8000-0000000000b2', 'ed170000-0000-4000-8000-0000000000c1',
        'ed170000-0000-4000-8000-0000000000d1', 'page', 'Contract KN', '<p>KN</p>', 5, false, null);

insert into public.quizzes (id, content_item_id, module_id, title, points_possible)
values ('ed170000-0000-4000-8000-0000000000e1', 'ed170000-0000-4000-8000-0000000000a4',
        'ed170000-0000-4000-8000-0000000000d1', 'Graded quiz', 2);
insert into public.quiz_questions (id, quiz_id, question_text, options, correct_answer, points, position)
values ('ed170000-0000-4000-8000-0000000000f1', 'ed170000-0000-4000-8000-0000000000e1', 'Fixture question one',
        '["a","b"]'::jsonb, '"a"'::jsonb, 1, 0),
       ('ed170000-0000-4000-8000-0000000000f2', 'ed170000-0000-4000-8000-0000000000e1', 'Fixture question two',
        '["c","d"]'::jsonb, '"d"'::jsonb, 1, 1);

-- Assertions: exactly the fixture, owned as intended, N is NULL, Q is a quiz with two questions, STUDENT is a pure student.
do $$
begin
  if (select instructor_id::text from public.courses where id = 'ed170000-0000-4000-8000-0000000000c1')
     is distinct from current_setting('le.owner') then
    raise exception 'fixture: course owner mismatch'; end if;
  if (select count(*) from public.content_items where course_id = 'ed170000-0000-4000-8000-0000000000c1') <> 6 then
    raise exception 'fixture: expected 6 content items'; end if;
  if (select updated_at from public.content_items where id = 'ed170000-0000-4000-8000-0000000000a3') is not null
     or (select updated_at from public.content_items where id = 'ed170000-0000-4000-8000-0000000000b2') is not null then
    raise exception 'fixture: lessons N and KN must start with a NULL updated_at'; end if;
  if (select count(*) from public.quiz_questions where quiz_id = 'ed170000-0000-4000-8000-0000000000e1') <> 2 then
    raise exception 'fixture: quiz must have 2 questions'; end if;
  if (select string_agg(role::text, ',' order by role::text) from public.user_roles
       where user_id = current_setting('le.student')::uuid) is distinct from 'student' then
    raise exception 'fixture: STUDENT is not a pure student'; end if;
end $$;
commit;
\echo PASS le-fixture: course C1 (owner OWNER), lessons A B N(NULL) Q(quiz + 2 questions), contract K KN(NULL)
