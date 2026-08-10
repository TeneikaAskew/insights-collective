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

REVOKE EXECUTE ON FUNCTION public.courses_shared_by_users(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.courses_shared_by_users(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.courses_shared_by_users(uuid[]) TO authenticated, service_role;