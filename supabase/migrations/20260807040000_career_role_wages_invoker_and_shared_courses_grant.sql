-- Two leftovers from the security review, plus the drift that hid the first one.
--
-- 1. career_role_wages was the only view in the schema without security_invoker,
--    which is the sole ERROR-level finding from the Supabase security advisor.
--    It also existed in no migration at all, so a rebuild from this directory
--    would not produce it. Both are fixed here by defining it properly.
-- 2. courses_shared_by_users is executable by anon and self-authorizes nothing.
--
-- Deliberately NOT included: has_admin_access and get_user_roles. See the note
-- at the bottom — revoking those would break anonymous reads.

-- ---------------------------------------------------------------------------
-- 1. career_role_wages: reconcile the drift and adopt invoker semantics
-- ---------------------------------------------------------------------------
-- The view joins BLS occupational wage statistics to career roles. It carries
-- no user data. Without security_invoker it runs with its owner's rights and
-- bypasses RLS on its base tables, which is what the advisor flags.
--
-- In this case the bypass grants nothing: career_roles and bls_occupations
-- both have RLS enabled with a single public-read SELECT policy, and anon
-- already holds SELECT on both, so invoker and definer semantics return
-- identical rows today. The value is that the view now fails safe — if those
-- base-table policies are ever tightened, this stops handing out rows the
-- caller is no longer entitled to.
--
-- Every other view in the schema (audit_db_columns, audit_db_functions,
-- course_statistics, coursera_crawl_progress, quiz_analytics,
-- user_conversations) already sets security_invoker. This one was the lone
-- exception, which reads as an oversight rather than a decision.
--
-- CREATE OR REPLACE rather than DROP + CREATE, so existing grants survive. The
-- body below is the deployed definition, captured from pg_get_viewdef, so
-- applying this to production is a no-op beyond the option change.

CREATE OR REPLACE VIEW public.career_role_wages
WITH (security_invoker = true) AS
  SELECT r.slug,
         r.title,
         r.category,
         r.mapping_note,
         r.source,
         o.soc_code,
         o.occupation_title,
         o.employment,
         o.annual_mean,
         o.pct10,
         o.pct25,
         o.median,
         o.pct75,
         o.pct90,
         o.reference_period,
         o.source_name,
         o.source_url
    FROM public.career_roles r
    JOIN public.bls_occupations o ON o.soc_code = r.soc_code;

COMMENT ON VIEW public.career_role_wages IS
  'BLS wage statistics joined to career roles. security_invoker so RLS on career_roles and bls_occupations is evaluated as the caller; both are public-read today, so this is about failing safe if that ever changes.';

-- ---------------------------------------------------------------------------
-- 2. courses_shared_by_users
-- ---------------------------------------------------------------------------
-- Given a set of user ids it returns the courses all of them share, and it
-- performs no authorization of its own. Reachable by anon, it answers "are
-- these two people in a course together" for any pair of uuids a caller can
-- obtain.
--
-- Checked before revoking, since the same PUBLIC-grant pattern is load-bearing
-- elsewhere: no RLS policy references this function, and no client code calls
-- it. Its only caller is can_view_profile, which is SECURITY DEFINER and so
-- executes as its owner — the caller's own grant is not consulted on that path.
-- Removing anon's access therefore changes no working behavior.
--
-- Both the PUBLIC grant and the explicit anon grant have to go: the leading
-- "=X" entry in proacl is a grant to PUBLIC that every role inherits, so
-- revoking anon alone is a silent no-op. This is the same trap that nearly
-- made the log_security_event fix ineffective.

REVOKE EXECUTE ON FUNCTION public.courses_shared_by_users(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.courses_shared_by_users(uuid[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.courses_shared_by_users(uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Why has_admin_access and get_user_roles are left alone
-- ---------------------------------------------------------------------------
-- Both are anon-executable and both leak a little — anyone holding a uuid can
-- ask whether it belongs to an admin, or what roles it has. Revoking them
-- would nonetheless be a regression, not a fix.
--
-- RLS policy expressions are evaluated with the privileges of the querying
-- role, so a role that cannot EXECUTE a function used in a policy gets
-- "permission denied for function" instead of a filtered result set.
-- has_admin_access appears in 26 policies, 6 of them anon-facing;
-- get_user_roles in 9, 6 anon-facing — including the public blog_posts reads.
-- Revoking either would turn anonymous browsing into an error page.
--
-- The grants are structural: these are the helpers the policies are built on.
-- Closing the leak means changing what the functions reveal to an unauthorized
-- caller, not who may call them, and that is a larger change than this file.
