-- ABOUTME: DB-tier rehearsal of anonymous WRITE negatives on run-owned fixture ids only, as PostgREST's anon role. Each
-- ABOUTME: attempt REPORTS the actual outcome (refused with SQLSTATE, or rows affected); the whole transaction is rolled back.
\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $probe$
declare n int;
begin
  begin
    insert into public.courses (id, title, description, category, level) values ('7e57ca7a-0000-4000-8000-000000000999', 'PCA anon insert', 'x', 'x', 'x');
    raise notice 'RESULT courses.insert ALLOWED';
  exception when others then raise notice 'RESULT courses.insert refused %', sqlstate; end;
  begin
    update public.courses set title = title || ' (anon)' where id = '7e57ca7a-0000-4000-8000-000000000001'; get diagnostics n = row_count;
    raise notice 'RESULT courses.update.published rows=%', n;
  exception when others then raise notice 'RESULT courses.update.published refused %', sqlstate; end;
  begin
    update public.courses set published = true where id = '7e57ca7a-0000-4000-8000-000000000006'; get diagnostics n = row_count;
    raise notice 'RESULT courses.update.private rows=%', n;
  exception when others then raise notice 'RESULT courses.update.private refused %', sqlstate; end;
  begin
    delete from public.courses where id = '7e57ca7a-0000-4000-8000-000000000002'; get diagnostics n = row_count;
    raise notice 'RESULT courses.delete.published rows=%', n;
  exception when others then raise notice 'RESULT courses.delete.published refused %', sqlstate; end;
  begin
    update public.modules set published = true where id = '7e57ca7a-0000-4000-8000-000000000102'; get diagnostics n = row_count;
    raise notice 'RESULT modules.update.unpublished rows=%', n;
  exception when others then raise notice 'RESULT modules.update.unpublished refused %', sqlstate; end;
  begin
    insert into public.modules (id, course_id, title, "position") values ('7e57ca7a-0000-4000-8000-000000000998', '7e57ca7a-0000-4000-8000-000000000001', 'PCA anon module', 9);
    raise notice 'RESULT modules.insert ALLOWED';
  exception when others then raise notice 'RESULT modules.insert refused %', sqlstate; end;
end $probe$;
rollback;
