// ABOUTME: Reports how many enrolled students a course announcement reached.
// ABOUTME: The notifications and their emails are raised by DB triggers, not here.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/utils.ts';

type Payload = {
  course_id?: string;
  announcement_id?: string;
  title?: string;
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
  const { course_id, announcement_id, title } = payload;
  if (!course_id || !title) return json(400, { error: 'course_id and title are required' });

  // Verify caller can post announcements (instructor or admin)
  const { data: canManage } = await admin.rpc('can_manage_course_content', {
    viewer_id: user.id, target_course_id: course_id,
  });
  if (!canManage) return json(403, { error: 'Not authorized for this course' });

  // Enrolled students. Counted with the service role because RLS hides other
  // students' enrolments from the instructor's own client.
  const { data: enrollments, error: enrErr } = await admin
    .from('enrollments').select('user_id').eq('course_id', course_id);
  if (enrErr) return json(500, { error: enrErr.message });
  const userIds = Array.from(new Set((enrollments ?? []).map((e) => e.user_id).filter(Boolean)));

  // No email is sent here, deliberately. The AFTER INSERT trigger on
  // course_announcements already inserts one notification per enrolled student,
  // and the trigger on notifications mails each one through
  // send-notification-email. This function used to BCC the same students on top
  // of that, so every announcement cost twice its Resend quota and every student
  // received the message twice.
  //
  // The per-notification path is the one worth keeping. The BCC ignored each
  // recipient's notification_settings.email opt-out, interpolated the
  // announcement title and body straight into HTML instead of escaping them,
  // carried no link back to the announcement, and wrote nothing to
  // notification_email_log.
  return json(200, {
    status: 'ok',
    announcement_id: announcement_id ?? null,
    recipients: userIds.length,
  });
});
