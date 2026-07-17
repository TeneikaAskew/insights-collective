
CREATE OR REPLACE FUNCTION public.debug_whoami()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'auth_uid', auth.uid(),
    'current_user', current_user,
    'session_user', session_user,
    'can_manage_test_course', public.can_manage_course_content(auth.uid(), '660e8400-e29b-41d4-a716-446655440005'::uuid),
    'is_admin', public.has_role(auth.uid(), 'admin')
  );
$$;
GRANT EXECUTE ON FUNCTION public.debug_whoami() TO authenticated, anon;
