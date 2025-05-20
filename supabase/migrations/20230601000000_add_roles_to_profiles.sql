
-- -- Add a roles array column to the profiles table
-- ALTER TABLE public.profiles
-- ADD COLUMN IF NOT EXISTS roles text[] DEFAULT ARRAY['student'];

-- -- Update existing profiles to have at least 'student' role
-- UPDATE public.profiles
-- SET roles = ARRAY[COALESCE(role, 'student'), 'student']
-- WHERE roles IS NULL OR roles = '{}';

-- -- Make sure the roles array contains 'student' for all users
-- UPDATE public.profiles
-- SET roles = array_append(roles, 'student')
-- WHERE NOT ('student' = ANY(roles));

-- -- Add admin role for Teneika Askew if she exists
-- UPDATE public.profiles
-- SET roles = array_append(roles, 'admin')
-- FROM auth.users
-- WHERE 
--   profiles.id = auth.users.id 
--   AND auth.users.email = 'teneika.askew@gmail.com'
--   AND NOT ('admin' = ANY(roles));
