-- Honour the notification frequency users have been choosing all along.
--
-- profiles.notification_settings has carried a `frequency` key (daily/weekly/never)
-- since the settings UI shipped: 89 profiles are set to daily and one to weekly.
-- Nothing on the send side ever read it. Every notification was mailed the moment
-- its row was inserted, so a course announcement to fifteen students was fifteen
-- immediate emails, and four announcements in a day were sixty.
--
-- This replaces the per-row fan-out with one digest per user per period, sent at
-- 13:00 UTC — inside working hours or early evening for every enrolled student
-- (09:00 US Eastern, 14:00 Lagos, 18:30 India). In-app notifications are untouched
-- and still appear the instant the row lands; only email is batched.

-- Which notifications a digest has already covered. NULL means still pending.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_digest_sent_at timestamptz;

-- The digest reads only pending rows, which are a small minority of the table.
CREATE INDEX IF NOT EXISTS notifications_pending_digest_idx
  ON public.notifications (user_id)
  WHERE email_digest_sent_at IS NULL;

-- Everything that already exists was either mailed immediately or deliberately
-- skipped. Without this, the first run would mail every user their entire history.
UPDATE public.notifications
   SET email_digest_sent_at = now()
 WHERE email_digest_sent_at IS NULL;

-- Stop the immediate per-row send. The trigger function is intentionally left in
-- place: if the digest needs to be abandoned, restoring the old behaviour is one
-- CREATE TRIGGER, with no code to recover.
DROP TRIGGER IF EXISTS trg_email_notification_fanout ON public.notifications;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notification_digest_url') THEN
    PERFORM vault.create_secret(
      'https://siuqvhscuiycvdrtiqsh.supabase.co/functions/v1/send-notification-digest',
      'notification_digest_url');
  END IF;
END $$;

-- Fires the digest run. Shares notification_email_secret with the immediate
-- sender: same trust domain, and one secret is one thing to rotate.
CREATE OR REPLACE FUNCTION public.notification_digest_dispatch()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'notification_digest_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'notification_email_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE NOTICE 'notification digest not configured; skipping';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    body := jsonb_build_object('trigger', 'cron'),
    timeout_milliseconds := 150000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_digest_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_digest_dispatch() TO service_role;

-- 13:00 UTC daily. Weekly subscribers are held back to Mondays by the function,
-- which is where the per-user preference is already being read.
SELECT cron.unschedule('notification-digest-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-digest-daily');

SELECT cron.schedule(
  'notification-digest-daily',
  '0 13 * * *',
  $$SELECT public.notification_digest_dispatch()$$
);
