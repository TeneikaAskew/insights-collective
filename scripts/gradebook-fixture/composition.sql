-- ABOUTME: Read-only. Identifies the EXACT schema composition the fixture runs against and prints one line
-- ABOUTME: "COMPOSITION <name>", or raises. The P4 expectation and expected-post file are chosen from this line only.
--   baseline-139 : no T-09 ledger rows; pin_assignment_grade_columns body is the #139/c5ef453 one (md5(prosrc) 1840d9d2...).
--   t09-old      : T-09 ledger (local_evidence.applied_migrations, written by apply-reviewed.sh) holds exactly the first 2
--                  pinned blobs; the pin body is still the baseline one (000000/000100 do not touch it).
--   composed-r5  : the ledger holds exactly the 7 pinned blobs in order, and the pin body is the 20261101000600 one
--                  (md5(prosrc) 5e22ac50...), which no longer lets a non-staff user move a submission INTO 'graded'.
-- Any other ledger content, or a ledger/function disagreement, raises: the fixture never guesses its composition.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
do $$
declare
  pins text[] := array['101a792d0db0284bcecb469cb6aad1bc40b98260','887df90aaccde33e3d09ca0dd6923993cdc6140f',
                       '5c209c3cd4b411f03ff24f81e35da8458e88ba39','f70bc5ac7172268ff6bf9aae62f36be18591625e',
                       '2df6fa852493655ace9f6ff3a27c926df0787a50','de4f8c2772150fdbfa73dd070035ca4c217abdfb',
                       '8d520861ec840c29d6da7c5b85e84b5dd85aea44'];
  fp_baseline constant text := '1840d9d2b1a7d87893751781579b912a';
  fp_r5 constant text := '5e22ac506d7573c4501cef7199102400';
  fp text; blobs text[]; comp text; want text;
begin
  select md5(prosrc) into strict fp from pg_proc where oid = 'public.pin_assignment_grade_columns()'::regprocedure;
  if to_regclass('local_evidence.applied_migrations') is null then
    blobs := array[]::text[];
  else
    execute 'select coalesce(array_agg(blob order by seq), array[]::text[]) from local_evidence.applied_migrations' into blobs;
  end if;
  if cardinality(blobs) = 0 then comp := 'baseline-139'; want := fp_baseline;
  elsif blobs = pins[1:2] then comp := 't09-old'; want := fp_baseline;
  elsif blobs = pins then comp := 'composed-r5'; want := fp_r5;
  else raise exception 'GRADEBOOK COMPOSITION UNKNOWN: T-09 ledger holds % row(s) that match no pinned prefix', cardinality(blobs);
  end if;
  if fp <> want then
    raise exception 'GRADEBOOK COMPOSITION MISMATCH: ledger says % but pin_assignment_grade_columns md5(prosrc) is %', comp, fp;
  end if;
  perform set_config('gradebook.composition', comp, false);
end $$;
select 'COMPOSITION ' || current_setting('gradebook.composition');
