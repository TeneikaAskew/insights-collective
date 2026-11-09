\set ON_ERROR_STOP on
BEGIN;
-- Real composed-schema RLS with synthetic identities; no Auth/JWT claim.
CREATE TEMP TABLE expected(actor integer, row_number integer, allowed boolean);
CREATE TEMP TABLE outcomes(phase text, actor integer, row_number integer, actual boolean, expected boolean);
GRANT ALL ON expected,outcomes TO authenticated,anon;
INSERT INTO auth.users(id,email) SELECT ('71000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'progress-'||n||'@local.test' FROM generate_series(1,7) n;
INSERT INTO public.user_roles(user_id,role) SELECT ('71000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,CASE WHEN n=7 THEN 'admin'::public.app_role ELSE 'instructor'::public.app_role END FROM generate_series(1,7) n WHERE n IN (1,2,4,7);
INSERT INTO public.courses(id,instructor_id,title,description,category,level,published)
SELECT ('72000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('71000000-0000-4000-8000-'||lpad((CASE WHEN n=1 THEN 1 ELSE 2 END)::text,12,'0'))::uuid,'Synthetic course','Test','General','beginner',true FROM generate_series(1,3) n;
INSERT INTO public.course_assignments(user_id,course_id,role) VALUES('71000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000001','instructor');
INSERT INTO public.modules(id,course_id,title,position,published) SELECT ('73000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('72000000-0000-4000-8000-'||lpad((CASE WHEN n<=3 THEN 1 WHEN n<=6 THEN 2 ELSE 3 END)::text,12,'0'))::uuid,'Synthetic module',n,true FROM generate_series(1,7) n;
INSERT INTO public.module_progressions(id,user_id,module_id,workflow_state)
SELECT ('74000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('71000000-0000-4000-8000-'||lpad((CASE WHEN n%2=1 THEN 5 ELSE 6 END)::text,12,'0'))::uuid,('73000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'completed' FROM generate_series(1,7) n;
INSERT INTO expected SELECT a,n,a=7 OR (a IN(1,3) AND n<=3) OR (a=2 AND n>=4) OR (a=5 AND n%2=1) OR (a=6 AND n%2=0) FROM generate_series(1,7) a CROSS JOIN generate_series(1,7) n;
CREATE TEMP TABLE preserved AS SELECT jsonb_agg(to_jsonb(p) ORDER BY id) rows FROM public.module_progressions p;
CREATE TEMP TABLE policies AS SELECT policyname,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='module_progressions' AND policyname<>'Instructors can view module progressions';
CREATE FUNCTION pg_temp.check_matrix(phase text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE a integer; n integer; seen boolean;
BEGIN
 FOR a IN 1..7 LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub','71000000-0000-4000-8000-'||lpad(a::text,12,'0'),'role','authenticated')::text,true);
  FOR n IN 1..7 LOOP
   SELECT EXISTS(SELECT 1 FROM public.module_progressions WHERE id=('74000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid) INTO seen;
   INSERT INTO outcomes SELECT phase,a,n,seen,allowed FROM expected WHERE actor=a AND row_number=n;
  END LOOP;
 END LOOP;
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_matrix('old');
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM outcomes WHERE phase='old' AND actual<>expected) THEN RAISE EXCEPTION 'Old policy did not reproduce'; END IF; END $$;
SELECT phase,count(*) checks,count(*) FILTER(WHERE actual<>expected) failures FROM outcomes GROUP BY phase;
\ir candidate.sql
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_matrix('candidate');
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM outcomes WHERE phase='candidate' AND actual<>expected) THEN RAISE EXCEPTION 'Candidate role mismatch'; END IF; END $$;
SELECT phase,count(*) checks,count(*) FILTER(WHERE actual<>expected) failures FROM outcomes GROUP BY phase ORDER BY phase;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.module_progressions) THEN RAISE EXCEPTION 'Anonymous read leaked'; END IF; END $$;
RESET ROLE;
-- Course-scoped co-instructor still sees unpublished modules, unrelated global instructor does not.
UPDATE public.modules SET published=false;
UPDATE public.courses SET published=false;
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_matrix('private');
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM outcomes WHERE phase='private' AND actual<>expected) THEN RAISE EXCEPTION 'Private course role mismatch'; END IF; END $$;
SELECT phase,count(*) checks,count(*) FILTER(WHERE actual<>expected) failures FROM outcomes WHERE phase='private' GROUP BY phase;
DO $$ BEGIN
 IF (SELECT rows FROM preserved) IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.module_progressions p) THEN RAISE EXCEPTION 'Progress records changed'; END IF;
 IF EXISTS((SELECT * FROM policies EXCEPT SELECT policyname,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='module_progressions' AND policyname<>'Instructors can view module progressions') UNION ALL (SELECT policyname,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename='module_progressions' AND policyname<>'Instructors can view module progressions' EXCEPT SELECT * FROM policies)) THEN RAISE EXCEPTION 'Other policies changed'; END IF;
END $$;
SELECT 'PASS rows and other policies preserved; anonymous denied' result;
ROLLBACK;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM auth.users WHERE email LIKE 'progress-%@local.test') THEN RAISE EXCEPTION 'Fixture rollback failed'; END IF; END $$;
SELECT 'PASS synthetic fixture transaction rolled back' result;
