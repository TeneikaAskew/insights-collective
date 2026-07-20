-- Wire the three role-isolated E2E accounts to the seeded course so real behavior is tested.
-- e2e-member enrolled as student; e2e-instructor becomes primary instructor of the course.
-- (test@ retains admin+instructor+student and can still access everything.)

DO $$
DECLARE
  v_course uuid := '660e8400-e29b-41d4-a716-446655440001';
  v_member uuid;
  v_instructor uuid;
BEGIN
  SELECT id INTO v_member    FROM auth.users WHERE email = 'e2e-member@insightscollective.org';
  SELECT id INTO v_instructor FROM auth.users WHERE email = 'e2e-instructor@insightscollective.org';

  IF v_member IS NOT NULL THEN
    INSERT INTO public.enrollments (user_id, course_id, enrolled_at, completion_status)
    VALUES (v_member, v_course, now(), 0)
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  IF v_instructor IS NOT NULL THEN
    UPDATE public.courses SET instructor_id = v_instructor WHERE id = v_course;
    INSERT INTO public.course_assignments (course_id, user_id, role)
    VALUES (v_course, v_instructor, 'instructor')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;