import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/utils.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, start_time, duration = 60, agenda } = await req.json();

    const accountId = Deno.env.get('ZOOM_ACCOUNT_ID');
    const clientId = Deno.env.get('ZOOM_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');

    if (!accountId || !clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Zoom is not configured. Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET to Supabase secrets.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange client credentials for an access token (Server-to-Server OAuth)
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

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`Zoom token error: ${body}`);
    }

    const { access_token } = await tokenRes.json();

    // Create the meeting
    const meetingRes = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: title,
        type: start_time ? 2 : 1,   // 2 = scheduled, 1 = instant
        start_time,                  // ISO-8601, e.g. "2026-04-20T14:00:00"
        duration,
        agenda: agenda || title,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          waiting_room: false,
          auto_recording: 'none',
        },
      }),
    });

    if (!meetingRes.ok) {
      const err = await meetingRes.json();
      throw new Error(err.message || 'Failed to create Zoom meeting');
    }

    const meeting = await meetingRes.json();

    return new Response(
      JSON.stringify({
        meeting_id: meeting.id,
        join_url: meeting.join_url,
        start_url: meeting.start_url,
        password: meeting.password,
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
