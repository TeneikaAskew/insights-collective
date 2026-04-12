import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/utils.ts';

interface RecurrenceInput {
  type: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  repeat_interval?: number;
  end_date?: string;   // ISO date "2026-12-31"
  end_times?: number; // OR number of occurrences (max 50)
  weekly_days?: number[]; // 1=Sun, 2=Mon, … 7=Sat
}

function buildRecurrence(r: RecurrenceInput) {
  const zoomType = r.type === 'daily' ? 1 : r.type === 'monthly' ? 3 : 2;
  const interval = r.type === 'biweekly' ? 2 : (r.repeat_interval ?? 1);
  const obj: Record<string, unknown> = { type: zoomType, repeat_interval: interval };
  if (r.weekly_days?.length) obj.weekly_days = r.weekly_days.join(',');
  if (r.end_date) obj.end_date_time = `${r.end_date}T23:59:00Z`;
  else if (r.end_times) obj.end_times = r.end_times;
  return obj;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      title,
      start_time,
      duration = 60,
      agenda,
      recurrence,
    }: {
      title: string;
      start_time?: string;
      duration?: number;
      agenda?: string;
      recurrence?: RecurrenceInput;
    } = await req.json();

    const accountId  = Deno.env.get('ZOOM_ACCOUNT_ID');
    const clientId   = Deno.env.get('ZOOM_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');

    if (!accountId || !clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Zoom is not configured. Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET to Supabase secrets.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── OAuth: exchange client credentials for access token ──────────────
    const tokenRes = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    if (!tokenRes.ok) throw new Error(`Zoom token error: ${await tokenRes.text()}`);
    const { access_token } = await tokenRes.json();

    // ── Build meeting payload ─────────────────────────────────────────────
    // type 8 = recurring with fixed time, 2 = scheduled one-off, 1 = instant
    const meetingType = recurrence ? 8 : (start_time ? 2 : 1);

    const body: Record<string, unknown> = {
      topic: title,
      type: meetingType,
      agenda: agenda || title,
      duration,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: false,
        auto_recording: 'cloud',   // enable cloud recording for all meetings
        approval_type: 2,          // no registration required
        audio: 'both',
      },
    };

    if (start_time) body.start_time = start_time;
    if (recurrence) body.recurrence = buildRecurrence(recurrence);

    // ── Create meeting ────────────────────────────────────────────────────
    const meetingRes = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!meetingRes.ok) {
      const err = await meetingRes.json();
      throw new Error(err.message || 'Failed to create Zoom meeting');
    }

    const meeting = await meetingRes.json();

    return new Response(
      JSON.stringify({
        meeting_id:  meeting.id,
        join_url:    meeting.join_url,
        start_url:   meeting.start_url,
        password:    meeting.password,
        occurrences: meeting.occurrences ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
