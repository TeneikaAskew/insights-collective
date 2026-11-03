// ABOUTME: PREVENTIVE API request policy for every roster-reports browser context (tests AND session setup): any non-GET
// ABOUTME: API request outside an exact allowlist is aborted BEFORE it is sent. Telemetry writes are recorded for reconciliation.
//
// Exact classification (no blanket RPC or POST exemption, no product change):
//   GET/HEAD to the API                        -> allowed (reads)
//   POST /auth/v1/token?grant_type=password|refresh_token -> 'auth-token' (session; setup signs in outside the browser)
//   POST /rest/v1/rpc/has_admin_access         -> 'read-rpc' (STABLE role check)
//   POST /rest/v1/rpc/is_course_instructor     -> 'read-rpc'
//   POST /rest/v1/rpc/get_user_roles           -> 'read-rpc'
//   POST /rest/v1/rpc/log_security_event       -> 'telemetry' (inserts one public.security_events row; every one is
//                                                 tracked to success/failed/pending and reconciled against the witness)
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
 * Telemetry lifecycle, so the witness can equate the security_events delta with what the browser really did.
 * Every telemetry request is tracked from 'request' until finalize(): it stays tracked while its response is being
 * resolved, and ends exactly once as 'success' (requestfinished, 2xx), 'failed' (non-2xx, requestfailed, or a response
 * that cannot be read), or 'pending' (still unresolved at the finalize deadline). finalize(ms) waits a bounded time,
 * emits every unresolved request once as 'pending', then FREEZES: later completions of those are only counted. A NEW
 * telemetry start after the cutoff is the observation-boundary case: it is aborted before send, written once as
 * 'failed' (so the run-wide witness cannot PASS), counted in late.starts, and assertClosed() makes the setup and the
 * test fixture fail on it. Sink errors are collected and rethrown by finalize() and assertClosed().
 * @param {import('@playwright/test').BrowserContext} context @param {string} apiOrigin
 * @param {{ actorOf?: (userId: string) => string, onTelemetry?: (rec: { rpc: string, actor: string, status: string }) => void }} [opts]
 * @returns {Promise<{ forbidden: string[], telemetry: Array<{ rpc: string, actor: string, status: string }>, late: { starts: number, completions: number }, finalize: (ms?: number) => Promise<void>, assertClosed: () => void }>}
 */
export async function installRequestPolicy(context, apiOrigin, opts = {}) {
  const forbidden = [];
  const telemetry = [];
  const tracked = new Map(); // request -> { rpc, actor }; present from 'request' until its single emit
  const late = { starts: 0, completions: 0 }; // starts: NEW telemetry after the cutoff; completions: of already-emitted ones
  const postCutoff = new WeakSet(); // NEW starts after the cutoff: emitted once as 'failed' at start, then ignored
  const sinkErrors = [];
  let frozen = false;
  let finalized = null;
  const settle = (req, status) => {
    const t = tracked.get(req);
    if (!t) return;
    tracked.delete(req);
    const rec = { ...t, status };
    telemetry.push(rec);
    try { opts.onTelemetry?.(rec); } catch (e) { sinkErrors.push(String(e?.message ?? 'RR_SINK_E_UNKNOWN')); }
  };
  await context.route('**/*', async (route) => {
    const req = route.request();
    const c = classifyRequest(req.method(), req.url(), apiOrigin);
    if (c.verdict === 'forbid') { forbidden.push(c.kind); return route.abort('blockedbyclient'); }
    // After the cutoff a NEW telemetry call is aborted before it is sent (no server effect); it was already recorded
    // as a non-PASS 'failed' record by the 'request' handler below.
    if (frozen && c.verdict === 'telemetry') return route.abort('blockedbyclient');
    return route.fallback();
  });
  context.on('request', (req) => {
    const c = classifyRequest(req.method(), req.url(), apiOrigin);
    if (c.verdict !== 'telemetry') return;
    let actor = 'unknown';
    try { actor = (opts.actorOf ?? (() => 'unknown'))(String(JSON.parse(req.postData() ?? '{}').p_user_id ?? '')); } catch { actor = 'unknown'; }
    const t = { rpc: c.kind.slice('telemetry:'.length), actor };
    if (frozen) {
      // Observation boundary: a NEW start after the cutoff is never silent. It is counted (callers fail on it) AND
      // written once as 'failed', so the run-wide witness is non-PASS (INCOMPLETE, or FAIL for an unknown actor) even
      // when no row was written. Its later completion events are ignored.
      late.starts += 1;
      postCutoff.add(req);
      tracked.set(req, t);
      settle(req, 'failed');
      return;
    }
    tracked.set(req, t);
  });
  context.on('requestfinished', async (req) => {
    if (postCutoff.has(req)) return;
    if (!tracked.has(req)) { if (frozen) late.completions += 1; return; }
    let status = 'failed';
    try { const res = await req.response(); if (res && res.status() >= 200 && res.status() < 300) status = 'success'; } catch { status = 'failed'; }
    if (frozen) { late.completions += 1; return; } // already emitted as 'pending' at the deadline
    settle(req, status);
  });
  context.on('requestfailed', (req) => {
    if (postCutoff.has(req)) return;
    if (!tracked.has(req)) { if (frozen) late.completions += 1; return; }
    if (frozen) { late.completions += 1; return; }
    settle(req, 'failed');
  });
  /** Bounded finalization; idempotent (a second call returns the first result). */
  const finalize = (ms = 5_000) => (finalized ??= (async () => {
    const until = Date.now() + ms;
    while (tracked.size && Date.now() < until) await new Promise((r) => setTimeout(r, 25));
    for (const req of [...tracked.keys()]) settle(req, 'pending');
    frozen = true;
    if (sinkErrors.length) throw new Error(sinkErrors[0]);
  })());
  /** For callers AFTER finalize: throws a fixed code if any NEW telemetry started after the cutoff or a sink write failed. */
  const assertClosed = () => {
    if (late.starts) throw new Error(`RR_POLICY_E_LATE_START count=${late.starts}`);
    if (sinkErrors.length) throw new Error(sinkErrors[0]);
  };
  return { forbidden, telemetry, late, finalize, assertClosed };
}
