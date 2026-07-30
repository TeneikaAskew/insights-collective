-- ABOUTME: Moves the coursera-refresh shared secret from a function environment
-- ABOUTME: variable into Vault, and gives the function a way to check a presented
-- ABOUTME: secret without ever being able to read it back.
--
-- Why not an environment variable
-- ------------------------------
-- The original design read COURSERA_REFRESH_SECRET from the function's env, which
-- requires `supabase secrets set` and therefore a management access token. Vault is
-- reachable with nothing but the database connection the project already has, so the
-- secret can be rotated and the function deployed without a second credential path.
--
-- Edge Functions always get SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY injected by
-- the platform, so the function can reach this RPC with no configuration at all.
--
-- Why an RPC rather than letting the function read Vault directly
-- --------------------------------------------------------------
-- `vault.decrypted_secrets` lives outside the `public` schema, so PostgREST does not
-- serve it — and exposing it would be the wrong fix. This function takes a candidate
-- and returns a boolean. Even if it were somehow reachable by a lesser role, it
-- cannot be used to extract the secret, only to test a guess.

create or replace function public.coursera_verify_refresh_secret(p_secret text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text;
begin
  if p_secret is null or length(p_secret) = 0 then
    return false;
  end if;

  select decrypted_secret into v_expected
    from vault.decrypted_secrets
    where name = 'coursera_refresh_secret';

  -- Unconfigured must fail closed. Returning true here would leave the crawler
  -- callable by anyone until someone remembered to set the secret.
  if v_expected is null then
    return false;
  end if;

  -- Length-independent comparison. Postgres `=` on text short-circuits, which leaks
  -- a timing signal; hashing both sides gives a fixed-width comparison instead.
  return encode(extensions.digest(p_secret, 'sha256'), 'hex')
       = encode(extensions.digest(v_expected, 'sha256'), 'hex');
end;
$$;

comment on function public.coursera_verify_refresh_secret(text) is
  'Returns true when the given value matches the coursera_refresh_secret Vault entry. Never returns the secret itself.';

-- Only the service role may call this — that is the Edge Function. A browser session
-- has no business testing crawler credentials.
revoke all on function public.coursera_verify_refresh_secret(text) from public, anon, authenticated;
grant execute on function public.coursera_verify_refresh_secret(text) to service_role;
