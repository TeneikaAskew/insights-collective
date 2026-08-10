-- Email delivery log for in-app notifications mirrored to email.
CREATE TABLE IF NOT EXISTS public.notification_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid,
  user_id uuid,
  recipient text,
  provider_message_id text,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.notification_email_log TO service_role;
ALTER TABLE public.notification_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read notification email log" ON public.notification_email_log;
CREATE POLICY "Admins can read notification email log"
  ON public.notification_email_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS notification_email_log_notification_idx
  ON public.notification_email_log (notification_id);

-- Shared secret between the trigger and the Edge Function. Generated in SQL so the
-- plaintext never lands in a migration file; it is read back once to configure the
-- function's NOTIFICATION_EMAIL_SECRET.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notification_email_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'notification_email_secret');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notification_email_url') THEN
    PERFORM vault.create_secret(
      'https://siuqvhscuiycvdrtiqsh.supabase.co/functions/v1/send-notification-email',
      'notification_email_url');
  END IF;
END $$;

-- Fan-out: every in-app notification also gets an email copy. Missing configuration
-- is a notice, not an error — a failed email must never roll back the notification.
CREATE OR REPLACE FUNCTION public.email_notification_fanout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'notification_email_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'notification_email_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE NOTICE 'notification email not configured; skipping';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    body := jsonb_build_object('notification_id', NEW.id),
    timeout_milliseconds := 15000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notification email dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.email_notification_fanout() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_email_notification_fanout ON public.notifications;
CREATE TRIGGER trg_email_notification_fanout
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.email_notification_fanout();