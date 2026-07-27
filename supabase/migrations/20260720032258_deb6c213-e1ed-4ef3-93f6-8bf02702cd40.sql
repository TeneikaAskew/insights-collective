
CREATE TABLE IF NOT EXISTS public.certificate_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  code text,
  found boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cert_verify_ip_time
  ON public.certificate_verification_attempts (ip_hash, attempted_at DESC);

GRANT ALL ON public.certificate_verification_attempts TO service_role;

ALTER TABLE public.certificate_verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages verify attempts"
  ON public.certificate_verification_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.rate_limit_certificate_verify(
  p_ip_hash text,
  p_code text,
  p_found boolean
)
RETURNS TABLE (rate_limited boolean, attempts_last_minute int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.certificate_verification_attempts
   WHERE ip_hash = p_ip_hash
     AND attempted_at > now() - interval '1 minute';

  INSERT INTO public.certificate_verification_attempts (ip_hash, code, found)
  VALUES (p_ip_hash, p_code, p_found);

  -- Prune old rows opportunistically (keep 24h of history)
  DELETE FROM public.certificate_verification_attempts
   WHERE attempted_at < now() - interval '24 hours';

  RETURN QUERY SELECT (v_count >= 20)::boolean, v_count + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_certificate_verify(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_certificate_verify(text, text, boolean) TO service_role;
