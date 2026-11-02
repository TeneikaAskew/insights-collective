-- ABOUTME: Focused fixture-only cleanup for the T-15 acceptance seed: deletes exactly the MANIFEST.tsv ids (explicit lists),
-- ABOUTME: in FK order, checking each count. Not run by the disposable-stack job (the stack is destroyed); for a shared stack.
\set ON_ERROR_STOP 1
begin;
do $$
declare n int;
begin
  -- Certificates the completion trigger may have issued, for fixture courses only.
  delete from public.certificates where course_id in ('7150a000-0000-4000-8000-000000000001', '7150a000-0000-4000-8000-000000000002', '7150a000-0000-4000-8000-000000000003');
  delete from public.content_item_progressions where id in ('7150a000-0000-4000-8000-000000000401', '7150a000-0000-4000-8000-000000000402', '7150a000-0000-4000-8000-000000000403', '7150a000-0000-4000-8000-000000000404', '7150a000-0000-4000-8000-000000000405', '7150a000-0000-4000-8000-000000000406', '7150a000-0000-4000-8000-000000000407', '7150a000-0000-4000-8000-000000000408', '7150a000-0000-4000-8000-000000000409', '7150a000-0000-4000-8000-000000000410', '7150a000-0000-4000-8000-000000000411', '7150a000-0000-4000-8000-000000000412');
  get diagnostics n = row_count; if n <> 12 then raise exception 'RR_CLEAN_E_PROGRESSIONS %', n; end if;
  delete from public.enrollments where id in ('7150a000-0000-4000-8000-000000000301', '7150a000-0000-4000-8000-000000000302', '7150a000-0000-4000-8000-000000000303', '7150a000-0000-4000-8000-000000000304', '7150a000-0000-4000-8000-000000000305', '7150a000-0000-4000-8000-000000000311', '7150a000-0000-4000-8000-000000000312', '7150a000-0000-4000-8000-000000000321');
  get diagnostics n = row_count; if n <> 8 then raise exception 'RR_CLEAN_E_ENROLLMENTS %', n; end if;
  delete from public.content_items where id in ('7150a000-0000-4000-8000-000000000101', '7150a000-0000-4000-8000-000000000102', '7150a000-0000-4000-8000-000000000103', '7150a000-0000-4000-8000-000000000104', '7150a000-0000-4000-8000-000000000105', '7150a000-0000-4000-8000-000000000106', '7150a000-0000-4000-8000-000000000107', '7150a000-0000-4000-8000-000000000108');
  get diagnostics n = row_count; if n <> 8 then raise exception 'RR_CLEAN_E_ITEMS %', n; end if;
  delete from public.modules where id in ('7150a000-0000-4000-8000-000000000011', '7150a000-0000-4000-8000-000000000012', '7150a000-0000-4000-8000-000000000013', '7150a000-0000-4000-8000-000000000014');
  get diagnostics n = row_count; if n <> 4 then raise exception 'RR_CLEAN_E_MODULES %', n; end if;
  delete from public.courses where id in ('7150a000-0000-4000-8000-000000000001', '7150a000-0000-4000-8000-000000000002', '7150a000-0000-4000-8000-000000000003');
  get diagnostics n = row_count; if n <> 3 then raise exception 'RR_CLEAN_E_COURSES %', n; end if;
  delete from public.profiles where id in ('7150a000-0000-4000-8000-000000000201', '7150a000-0000-4000-8000-000000000202', '7150a000-0000-4000-8000-000000000203', '7150a000-0000-4000-8000-000000000204', '7150a000-0000-4000-8000-000000000f01');
  delete from auth.users where id in ('7150a000-0000-4000-8000-000000000201', '7150a000-0000-4000-8000-000000000202', '7150a000-0000-4000-8000-000000000203', '7150a000-0000-4000-8000-000000000204', '7150a000-0000-4000-8000-000000000f01');
  get diagnostics n = row_count; if n <> 5 then raise exception 'RR_CLEAN_E_USERS %', n; end if;
end $$;
commit;
select 'RR_CLEAN_OK';
