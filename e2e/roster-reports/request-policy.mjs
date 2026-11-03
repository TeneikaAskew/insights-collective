// ABOUTME: PREVENTIVE API request policy for every roster-reports browser context (tests AND session setup): any non-GET
// ABOUTME: API request outside an exact allowlist is aborted BEFORE it is sent. Telemetry writes are recorded for reconciliation.
//
// Exact classification (no blanket RPC or POST exemption, no product change):
//   GET/HEAD to the API                        -> allowed (reads)
//   POST /auth/v1/token?grant_type=password|refresh_token -> 'auth-token' (session; setup signs in outside the browser)
//   POST /rest/v1/rpc/has_admin_access         -> 'read-rpc' (STABLE role check)
//   POST /rest/v1/rpc/is_course_instructor     -> 'read-rpc'
//   POST /rest/v1/rpc/get_user_roles           -> 'read-rpc'
//   POST /rest/v1/rpc/log_security_event       -> 'telemetry' (inserts one public.security_events row; reconciled by
//                                                 run.sh against the witness, separately from learning data)
//   anything else non-GET to the API           -> 'forbidden': route.abort('blockedbyclient'), recorded, test fails
// Requests to other origins are left to the origin guard (route.fallback()). Install this AFTER installOriginGuard so it
// runs first (Playwright runs the most recently added matching route first).

export const READ_RPCS = Object.freeze(['has_admin_access', 'is_course_instructor', 'get_user_roles']);
export const TELEMETRY_RPCS = Object.freeze(['log_security_event']);

/**
 * @param {string} method @param {string} rawUrl @param {string} apiOrigin
 * @returns {{ verdict: 'pass' | 'allow' | 'telemetry' | 'forbid', kind: string }}
 */
export function classifyRequest(method, rawUrl, apiOrigin) {
  let u;
  try { u = new URL(rawUrl); } catch { return { verdict: 'forbid', kind: 'unparseable' }; }
  if (u.origin !== apiOrigin) return { verdict: 'pass', kind: 'other-origin' };
  const m = String(method).toUpperCase();
  if (m === 'GET' || m === 'HEAD') return { verdict: 'allow', kind: 'read' };
  if (m === 'POST' && u.pathname === '/auth/v1/token' && ['password', 'refresh_token'].includes(u.searchParams.get('grant_type') ?? '')) {
    return { verdict: 'allow', kind: 'auth-token' };
  }
  const rpc = m === 'POST' && /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(u.pathname);
  if (rpc && READ_RPCS.includes(rpc[1]) && !u.search) return { verdict: 'allow', kind: `read-rpc:${rpc[1]}` };
  if (rpc && TELEMETRY_RPCS.includes(rpc[1]) && !u.search) return { verdict: 'telemetry', kind: `telemetry:${rpc[1]}` };
  return { verdict: 'forbid', kind: `${m} ${u.pathname.replace(/[^a-z0-9/_-]/gi, '?').slice(0, 80)}` };
}

/**
 * @param {import('@playwright/test').BrowserContext} context @param {string} apiOrigin
 * @param {{ actorOf?: (userId: string) => string, onTelemetry?: (rec: { rpc: string, actor: string, status: number }) => void }} [opts]
 * @returns {Promise<{ forbidden: string[], telemetry: Array<{ rpc: string, actor: string, status: number }> }>}
 */
export async function installRequestPolicy(context, apiOrigin, opts = {}) {
  const forbidden = [];
  const telemetry = [];
  await context.route('**/*', async (route) => {
    const req = route.request();
    const c = classifyRequest(req.method(), req.url(), apiOrigin);
    if (c.verdict === 'forbid') { forbidden.push(c.kind); return route.abort('blockedbyclient'); }
    return route.fallback();
  });
  context.on('response', (res) => {
    const req = res.request();
    const c = classifyRequest(req.method(), req.url(), apiOrigin);
    if (c.verdict !== 'telemetry') return;
    let actor = 'unknown';
    try { actor = (opts.actorOf ?? (() => 'unknown'))(String(JSON.parse(req.postData() ?? '{}').p_user_id ?? '')); } catch { actor = 'unparseable'; }
    const rec = { rpc: c.kind.slice('telemetry:'.length), actor, status: res.status() };
    telemetry.push(rec);
    opts.onTelemetry?.(rec);
  });
  return { forbidden, telemetry };
}
