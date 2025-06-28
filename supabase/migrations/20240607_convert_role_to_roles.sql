-- -- 1. Change the type of 'role' column from text to text[]
-- ALTER TABLE public.profiles
-- ALTER COLUMN role TYPE text[] USING ARRAY[role];

-- -- 2. (Optional) Set a default value if desired
-- -- ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT ARRAY['student']; 