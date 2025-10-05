-- Fix is_course_instructor to only return true for courses the user is actually assigned to
-- Remove the global 'instructor' role check that was granting access to all courses

CREATE OR REPLACE FUNCTION public.is_course_instructor(user_id_param uuid, course_id_param uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM courses 
    WHERE id = course_id_param 
    AND instructor_id = user_id_param
  ) OR EXISTS (
    SELECT 1 FROM course_assignments 
    WHERE course_id = course_id_param 
    AND user_id = user_id_param 
    AND role = 'instructor'
  );
$function$;