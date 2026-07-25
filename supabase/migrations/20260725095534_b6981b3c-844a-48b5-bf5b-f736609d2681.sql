CREATE OR REPLACE FUNCTION public.debug_module_insert(target_course_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'auth_uid', auth.uid(),
    'can_manage', public.can_manage_course_content(auth.uid(), target_course_id),
    'course_row', (SELECT jsonb_build_object('id',c.id,'instructor_id',c.instructor_id) FROM courses c WHERE c.id=target_course_id)
  );
$$;
GRANT EXECUTE ON FUNCTION public.debug_module_insert(uuid) TO authenticated, anon;