// ABOUTME: Sends an email copy of one in-app notification through Resend.
// ABOUTME: Routine mail is batched by send-notification-digest; this serves the
// ABOUTME: notification_email_probe diagnostics and one-off resends by id.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { isDryRunRecipient } from '../_shared/email-recipients.ts';
import { appUrl, escapeHtml, resend, resolveFrom } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-notify-secret',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function template(title: string, message: string, url: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f8;font-family:'Plus Jakarta Sans',Inter,Helvetica,Arial,sans-serif;color:#1c1c28">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <tr><td>
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b7b">Insights Collective</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3d3d4e">${escapeHtml(message)}</p>
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#4f2ec9;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">Open in Insights Collective</a>
      <p style="margin:24px 0 0;font-size:12px;color:#8a8a9a">You can turn email notifications off in your profile settings.</p>
    </td></tr>
  </table>
</body></html>`;
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // The expected secret lives only in the database vault; the trigger reads it there
  // too, so there is no second copy to drift or leak.
  const presented = req.headers.get('x-notify-secret');
  if (!presented) return json({ error: 'unauthorized' }, 401);
  const { data: expected, error: secretErr } = await adminClient().rpc('notification_email_secret');
  if (secretErr) return json({ error: `secret lookup failed: ${secretErr.message}` }, 500);
  if (!expected) return json({ error: 'notification email secret is not configured' }, 500);
  if (presented !== expected) return json({ error: 'unauthorized' }, 401);

  let body: { notification_id?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }


  try {
    if (body.mode === 'diagnostics') {
      const domains = await resend('/domains');
      let from: string | null = null;
      let fromError: string | null = null;
      try {
        from = await resolveFrom();
      } catch (e) {
        fromError = e instanceof Error ? e.message : String(e);
      }
      return json({ domains: domains?.data ?? [], from, fromError });
    }

    if (!body.notification_id) return json({ error: 'notification_id is required' }, 400);

    const admin = adminClient();

    const { data: notification, error: nErr } = await admin
      .from('notifications')
      .select('id, user_id, type, title, message, link')
      .eq('id', body.notification_id)
      .maybeSingle();
    if (nErr) return json({ error: `notification lookup failed: ${nErr.message}` }, 500);
    if (!notification) return json({ error: 'notification not found' }, 404);

    const { data: profile } = await admin
      .from('profiles')
      .select('first_name, notification_settings')
      .eq('id', notification.user_id)
      .maybeSingle();

    const settings = (profile?.notification_settings ?? {}) as Record<string, unknown>;
    if (settings.email === false) {
      return json({ skipped: 'user opted out of email notifications' });
    }

    const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(notification.user_id);
    if (uErr) return json({ error: `user lookup failed: ${uErr.message}` }, 500);
    const to = userRes?.user?.email;
    if (!to) return json({ skipped: 'recipient has no email address' });

    const from = await resolveFrom();
    const url = appUrl(notification.link);
    const payload = {
      from,
      to: [to],
      subject: notification.title,
      html: template(notification.title, notification.message ?? '', url),
      text: `${notification.title}\n\n${notification.message ?? ''}\n\n${url}`,
    };

    // Everything above ran for real — secret check, opt-out, sender resolution,
    // template render — so CI still covers the send path end to end. Only the
    // provider call is conditional, and the log row records which branch ran.
    const dryRun = isDryRunRecipient(to);
    const sent = dryRun
      ? null
      : ((await resend('/emails', {
          method: 'POST',
          body: JSON.stringify(payload),
        })) as { id?: string });

    // Stamped here as well as by the digest, because this notification has now
    // been dealt with either way. Without it a one-off resend left the row
    // pending and the next digest mailed the same notification again — the one
    // seam where two senders could both claim the same row.
    const { error: stampErr } = await admin
      .from('notifications')
      .update({ email_digest_sent_at: new Date().toISOString() })
      .eq('id', notification.id);
    if (stampErr) console.error('failed to stamp notification as emailed:', stampErr.message);

    await admin.from('notification_email_log').insert({
      notification_id: notification.id,
      user_id: notification.user_id,
      recipient: to,
      provider_message_id: sent?.id ?? null,
      status: dryRun ? 'dry_run' : 'sent',
      error: stampErr ? 'sent, but the notification could not be stamped; the digest may repeat it' : null,
    });

    return dryRun
      ? json({ dry_run: true, to, subject: payload.subject })
      : json({ sent: true, id: sent?.id ?? null });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('send-notification-email failed:', detail);
    try {
      if (body.notification_id) {
        await adminClient().from('notification_email_log').insert({
          notification_id: body.notification_id,
          status: 'failed',
          error: detail.slice(0, 1000),
        });
      }
    } catch (logErr) {
      console.error('failed to record email failure:', logErr);
    }
    return json({ error: detail }, 502);
  }
});
