// ABOUTME: Sends an email copy of an in-app notification through Resend.
// ABOUTME: Called by the notifications AFTER INSERT trigger via pg_net, or directly for diagnostics.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-notify-secret',
};

const RESEND_API = 'https://api.resend.com';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Resend is used directly (the key is a provider key, not a connector-gateway key).
async function resend(path: string, init: RequestInit = {}) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  const res = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${res.status}] ${text}`);
  return text ? JSON.parse(text) : {};
}

// The sender domain is whatever is verified in Resend, so it is discovered rather
// than hardcoded — a wrong `from` is a 403 that looks like a broken key.
let cachedFrom: string | null = null;
async function resolveFrom(): Promise<string> {
  const override = Deno.env.get('NOTIFICATION_EMAIL_FROM');
  if (override) return override;
  if (cachedFrom) return cachedFrom;
  const domains = await resend('/domains');
  const list: Array<{ name: string; status: string }> = domains?.data ?? [];
  const verified = list.find((d) => d.status === 'verified');
  if (!verified) {
    throw new Error(
      `no verified sender domain in Resend (found: ${list.map((d) => `${d.name}:${d.status}`).join(', ') || 'none'})`,
    );
  }
  cachedFrom = `Insights Collective <notifications@${verified.name}>`;
  return cachedFrom;
}

function appUrl(link: string | null): string {
  const base = (Deno.env.get('APP_BASE_URL') ?? 'https://insightscollective.org').replace(/\/$/, '');
  if (!link) return base;
  return `${base}${link.startsWith('/') ? '' : '/'}${link}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const expected = Deno.env.get('NOTIFICATION_EMAIL_SECRET');
  if (!expected) return json({ error: 'NOTIFICATION_EMAIL_SECRET is not configured' }, 500);
  if (req.headers.get('x-notify-secret') !== expected) return json({ error: 'unauthorized' }, 401);

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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

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
    const sent = await resend('/emails', {
      method: 'POST',
      body: JSON.stringify({
        from,
        to: [to],
        subject: notification.title,
        html: template(notification.title, notification.message ?? '', url),
        text: `${notification.title}\n\n${notification.message ?? ''}\n\n${url}`,
      }),
    });

    await admin.from('notification_email_log').insert({
      notification_id: notification.id,
      user_id: notification.user_id,
      recipient: to,
      provider_message_id: (sent as { id?: string })?.id ?? null,
      status: 'sent',
    });

    return json({ sent: true, id: (sent as { id?: string })?.id ?? null });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('send-notification-email failed:', detail);
    try {
      if (body.notification_id) {
        const admin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        await admin.from('notification_email_log').insert({
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
