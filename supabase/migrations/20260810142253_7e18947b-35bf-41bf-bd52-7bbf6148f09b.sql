-- Operator smoke test: fires a diagnostics call at the email function and returns
-- the provider's answer. Takes no arguments, so it cannot be repurposed as an
-- arbitrary HTTP client, and never returns the shared secret.
CREATE OR REPLACE FUNCTION public.notification_email_probe()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_request_id bigint;
  v_result jsonb;
  v_tries int := 0;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'notification_email_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'notification_email_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN jsonb_build_object('error', 'notification email not configured');
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    body := jsonb_build_object('mode', 'diagnostics'),
    timeout_milliseconds := 20000
  ) INTO v_request_id;

  WHILE v_tries < 40 LOOP
    PERFORM pg_sleep(0.5);
    v_tries := v_tries + 1;
    SELECT jsonb_build_object('status_code', status_code, 'body', content)
      INTO v_result FROM net._http_response WHERE id = v_request_id;
    IF v_result IS NOT NULL THEN
      RETURN v_result;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('error', 'no response captured', 'request_id', v_request_id);
END;
$$;

REVOKE ALL ON FUNCTION public.notification_email_probe() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_email_probe() TO service_role;