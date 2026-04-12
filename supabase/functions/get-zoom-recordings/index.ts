import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/utils.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meeting_id, from, to } = await req.json();

    const accountId    = Deno.env.get('ZOOM_ACCOUNT_ID');
    const clientId     = Deno.env.get('ZOOM_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');

    if (!accountId || !clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Zoom is not configured.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── OAuth token ───────────────────────────────────────────────────────
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

    let recordings: any[] = [];

    if (meeting_id) {
      // ── Fetch recordings for a specific meeting ───────────────────────
      const res = await fetch(
        `https://api.zoom.us/v2/meetings/${meeting_id}/recordings`,
        { headers: { 'Authorization': `Bearer ${access_token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        recordings = (data.recording_files ?? []).map((f: any) => ({
          id:           f.id,
          meeting_id:   data.id,
          topic:        data.topic,
          start_time:   data.start_time,
          file_type:    f.file_type,       // MP4, M4A, CHAT, TRANSCRIPT, …
          file_size:    f.file_size,
          play_url:     f.play_url,
          download_url: f.download_url,
          status:       f.status,
          recording_type: f.recording_type, // shared_screen_with_speaker_view, …
          duration:     data.duration,
        }));
      }
    } else {
      // ── Fetch all recordings for the account user ─────────────────────
      const fromDate = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]; // default: last 30 days
      const toDate   = to ?? new Date().toISOString().split('T')[0];

      const res = await fetch(
        `https://api.zoom.us/v2/users/me/recordings?from=${fromDate}&to=${toDate}&page_size=50`,
        { headers: { 'Authorization': `Bearer ${access_token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        for (const meeting of data.meetings ?? []) {
          for (const f of meeting.recording_files ?? []) {
            if (f.file_type === 'MP4' && f.status === 'completed') {
              recordings.push({
                id:             f.id,
                meeting_id:     meeting.id,
                topic:          meeting.topic,
                start_time:     meeting.start_time,
                file_type:      f.file_type,
                file_size:      f.file_size,
                play_url:       f.play_url,
                download_url:   f.download_url,
                status:         f.status,
                recording_type: f.recording_type,
                duration:       meeting.duration,
              });
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ recordings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
