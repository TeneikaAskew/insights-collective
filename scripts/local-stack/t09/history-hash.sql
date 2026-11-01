-- ABOUTME: Protected-history fixtures and hashes for the T-09 runtime. -v action=seed|snapshot|compare|certbase|certcheck.
-- ABOUTME: Seeds NON-EMPTY legacy history BEFORE the hash window, then proves the reviewed migrations rewrite none of it.
--
--  seed      (setup, direct database session, before the window): one legacy course H owned by legacy instructor LI,
--            with a page, an assignment and a quiz, and three legacy learners:
--              LG genuine history: submitted+timestamped submission, completed progression, an attempt finalized by the
--                 database finalizer under service_role claims (fixture-finalized; checked 'complete' with finished_at);
--              LX legacy-invalid under the NEW rules: TIMESTAMPED UNSUBMITTED submission + completed progression and a
--                 started-only quiz attempt (exactly what OLD accepted; nothing is "fixed" or rewritten);
--              LC a legacy certificate with a fixed verification code issued 100 days ago.
--            With -v hc/-v hg, LC and LG are the API personas HC and HG (same rows, persona ids).
--            Written as the trusted local postgres with no API claims (the path the SQL tier's P10 shows is unaffected).
--            No session_replication_role, no grant, no ownership change. If a trigger refuses a row, the seed FAILS.
--            Every one of the four protected tables must then hold at least one seeded row.
--  snapshot  -v label=<name>: per table, row count and md5(string_agg(row, E'\n' order by id)) over the column set
--            pinned at the FIRST snapshot (so an added column cannot hide or fake a rewrite). Whole tables, not only seeds.
--  compare   -v a=<label> -v b=<label>: every table's count and md5 must be identical, or it raises.
--  certbase  records every certificate: id, user_id, course_id, issued_at, verification_code, full-row md5.
--  certcheck re-reads them after a trigger-firing control: each baseline row unchanged, none deleted, and no
--            duplicate certificate per (user, course) anywhere.
-- Writes only local_evidence.* (and the seed rows in public/auth). Run against a disposable local stack only.
\set ON_ERROR_STOP 1
\if :{?action}
select set_config('t09.history_action', :'action', false) \gset t09_
\else
\echo 'history-hash: -v action=seed|snapshot|compare|certbase|certcheck is required'
select 1/0 as action_required;
\endif
\if :{?label}
select set_config('t09.history_label', :'label', false) \gset t09_
\else
select set_config('t09.history_label', '', false) \gset t09_
\endif
-- Optional (API runs): -v hc=<id> -v hg=<id> seed LC and LG AS the GoTrue personas HC and HG, which must already exist in
-- auth.users (personas.sh creates them first), so API controls can act as the same subjects as the protected history.
\if :{?hc}
select set_config('t09.history_hc', :'hc', false) \gset t09_
select set_config('t09.history_hg', :'hg', false) \gset t09_
\else
select set_config('t09.history_hc', '', false) \gset t09_
select set_config('t09.history_hg', '', false) \gset t09_
\endif
\if :{?a}
select set_config('t09.history_a', :'a', false) \gset t09_
select set_config('t09.history_b', :'b', false) \gset t09_
\else
select set_config('t09.history_a', '', false) \gset t09_
select set_config('t09.history_b', '', false) \gset t09_
\endif

set client_min_messages = warning;
create table if not exists local_evidence.history_cols (tbl text primary key, cols text[] not null);
create table if not exists local_evidence.history_hash (
  label text not null, tbl text not null, n bigint not null, md5 text not null, taken_at timestamptz not null default clock_timestamp(),
  primary key (label, tbl));
create table if not exists local_evidence.cert_baseline (
  id uuid primary key, user_id uuid not null, course_id uuid not null, issued_at timestamptz, verification_code text not null, row_md5 text not null);

set client_min_messages = notice;
do $$
declare
  act constant text := current_setting('t09.history_action');
  tbls constant text[] := array['content_item_progressions', 'assignment_submissions', 'quiz_submissions', 'certificates'];
  t text; c text[]; n bigint; hval text; r record; bad int;
  LI constant uuid := '7a000000-0000-4000-8000-0000000000a1';
  LG constant uuid := coalesce(nullif(current_setting('t09.history_hg'), ''), '7a000000-0000-4000-8000-0000000000b1')::uuid;
  LX constant uuid := '7a000000-0000-4000-8000-0000000000b2';
  LC constant uuid := coalesce(nullif(current_setting('t09.history_hc'), ''), '7a000000-0000-4000-8000-0000000000b3')::uuid;
  H  constant uuid := '7a000000-0000-4000-8000-000000000c00';
  HM constant uuid := '7a000000-0000-4000-8000-000000000c01';
  HP constant uuid := '7a000000-0000-4000-8000-000000000c02';
  HA constant uuid := '7a000000-0000-4000-8000-000000000c03';
  HQ constant uuid := '7a000000-0000-4000-8000-000000000c04';
  aHA constant uuid := '7a000000-0000-4000-8000-000000000d03';
  qHQ constant uuid := '7a000000-0000-4000-8000-000000000e04';
begin
  if act = 'seed' then
    if exists (select 1 from public.courses where id = H) then raise exception 'history-hash seed: already seeded (fresh stack expected)'; end if;
    if current_setting('t09.history_hc') <> '' then
      -- Persona subjects: they must already exist (created through the local GoTrue admin API); never created here.
      if (select count(*) from auth.users where id in (LC, LG)) <> 2 then raise exception 'history-hash seed: persona HC or HG missing from auth.users'; end if;
      insert into auth.users (id, email) values (LI, 't09-legacy-i@local.test'), (LX, 't09-legacy-x@local.test');
    else
      insert into auth.users (id, email) values (LI, 't09-legacy-i@local.test'), (LG, 't09-legacy-g@local.test'),
        (LX, 't09-legacy-x@local.test'), (LC, 't09-legacy-c@local.test');
    end if;
    insert into public.profiles (id) values (LI), (LG), (LX), (LC) on conflict (id) do nothing;
    insert into public.user_roles (user_id, role) values (LI, 'instructor'), (LG, 'student'), (LX, 'student'), (LC, 'student') on conflict do nothing;
    insert into public.courses (id, title, description, category, level, instructor_id, published)
      values (H, 'T-09 legacy course H', 'synthetic legacy history', 'General', 'beginner', LI, true);
    insert into public.modules (id, course_id, title, position, published) values (HM, H, 'HM', 1, true);
    insert into public.content_items (id, course_id, module_id, type, title, position, published) values
      (HP, H, HM, 'page', 'HP', 1, true), (HA, H, HM, 'assignment', 'HA', 2, true), (HQ, H, HM, 'quiz', 'HQ', 3, true);
    insert into public.assignments (id, content_item_id, course_id, title, points) values (aHA, HA, H, 'HA', 10);
    insert into public.quizzes (id, content_item_id, title, allowed_attempts) values (qHQ, HQ, 'HQ', 0);
    insert into public.enrollments (user_id, course_id) values (LG, H), (LX, H), (LC, H);
    -- LG genuine; LX legacy-invalid under NEW (timestamped but UNSUBMITTED; started-only quiz attempt).
    insert into public.assignment_submissions (id, assignment_id, user_id, submitted_at, submission_type, body, workflow_state) values
      ('7a000000-0000-4000-8000-0000000001b1', aHA, LG, now() - interval '200 days', 'online_text_entry', 'legacy genuine', 'submitted'),
      ('7a000000-0000-4000-8000-0000000001b2', aHA, LX, now() - interval '200 days', 'online_text_entry', 'legacy staged', 'unsubmitted');
    -- LG's attempt is started, then finalized by the database finalizer under service_role claims (fixture-finalized; the
    -- score-quiz Edge Function is not exercised). A direct 'complete' INSERT is silently rewritten to 'pending_review' by
    -- pin_quiz_submission_score (snapshot trigger), which made the earlier seed's "genuine" attempt NOT final.
    insert into public.quiz_submissions (id, quiz_id, user_id, attempt, workflow_state, started_at, finished_at) values
      ('7a000000-0000-4000-8000-0000000002b1', qHQ, LG, 1, 'pending_review', now() - interval '199 days', null),
      ('7a000000-0000-4000-8000-0000000002b2', qHQ, LX, 1, 'pending_review', now() - interval '199 days', null);
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    perform public.finalize_quiz_submission('7a000000-0000-4000-8000-0000000002b1', 1, 30);
    perform set_config('request.jwt.claims', '', true);
    insert into public.content_item_progressions (user_id, content_item_id, workflow_state) values
      (LG, HP, 'read'), (LG, HA, 'completed'), (LX, HP, 'read'), (LX, HA, 'completed');
    -- LC: a historical certificate (no progress rows); issued 100 days ago with a fixed verification code.
    insert into public.certificates (user_id, course_id, certificate_type, certificate_data, verification_code, issued_at)
      values (LC, H, 'completion', '{}'::jsonb, 'T09LEGACYCERT1', now() - interval '100 days');
    -- Every seeded row must hold exactly the state it was written to hold: a trigger that REWRITES a row fails the seed.
    if (select workflow_state || ':' || (finished_at is not null)::text from public.quiz_submissions where id = '7a000000-0000-4000-8000-0000000002b1') <> 'complete:true'
       or (select workflow_state || ':' || (finished_at is not null)::text from public.quiz_submissions where id = '7a000000-0000-4000-8000-0000000002b2') <> 'pending_review:false'
       or (select workflow_state from public.assignment_submissions where id = '7a000000-0000-4000-8000-0000000001b1') <> 'submitted'
       or (select workflow_state from public.assignment_submissions where id = '7a000000-0000-4000-8000-0000000001b2') <> 'unsubmitted'
       or (select count(*) from public.content_item_progressions where user_id in (LG, LX) and content_item_id in (HP, HA)) <> 4
       or (select count(*) from public.certificates where course_id = H) <> 1 then
      raise exception 'history-hash seed: a seeded row was rewritten or is missing (state check failed)';
    end if;
    -- Non-empty protected history, per table.
    foreach t in array tbls loop
      execute format('select count(*) from public.%I where %s', t,
        case t when 'certificates' then 'course_id = $1'
               when 'content_item_progressions' then 'content_item_id in (select id from public.content_items where course_id = $1)'
               when 'assignment_submissions' then 'assignment_id in (select id from public.assignments where course_id = $1)'
               else 'quiz_id in (select q.id from public.quizzes q join public.content_items ci on ci.id = q.content_item_id where ci.course_id = $1)' end)
        into n using H;
      if n < 1 then raise exception 'history-hash seed: % holds no seeded legacy row', t; end if;
      raise notice 'history seed: % has % legacy row(s) in course H', t, n;
    end loop;

  elsif act = 'snapshot' then
    if current_setting('t09.history_label') = '' then raise exception 'history-hash snapshot: -v label is required'; end if;
    foreach t in array tbls loop
      select cols into c from local_evidence.history_cols where tbl = t;
      if c is null then
        select array_agg(attname::text order by attnum) into c from pg_attribute
         where attrelid = ('public.' || t)::regclass and attnum > 0 and not attisdropped;
        insert into local_evidence.history_cols values (t, c);
      end if;
      execute format('select count(*), coalesce(md5(string_agg((select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(x)) e(k, v) where k = any ($1))::text, E''\n'' order by x.id)), ''empty'') from public.%I x', t)
        into n, hval using c;
      if n = 0 then raise exception 'history-hash snapshot: % is EMPTY; protected history must be non-empty', t; end if;
      insert into local_evidence.history_hash (label, tbl, n, md5) values (current_setting('t09.history_label'), t, n, hval);
      raise notice 'history %: % rows=% md5=%', current_setting('t09.history_label'), t, n, hval;
    end loop;

  elsif act = 'compare' then
    if (select count(*) from local_evidence.history_hash where label = current_setting('t09.history_a')) <> 4
       or (select count(*) from local_evidence.history_hash where label = current_setting('t09.history_b')) <> 4 then
      raise exception 'history-hash compare: both labels need 4 tables (% vs %)', current_setting('t09.history_a'), current_setting('t09.history_b');
    end if;
    select count(*) into bad from local_evidence.history_hash a join local_evidence.history_hash b using (tbl)
     where a.label = current_setting('t09.history_a') and b.label = current_setting('t09.history_b') and (a.n <> b.n or a.md5 <> b.md5);
    if bad <> 0 then
      for r in select a.tbl, a.n an, b.n bn from local_evidence.history_hash a join local_evidence.history_hash b using (tbl)
                where a.label = current_setting('t09.history_a') and b.label = current_setting('t09.history_b') and (a.n <> b.n or a.md5 <> b.md5) loop
        raise notice 'history CHANGED: % rows % -> %', r.tbl, r.an, r.bn;
      end loop;
      raise exception 'history-hash compare: % table(s) differ between % and %', bad, current_setting('t09.history_a'), current_setting('t09.history_b');
    end if;
    raise notice 'history unchanged: % == % on all 4 protected tables', current_setting('t09.history_a'), current_setting('t09.history_b');

  elsif act = 'certbase' then
    if exists (select 1 from local_evidence.cert_baseline) then raise exception 'history-hash certbase: baseline already recorded'; end if;
    insert into local_evidence.cert_baseline select id, user_id, course_id, issued_at, verification_code, md5(to_jsonb(cert)::text) from public.certificates cert;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'history-hash certbase: no certificate to protect (seed missing?)'; end if;
    raise notice 'certificate baseline: % row(s)', n;

  elsif act = 'certcheck' then
    select count(*) into bad from local_evidence.cert_baseline b left join public.certificates cert on cert.id = b.id
     where cert.id is null or cert.user_id <> b.user_id or cert.course_id <> b.course_id or cert.issued_at is distinct from b.issued_at
        or cert.verification_code <> b.verification_code or md5(to_jsonb(cert)::text) <> b.row_md5;
    if bad <> 0 then raise exception 'history-hash certcheck: % baseline certificate(s) changed or deleted', bad; end if;
    select count(*) into bad from (select 1 from public.certificates group by user_id, course_id having count(*) > 1) d;
    if bad <> 0 then raise exception 'history-hash certcheck: % (user, course) pair(s) hold duplicate certificates', bad; end if;
    raise notice 'certificates intact: % baseline row(s) unchanged, no duplicate per (user, course), % total',
      (select count(*) from local_evidence.cert_baseline), (select count(*) from public.certificates);
  else
    raise exception 'history-hash: unknown action %', act;
  end if;
end $$;
