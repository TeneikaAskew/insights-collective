-- Two holes found by a full security review of the live project.
--
-- 1. The resumes bucket carried two PERMISSIVE INSERT policies. Permissive
--    policies are OR'd, so the unscoped one decided the outcome and any
--    authenticated user could write into any other user's resume folder.
-- 2. log_security_event is reachable by `anon`, and for an anonymous caller
--    auth.uid() is NULL — the branch that falls back to the caller-supplied
--    p_user_id. Audit rows could be forged against any user by anyone.

-- ---------------------------------------------------------------------------
-- 1. Resume uploads
-- ---------------------------------------------------------------------------
-- "Users can upload their own resumes" already enforces the correct rule:
--   (bucket_id = 'resumes') AND auth.uid()::text = (storage.foldername(name))[1]
-- The policy dropped here checked only the bucket, so it granted every
-- authenticated user INSERT anywhere in the bucket, including under another
-- user's uid folder. SELECT/UPDATE/DELETE were already scoped, so the exposure
-- was write-only — planting files, not reading other people's resumes.
--
-- Verified before dropping: all 127 objects across 33 owners already live under
-- a uid folder, so no stored object depends on the loose policy. The one caller
-- that did depend on it was SurveyField.tsx, which uploaded to a literal
-- "resumes/" folder; it is fixed in the same change to use `<uid>/...`. Files it
-- wrote under the old layout were unreadable by their own owner anyway, since
-- the SELECT policy requires the uid folder.

DROP POLICY IF EXISTS "Allow authenticated users to upload files to resumes" ON storage.objects;

-- ---------------------------------------------------------------------------
-- 2. Audit-log forgery
-- ---------------------------------------------------------------------------
-- 20260729000000 pinned the subject to auth.uid() when it is non-null, which
-- closed this for authenticated callers, and deliberately kept the p_user_id
-- fallback so service-role callers (the edge functions, where auth.uid() is
-- NULL) can still name their subject. An anonymous caller reaches that same
-- fallback, so the fix is to remove anon's access rather than change the body.
--
-- Checked before revoking: every client call site passes an authenticated
-- user's id (ProtectedRoute, useSecureSession, EnhancedFormBuilder via
-- securityUtils.logSecurityEvent), the edge functions call with the service
-- role, and the client wrapper already swallows failures. Nothing legitimate
-- calls this anonymously.

-- The grant reaches anon by two separate paths. proacl is
--   {=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
-- where the leading "=X" is the grant to PUBLIC, which every role including
-- anon inherits. Revoking from anon alone would leave that PUBLIC grant in
-- place and change nothing, so both are revoked and the two roles that must
-- keep access are then granted explicitly.

REVOKE EXECUTE ON FUNCTION public.log_security_event(uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_security_event(uuid, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(uuid, text, text, text, jsonb) TO authenticated, service_role;
