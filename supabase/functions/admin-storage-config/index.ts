// ABOUTME: Admin-only endpoint that keeps the course-documents bucket's upload rules in sync.
// ABOUTME: Storage bucket settings (MIME allowlist, size cap) can only be changed with the service role.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The file types the assignment submission UI lets students attach.
const SUBMISSION_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
  'text/csv',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

const MAX_BYTES = 25 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      // Every outcome used to leave here as 200, including "Not authenticated"
      // and "Admin role required". The authorization itself was sound — a member
      // never reached updateBucket — but a caller could only discover that by
      // parsing the body, monitoring saw a clean 200 for a rejected admin
      // action, and any smoke check counted it as success. The status now says
      // what happened; `success: false` in the body is unchanged for callers
      // that already read it.
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';

    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await asUser.auth.getUser();
    if (userError || !userData?.user) {
      return json({ success: false, error: 'Not authenticated' }, 401);
    }

    const { data: isAdmin, error: roleError } = await asUser.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (roleError) return json({ success: false, error: roleError.message }, 500);
    if (!isAdmin) return json({ success: false, error: 'Admin role required' }, 403);

    const admin = createClient(url, serviceKey);
    const { error } = await admin.storage.updateBucket('course-documents', {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: SUBMISSION_MIME_TYPES,
    });
    if (error) return json({ success: false, error: error.message }, 502);

    return json({ success: true, allowedMimeTypes: SUBMISSION_MIME_TYPES, fileSizeLimit: MAX_BYTES });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
