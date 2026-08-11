-- Adds the profile bio the application has always believed it had.
--
-- `profiles.bio` is declared in src/integrations/supabase/types.ts (since #40),
-- in src/types/index.ts and src/types/supabase.ts, rendered as a textarea on
-- /profile, and displayed in the admin user drawer. The database has never had
-- the column, and the Query-validity audit finally said so.
--
-- This was not a cosmetic mismatch. useProfileUpdate sends the whole form —
-- { first_name, last_name, bio } — to a single .update(), and PostgREST rejects
-- an update naming a column that does not exist. So the presence of `bio` in
-- that payload failed the ENTIRE save: editing your first name and pressing
-- Save did nothing but raise "Failed to save profile changes". Adding the
-- column repairs the save and makes the field on screen mean something, which
-- is what every consumer of it already assumes.
--
-- Nullable with no default: existing profiles simply have no bio yet, and the
-- UI already renders `data.bio || ''`.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

COMMENT ON COLUMN public.profiles.bio IS
  'Free-text self-description shown on /profile and in the admin user drawer. Nullable; the UI treats null as an empty string.';
