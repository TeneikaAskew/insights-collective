-- -- Create profiles table
-- CREATE TABLE IF NOT EXISTS public.profiles (
--     id UUID REFERENCES auth.users(id) PRIMARY KEY,
--     email TEXT,
--     full_name TEXT,
--     avatar_url TEXT,
--     created_at TIMESTAMPTZ DEFAULT NOW(),
--     updated_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- -- Enable Row Level Security
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- -- Create policies
-- CREATE POLICY "Public profiles are viewable by everyone"
--     ON public.profiles FOR SELECT
--     USING (true);

-- CREATE POLICY "Users can insert their own profile"
--     ON public.profiles FOR INSERT
--     WITH CHECK (auth.uid() = id);

-- CREATE POLICY "Users can update their own profile"
--     ON public.profiles FOR UPDATE
--     USING (auth.uid() = id); 