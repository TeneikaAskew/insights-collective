// ABOUTME: Fan out a course announcement to enrolled students as in-app
// ABOUTME: notifications and (if RESEND_API_KEY is set) email.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/utils.ts';

type Payload = {
  course_id?: string;
  announcement_id?: string;
  title?: string;
  content?: string;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Missing auth' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: 'Invalid session' });

  let payload: Payload;
  try { payload = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
  const { course_id, announcement_id, title, content } = payload;
  if (!course_id || !title) return json(400, { error: 'course_id and title are required' });

  // Verify caller can post announcements (instructor or admin)
  const { data: canManage } = await admin.rpc('can_manage_course_content', {
    viewer_id: user.id, target_course_id: course_id,
  });
  if (!canManage) return json(403, { error: 'Not authorized for this course' });

  // Course title (for message body)
  const { data: courseRow } = await admin
    .from('courses').select('title').eq('id', course_id).maybeSingle();
  const courseTitle = courseRow?.title ?? 'your course';

  // Enrolled students
  const { data: enrollments, error: enrErr } = await admin
    .from('enrollments').select('user_id').eq('course_id', course_id);
  if (enrErr) return json(500, { error: enrErr.message });
  const userIds = Array.from(new Set((enrollments ?? []).map((e) => e.user_id).filter(Boolean)));

  const link = `/courses/${course_id}/announcements`;
  const messageBody = (content ?? '').slice(0, 240);
  const notifRows = userIds.map((uid) => ({
    user_id: uid,
    title: `New announcement: ${title}`,
    message: messageBody || `${courseTitle} posted a new announcement.`,
    type: 'course_announcement',
    link,
    is_read: false,
  }));

  let inserted = 0;
  if (notifRows.length) {
    const { error: insErr, count } = await admin
      .from('notifications').insert(notifRows, { count: 'exact' });
    if (insErr) console.error('notification insert error', insErr);
    inserted = count ?? notifRows.length;
  }

  // Email fan-out (only if Resend is configured)
  let emailed = 0;
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromAddr = Deno.env.get('ANNOUNCEMENT_FROM_EMAIL') ?? 'notifications@insightscollective.org';
  if (resendKey && userIds.length) {
    // Fetch emails via auth admin
    const emails: string[] = [];
    for (const uid of userIds) {
      const { data } = await admin.auth.admin.getUserById(uid);
      const email = data?.user?.email;
      if (email) emails.push(email);
    }
    // Batch send using BCC in a single Resend call for simplicity
    if (emails.length) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddr,
            to: fromAddr,
            bcc: emails,
            subject: `[${courseTitle}] ${title}`,
            html: `
              <div style="font-family: system-ui, sans-serif; max-width:560px; margin:auto;">
                <h2 style="margin:0 0 8px 0;">${title}</h2>
                <p style="color:#555; margin:0 0 16px 0;">New announcement in ${courseTitle}</p>
                <div style="white-space:pre-wrap; color:#111; line-height:1.5;">${messageBody || ''}</div>
              </div>`,
          }),
        });
        if (resp.ok) emailed = emails.length;
        else console.error('resend error', await resp.text());
      } catch (e) {
        console.error('resend request failed', e);
      }
    }
  }

  return json(200, {
    status: 'ok',
    announcement_id: announcement_id ?? null,
    recipients: userIds.length,
    notified_in_app: inserted,
    emailed,
    email_enabled: !!resendKey,
  });
});
