-- ABOUTME: Two read-only surfaces so CI can check query validity without a management token.
-- ABOUTME: A view over pg_proc, and a counts-only invariant function for auth.users.
--
-- Why this exists
-- ---------------
-- The audit harness needed the Supabase *management* API for two things: listing
-- functions (to tell "this RPC does not exist" from "this RPC needs arguments"),
-- and counting auth users with no profile row. A management token is
-- project-wide and can run arbitrary SQL, which is far more authority than a CI
-- job that only reads counts should hold — and it is one more long-lived
-- credential to store in Actions.
--
-- Neither check actually needs it. Verified against this database with
-- `set local role authenticated`:
--
--   pg_proc                     readable  (86 functions)
--   pg_constraint / pg_policy   readable  (637 / 373)
--   information_schema.columns  readable  (1137)
--   auth.users                  NOT readable — 42501 permission denied
--
-- So the catalogs are already readable by the role; they are simply not
-- *reachable*, because PostgREST serves only the `public` schema and OpenAPI
-- introspection is disabled on this project (GET /rest/v1/ returns zero paths
-- for anon and for an authenticated admin alike). A view in `public` closes that
-- gap with no new privilege: `security_invoker = true` means the query runs with
-- the caller's own rights, so the view is a route, not a grant.
--
-- Only the two auth.users counts need more than the role has, and they return
-- integers rather than rows, so SECURITY DEFINER is proportionate there.
--
-- Both surfaces are admin-only. CI signs in with E2E_ADMIN_EMAIL, which e2e.yml
-- already holds, so this costs the gate nothing and keeps the schema shape of
-- the database off the anon surface.

-- ── Function catalog ──────────────────────────────────────────────────────
--
-- replay-queries.mjs used to decide whether an RPC exists by calling it with no
-- arguments. PostgREST answers PGRST202 "could not find the function … without
-- parameters" for anything that merely *requires* arguments, which produced 22
-- false MISSING verdicts against functions that plainly exist. pg_proc is the
-- authority, and proargnames also catches a misspelled parameter — which fails
-- exactly the same way at runtime and is otherwise invisible until a user hits it.

DROP VIEW IF EXISTS public.audit_db_functions;

CREATE VIEW public.audit_db_functions
WITH (security_invoker = true) AS
SELECT
  p.proname::text                                        AS name,
  COALESCE(array_to_string(p.proargnames, ','), '')::text AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND public.has_admin_access(auth.uid());

COMMENT ON VIEW public.audit_db_functions IS
  'Admin-only catalog of public functions and their parameter names. Exists so '
  'CI can verify .rpc() call sites over PostgREST instead of holding a Supabase '
  'management token. security_invoker: no privilege beyond what the caller has.';

GRANT SELECT ON public.audit_db_functions TO authenticated;

-- ── Column catalog ────────────────────────────────────────────────────────
--
-- src/integrations/supabase/types.ts is generated, committed, and had drifted
-- far enough to produce a ~40% false-positive rate when the audit consulted it:
-- of four column mismatches it flagged, two were real, one had already been
-- fixed by a migration, and one did not exist. A generated file that nothing
-- checks is worse than no file, because it is trusted.
--
-- Comparing against this view answers the question that actually matters — does
-- the committed types file still describe the database — without depending on
-- the Supabase CLI reaching the network or on two generators emitting
-- byte-identical output.

DROP VIEW IF EXISTS public.audit_db_columns;

CREATE VIEW public.audit_db_columns
WITH (security_invoker = true) AS
SELECT
  c.table_name::text  AS table_name,
  c.column_name::text AS column_name
FROM information_schema.columns c
JOIN pg_class cl ON cl.relname = c.table_name
JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = c.table_schema
WHERE c.table_schema = 'public'
  AND cl.relkind IN ('r', 'v', 'm')                 -- tables, views, matviews
  AND public.has_admin_access(auth.uid());

COMMENT ON VIEW public.audit_db_columns IS
  'Admin-only column catalog for public tables and views. Used by the CI '
  'drift check to verify src/integrations/supabase/types.ts still matches the '
  'database. security_invoker: no privilege beyond what the caller has.';

GRANT SELECT ON public.audit_db_columns TO authenticated;

-- ── Invariants ──────────────────────────────────────────────────────────────
--
-- Conditions that hold today, that nothing enforces, and whose violation would
-- stay invisible until a user hit it. Returns counts only — never rows — so
-- SECURITY DEFINER here cannot leak auth.users content.

CREATE OR REPLACE FUNCTION public.audit_invariants()
RETURNS TABLE (check_name text, violations bigint, why text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'audit_invariants() requires admin access'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  -- 21 accounts created 2025-05-07 → 2025-07-03 had no profile row, and no
  -- user_roles row either, so get_user_roles returned nothing for them. The
  -- on_auth_user_created trigger covers signups now, but nothing proves it is
  -- still firing — and since profiles carries foreign keys, a user without one
  -- cannot write a certificate, submission or discussion at all.
  SELECT
    'auth_users_without_profile'::text,
    count(*)::bigint,
    'handle_new_user may have stopped firing; these users cannot write to any table with a profiles FK'::text
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)

  UNION ALL
  SELECT
    'auth_users_without_role'::text,
    count(*)::bigint,
    'the same trigger assigns the default student role; without it the user has no permissions anywhere'::text
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)

  UNION ALL
  -- A NOT VALID constraint applies to new rows but never checks existing ones.
  -- Shipping one unvalidated would silently accept the orphans it exists to stop.
  SELECT
    'unvalidated_profiles_fk'::text,
    count(*)::bigint,
    'a NOT VALID constraint does not check existing rows'::text
  FROM pg_constraint
  WHERE conname LIKE '%\_profiles\_fkey' AND NOT convalidated

  UNION ALL
  -- RLS on with no policy denies everything. The table does not error, it reads
  -- as permanently empty — the same silent-failure shape as every defect the
  -- audit found.
  SELECT
    'rls_enabled_without_policy'::text,
    count(*)::bigint,
    'RLS with no policy denies every row silently; the table just looks empty'::text
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity
    AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);
END;
$$;

COMMENT ON FUNCTION public.audit_invariants() IS
  'Admin-only. Returns violation COUNTS for database invariants nothing else '
  'enforces. SECURITY DEFINER solely because auth.users is unreadable by '
  'authenticated; no row content crosses the boundary.';

REVOKE ALL ON FUNCTION public.audit_invariants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_invariants() TO authenticated;

NOTIFY pgrst, 'reload schema';
