UPDATE public.courses
   SET instructor_id = '66649756-9cfb-4f50-b60e-1f6ac0bf30ff'
 WHERE id = '660e8400-e29b-41d4-a716-446655440001';

INSERT INTO public.enrollments (user_id, course_id, completion_status)
VALUES ('66649756-9cfb-4f50-b60e-1f6ac0bf30ff', '660e8400-e29b-41d4-a716-446655440001', 0)
ON CONFLICT DO NOTHING;