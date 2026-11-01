// ABOUTME: Pure request-observation core for the journey lane (UNRUN proposal): records request STARTS and terminal state from
// ABOUTME: any page/context-like emitter and returns fixed failure codes. No Playwright import, so fakes can drive it locally.
//
// Exercised only by fake emitters in scripts/gradebook-fixture/journey/tests/journey-selftest.mjs. Those are helper checks,
// not journey executions.

/** Query keys that carry no target/filter meaning and may appear without being named in a spec. */
export const PASSTHROUGH = new Set(['select', 'columns', 'order', 'limit', 'offset']);

/** @typedef {{ method: string, path: string, query?: Record<string,string> }} CallSpec */
/** @typedef {{ spec: CallSpec, count?: number, status?: number[] }} Expect */
/** @typedef {{ req: any, url: URL, method: string, seq: number, status: number|null, failed: boolean, done: boolean }} Call */

const matchesPath = (u, spec) => (spec.path.endsWith('/') ? u.pathname.startsWith(spec.path) : u.pathname === spec.path);
/** Same origin, method and path: a candidate. Exact query is checked separately so near-misses are counted, not hidden. */
export const isCandidate = (c, spec, origin) => c.url.origin === origin && c.method === spec.method && matchesPath(c.url, spec);
/** Own-key membership only: an inherited name (toString, constructor, __proto__) is never a named query key. */
const ownKey = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export function queryExact(c, spec) {
  const want = spec.query ?? {};
  for (const [k, v] of Object.entries(want)) if (c.url.searchParams.getAll(k).length !== 1 || c.url.searchParams.get(k) !== v) return false;
  for (const k of new Set(c.url.searchParams.keys())) if (!ownKey(want, k) && !PASSTHROUGH.has(k)) return false;
  return true;
}

/** Records every request the target STARTS from now on ('request' event), then its terminal state. */
export function createRecorder(target) {
  /** @type {Call[]} */
  const calls = [];
  const byReq = new Map();
  let seq = 0;
  const onReq = (req) => {
    let url;
    try { url = new URL(req.url()); } catch { return; }
    const c = { req, url, method: req.method(), seq: seq++, status: null, failed: false, done: false };
    calls.push(c); byReq.set(req, c);
  };
  const onFin = async (req) => {
    const c = byReq.get(req); if (!c) return;
    try { const r = await req.response(); c.status = r ? r.status() : null; } catch { c.status = null; }
    c.done = true;
  };
  const onFail = (req) => { const c = byReq.get(req); if (c) { c.failed = true; c.done = true; } };
  target.on('request', onReq); target.on('requestfinished', onFin); target.on('requestfailed', onFail);
  return {
    calls,
    stop() { target.off('request', onReq); target.off('requestfinished', onFin); target.off('requestfailed', onFail); },
  };
}

/** True once every expectation has at least its count of exact matches and all of them are terminal. */
export function settled(calls, want, origin) {
  return want.every((w) => {
    const ex = calls.filter((c) => isCandidate(c, w.spec, origin) && queryExact(c, w.spec));
    return ex.length >= (w.count ?? 1) && ex.every((c) => c.done);
  });
}

/**
 * Verdict for one action. Codes: OBS_NEAR_MISS (same origin+method+path, other query), OBS_COUNT (started count differs),
 * OBS_PENDING (never reached a terminal event), OBS_FAILED (requestfailed), OBS_STATUS (terminal status not allowed),
 * OBS_ORDER (with ordered: the first exact start of each expectation is not in the declared order).
 * @param {Call[]} calls @param {Expect[]} want @param {{ origin: string, ordered?: boolean }} opts
 */
export function evaluate(calls, want, opts) {
  const failures = [];
  const matched = want.map((w) => {
    const label = `${w.spec.method} ${w.spec.path}`;
    const cands = calls.filter((c) => isCandidate(c, w.spec, opts.origin));
    const exact = cands.filter((c) => queryExact(c, w.spec));
    if (cands.length !== exact.length) failures.push(`OBS_NEAR_MISS ${label}`);
    if (exact.length !== (w.count ?? 1)) failures.push(`OBS_COUNT ${label} ${exact.length}`);
    for (const c of exact) {
      if (!c.done) failures.push(`OBS_PENDING ${label}`);
      else if (c.failed) failures.push(`OBS_FAILED ${label}`);
      else if (w.status && !w.status.includes(c.status)) failures.push(`OBS_STATUS ${label} ${c.status}`);
    }
    return exact;
  });
  if (opts.ordered) {
    const firsts = matched.map((m) => (m.length ? m[0].seq : -1));
    for (let i = 1; i < firsts.length; i++) if (firsts[i - 1] >= 0 && firsts[i] >= 0 && firsts[i] < firsts[i - 1]) failures.push(`OBS_ORDER ${i}`);
  }
  return { failures, matched };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/**
 * Validates captured run identity BEFORE it is persisted (and again on load). Never stringifies an absent value.
 * @returns {string[]} failure codes
 */
export function runStateFailures(s, prefix) {
  const f = [];
  if (!s || typeof s !== 'object') return ['RS_SHAPE'];
  const isStr = (v) => typeof v === 'string';
  if (!isStr(s.submissionId) || !UUID.test(s.submissionId)) f.push('RS_SUBMISSION_ID');
  if (!isStr(s.attachmentId) || !UUID.test(s.attachmentId)) f.push('RS_ATTACHMENT_ID');
  if (!isStr(s.attachmentKey) || !s.attachmentKey.startsWith(prefix) || !/^\d+-[a-z0-9]+\.pdf$/.test(s.attachmentKey.slice(prefix.length))) f.push('RS_ATTACHMENT_KEY');
  const c = s.certificate;
  if (!c || typeof c !== 'object') f.push('RS_CERTIFICATE');
  else {
    if (!isStr(c.id) || !UUID.test(c.id)) f.push('RS_CERTIFICATE_ID');
    if (!isStr(c.code) || !/^[0-9A-F]{12}$/.test(c.code)) f.push('RS_CERTIFICATE_CODE');
    if (!isStr(c.issuedAt) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(c.issuedAt) || !Number.isFinite(Date.parse(c.issuedAt))) f.push('RS_CERTIFICATE_ISSUED_AT');
  }
  if (s.submissionId && s.submissionId === s.attachmentId) f.push('RS_IDS_NOT_DISTINCT');
  if (Object.keys(s).sort().join(',') !== 'attachmentId,attachmentKey,certificate,submissionId') f.push('RS_KEYS');
  return f;
}
