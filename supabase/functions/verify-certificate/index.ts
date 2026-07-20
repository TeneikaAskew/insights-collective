// ABOUTME: Public certificate verification endpoint with per-IP rate limiting.
// ABOUTME: Wraps the verify_certificate RPC and returns clear error states.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/utils.ts';

const CODE_RE = /^[A-Za-z0-9]{6,32}$/;

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`cert-verify::${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for') ?? '';
  const first = xf.split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip') || 'unknown';
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  let code = url.searchParams.get('code') ?? '';
  if (!code && req.method === 'POST') {
    try {
      const body = await req.json();
      code = String(body?.code ?? '');
    } catch { /* ignore */ }
  }
  code = code.trim();

  if (!code) {
    return json(400, { status: 'invalid_input', message: 'Verification code is required.' });
  }
  if (!CODE_RE.test(code)) {
    return json(400, { status: 'invalid_format', message: 'Verification codes are 6–32 letters and numbers only.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const ipHash = await hashIp(clientIp(req));

  // Look up first so we can log whether it was found; rate limit runs after
  // and can still block subsequent calls even for a valid code.
  const { data: rpcData, error: rpcError } = await admin
    .rpc('verify_certificate', { p_code: code });
  if (rpcError) {
    console.error('verify_certificate rpc error', rpcError);
  }
  const cert = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const found = !!cert;

  const { data: rl, error: rlError } = await admin
    .rpc('rate_limit_certificate_verify', {
      p_ip_hash: ipHash,
      p_code: code.slice(0, 32),
      p_found: found,
    });
  if (rlError) {
    console.error('rate_limit rpc error', rlError);
  }
  const row = Array.isArray(rl) ? rl[0] : rl;
  if (row?.rate_limited) {
    return json(429, {
      status: 'rate_limited',
      message: 'Too many verification attempts from your network. Please wait a minute and try again.',
      retry_after_seconds: 60,
    });
  }

  if (!found) {
    return json(404, {
      status: 'not_found',
      message: 'No certificate found for this verification code. Double-check the code and try again.',
    });
  }

  return json(200, { status: 'verified', certificate: cert });
});
