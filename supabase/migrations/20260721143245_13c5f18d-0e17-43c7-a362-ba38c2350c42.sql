-- Allow users to delete their own certificates (needed so E2E cert-generation
-- can DELETE the seeded row via PostgREST and re-trigger auto-issuance).
DROP POLICY IF EXISTS "Users can delete their own certificates" ON public.certificates;
CREATE POLICY "Users can delete their own certificates"
  ON public.certificates FOR DELETE
  USING (auth.uid() = user_id);

-- Also fix the legacy seeded verification_code that violated the 12-char
-- upper-alphanumeric format the auto-issue trigger and E2E assertions require.
UPDATE public.certificates
SET verification_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
WHERE verification_code !~ '^[A-Z0-9]{12}$';