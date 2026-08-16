// ABOUTME: Sends each user one email summarising the notifications they have not
// ABOUTME: been mailed yet, honouring the daily/weekly/never frequency they chose.
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

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

type Pending = {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string | null;
  message: string | null;
  link: string | null;
  created_at: string;
};

// A digest can cover an unbounded backlog — a user who was on 'weekly' and away
// could hold dozens. Listing every one makes an unreadable email, so the body
// shows the most recent and counts the rest.
const MAX_LISTED = 25;

function template(firstName: string | null, items: Pending[], total: number): string {
  const rows = items
    .map((n) => {
      const href = escapeHtml(appUrl(n.link));
      const title = escapeHtml(n.title ?? 'Notification');
      const message = escapeHtml(n.message ?? '');
      return `<tr><td style="padding:12px 0;border-bottom:1px solid #ececf2">
        <a href="${href}" style="color:#1c1c28;text-decoration:none;font-size:15px;font-weight:600">${title}</a>
        ${message ? `<p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:#5a5a6e">${message}</p>` : ''}
      </td></tr>`;
    })
    .join('');
  const overflow = total > items.length
    ? `<p style="margin:16px 0 0;font-size:13px;color:#8a8a9a">and ${total - items.length} more.</p>`
    : '';
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';
  const heading = total === 1 ? '1 new notification' : `${total} new notifications`;

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f8;font-family:'Plus Jakarta Sans',Inter,Helvetica,Arial,sans-serif;color:#1c1c28">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <tr><td>
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b6b7b">Insights Collective</p>
      <h1 style="margin:0 0 4px;font-size:20px;line-height:1.3">${heading}</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#5a5a6e">${greeting} here is what you missed.</p>
      <table role="presentation" width="100%">${rows}</table>
      ${overflow}
      <a href="${escapeHtml(appUrl('/notifications'))}" style="display:inline-block;margin-top:24px;background:#4f2ec9;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">Open in Insights Collective</a>
      <p style="margin:24px 0 0;font-size:12px;color:#8a8a9a">You chose to receive these as a summary. Change how often, or turn them off, in your profile settings.</p>
    </td></tr>
  </table>
</body></html>`;
}

function textBody(items: Pending[], total: number): string {
  const lines = items.map((n) => `- ${n.title ?? 'Notification'}${n.message ? `: ${n.message}` : ''}\n  ${appUrl(n.link)}`);
  if (total > items.length) lines.push(`and ${total - items.length} more.`);
  return `${total === 1 ? '1 new notification' : `${total} new notifications`}\n\n${lines.join('\n\n')}\n\n${appUrl('/notifications')}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const presented = req.headers.get('x-notify-secret');
  if (!presented) return json({ error: 'unauthorized' }, 401);
  const admin = adminClient();
  const { data: expected, error: secretErr } = await admin.rpc('notification_email_secret');
  if (secretErr) return json({ error: `secret lookup failed: ${secretErr.message}` }, 500);
  if (!expected) return json({ error: 'notification email secret is not configured' }, 500);
  if (presented !== expected) return json({ error: 'unauthorized' }, 401);

  let body: { mode?: string; trigger?: string } = {};
  try { body = await req.json(); } catch { /* an empty body is a valid manual run */ }
  // `preview` answers "what would this send?" without sending or marking anything,
  // so the first production run can be inspected before it reaches anyone.
  const preview = body.mode === 'preview';

  // Weekly subscribers are held until Monday, so a week's worth lands together
  // rather than whatever happens to be pending on an arbitrary day.
  const isMonday = new Date().getUTCDay() === 1;

  try {
    const { data: pending, error: pErr } = await admin
      .from('notifications')
      .select('id, user_id, course_id, title, message, link, created_at')
      .is('email_digest_sent_at', null)
      .order('created_at', { ascending: true })
      .limit(5000);
    if (pErr) return json({ error: `pending lookup failed: ${pErr.message}` }, 500);

    const all = (pending ?? []) as Pending[];

    // Course membership is re-checked at send time, not trusted from when the row
    // was written. A notification can outlive the relationship that justified it:
    // unenrol someone in the morning and the afternoon digest would otherwise mail
    // them about a course they have left.
    //
    // Membership is enrolled OR course staff. Instructors are never enrolled in
    // their own course, and notify_on_assignment_submission writes to
    // course_instructors and courses.instructor_id — an enrolment-only test would
    // silently drop every "new submission" notice an instructor gets.
    const courseScoped = all.filter((n) => n.course_id);
    const member = new Set<string>();
    if (courseScoped.length) {
      const userIds = Array.from(new Set(courseScoped.map((n) => n.user_id)));
      const courseIds = Array.from(new Set(courseScoped.map((n) => n.course_id as string)));
      const [enrolled, staff, owned] = await Promise.all([
        admin.from('enrollments').select('user_id, course_id').in('user_id', userIds).in('course_id', courseIds),
        admin.from('course_instructors').select('user_id, course_id').in('user_id', userIds).in('course_id', courseIds),
        admin.from('courses').select('id, instructor_id').in('id', courseIds),
      ]);
      for (const r of enrolled.data ?? []) member.add(`${r.user_id}:${r.course_id}`);
      for (const r of staff.data ?? []) member.add(`${r.user_id}:${r.course_id}`);
      for (const c of owned.data ?? []) if (c.instructor_id) member.add(`${c.instructor_id}:${c.id}`);
    }

    const deliverable: Pending[] = [];
    const orphaned: Pending[] = [];
    for (const n of all) {
      if (!n.course_id || member.has(`${n.user_id}:${n.course_id}`)) deliverable.push(n);
      else orphaned.push(n);
    }

    // Marked rather than left pending: the relationship is gone, so re-evaluating
    // these every night would suppress them again forever.
    if (orphaned.length && !preview) {
      const { error } = await admin
        .from('notifications')
        .update({ email_digest_sent_at: new Date().toISOString() })
        .in('id', orphaned.map((n) => n.id));
      if (error) console.error('marking orphaned notifications failed:', error.message);
    }

    const byUser = new Map<string, Pending[]>();
    for (const n of deliverable) {
      const list = byUser.get(n.user_id) ?? [];
      list.push(n);
      byUser.set(n.user_id, list);
    }
    if (byUser.size === 0) {
      return json({
        status: 'ok', users: 0, sent: 0, dry_run: 0, skipped: 0, failed: 0,
        suppressed_not_in_course: orphaned.length,
      });
    }

    const { data: profiles } = await admin
      .from('profiles')
      .select('id, first_name, notification_settings')
      .in('id', Array.from(byUser.keys()));
    const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

    let sent = 0, dryRun = 0, skipped = 0, failed = 0, held = 0, marked = 0;
    const detail: Array<Record<string, unknown>> = [];

    for (const [userId, items] of byUser) {
      const profile = profileById.get(userId) as
        | { first_name?: string | null; notification_settings?: Record<string, unknown> | null }
        | undefined;
      const settings = (profile?.notification_settings ?? {}) as Record<string, unknown>;
      // The UI writes daily/weekly/never and defaults to daily; a profile that
      // predates the control has no value at all, which is the same intent.
      const frequency = (settings.frequency as string) ?? 'daily';

      const markDigested = async (reason: string) => {
        if (preview) return;
        const { error } = await admin
          .from('notifications')
          .update({ email_digest_sent_at: new Date().toISOString() })
          .in('id', items.map((i) => i.id));
        if (error) console.error(`mark failed (${reason}) for ${userId}:`, error.message);
        else marked += items.length;
      };

      if (settings.email === false || frequency === 'never') {
        // Marked, not left pending: otherwise switching back to daily later would
        // deliver a backlog reaching to whenever they opted out.
        skipped++;
        detail.push({ user_id: userId, outcome: 'skipped', reason: frequency === 'never' ? 'frequency=never' : 'email off', count: items.length });
        await markDigested('opted out');
        continue;
      }

      if (frequency === 'weekly' && !isMonday) {
        held++;
        detail.push({ user_id: userId, outcome: 'held', reason: 'weekly, not Monday', count: items.length });
        continue;
      }

      const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(userId);
      const to = userRes?.user?.email;
      if (uErr || !to) {
        skipped++;
        detail.push({ user_id: userId, outcome: 'skipped', reason: 'no email address', count: items.length });
        await markDigested('no address');
        continue;
      }

      const listed = items.slice(-MAX_LISTED).reverse();
      const isDry = isDryRunRecipient(to);

      try {
        let providerId: string | null = null;
        if (!preview && !isDry) {
          const from = await resolveFrom();
          const res = (await resend('/emails', {
            method: 'POST',
            body: JSON.stringify({
              from,
              to: [to],
              subject: items.length === 1 ? 'Your Insights Collective summary' : `Your Insights Collective summary (${items.length} updates)`,
              html: template(profile?.first_name ?? null, listed, items.length),
              text: textBody(listed, items.length),
            }),
          })) as { id?: string };
          providerId = res?.id ?? null;
        } else if (!preview && isDry) {
          // Still render, so a template fault surfaces in CI rather than in a
          // real send later.
          template(profile?.first_name ?? null, listed, items.length);
        }

        if (isDry) dryRun++; else sent++;
        detail.push({ user_id: userId, outcome: isDry ? 'dry_run' : 'sent', recipient: to, count: items.length });

        if (!preview) {
          await admin.from('notification_email_log').insert({
            notification_id: null,
            user_id: userId,
            recipient: to,
            provider_message_id: providerId,
            status: isDry ? 'dry_run' : 'sent',
          });
          await markDigested('delivered');
        }
      } catch (e) {
        // Left unmarked on purpose: an unsent digest must be retried, not lost.
        const message = e instanceof Error ? e.message : String(e);
        failed++;
        detail.push({ user_id: userId, outcome: 'failed', recipient: to, count: items.length, error: message.slice(0, 200) });
        console.error(`digest failed for ${userId}:`, message);
        if (!preview) {
          await admin.from('notification_email_log').insert({
            notification_id: null,
            user_id: userId,
            recipient: to,
            status: 'failed',
            error: message.slice(0, 1000),
          });
        }
      }
    }

    return json({
      status: 'ok',
      preview,
      users: byUser.size,
      pending_notifications: all.length,
      suppressed_not_in_course: orphaned.length,
      sent,
      dry_run: dryRun,
      skipped,
      held_until_monday: held,
      failed,
      notifications_marked: marked,
      detail,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('send-notification-digest failed:', message);
    return json({ error: message }, 502);
  }
});
