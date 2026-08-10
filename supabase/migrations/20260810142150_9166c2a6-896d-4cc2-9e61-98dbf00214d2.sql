-- The Edge Function reads the expected shared secret from here (service_role only),
-- so the value lives in exactly one place: the vault.
CREATE OR REPLACE FUNCTION public.notification_email_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets
  WHERE name = 'notification_email_secret'
$$;

REVOKE ALL ON FUNCTION public.notification_email_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_email_secret() TO service_role;