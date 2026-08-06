REVOKE EXECUTE ON FUNCTION public.log_security_event(uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_security_event(uuid, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(uuid, text, text, text, jsonb) TO authenticated, service_role;

DROP POLICY IF EXISTS "Allow authenticated users to upload files to resumes" ON storage.objects;