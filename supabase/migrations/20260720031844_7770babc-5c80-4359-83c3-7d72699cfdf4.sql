
CREATE OR REPLACE FUNCTION public.verify_certificate(p_code text)
RETURNS TABLE (
  verification_code text,
  certificate_type text,
  issued_at timestamptz,
  certificate_data jsonb,
  course_id uuid,
  course_title text,
  course_category text,
  course_level text,
  course_duration text,
  student_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.verification_code,
    c.certificate_type,
    c.issued_at,
    c.certificate_data,
    co.id AS course_id,
    co.title AS course_title,
    co.category AS course_category,
    co.level AS course_level,
    co.duration AS course_duration,
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), 'Certified Student') AS student_name
  FROM public.certificates c
  LEFT JOIN public.courses co ON co.id = c.course_id
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.verification_code = p_code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;
