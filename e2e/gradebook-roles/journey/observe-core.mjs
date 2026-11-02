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

/** Records every request the target STARTS from now on ('request' event), then its terminal state.
 *  opts.storageReadMs: the fixed deadline for the DIAGNOSTIC Storage error-body read (default STORAGE_READ_MS). */
export function createRecorder(target, opts = {}) {
  const readMs = Number.isInteger(opts.storageReadMs) && opts.storageReadMs > 0 ? opts.storageReadMs : STORAGE_READ_MS;
  let stopped = false;
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
    let r = null;
    try { r = await req.response(); c.status = r ? r.status() : null; } catch { c.status = null; }
    // DIAGNOSTIC ONLY: a Storage error response is reduced to fixed categories before the call is terminal; the body text
    // is a local value that is never stored, returned or logged. The read is raced against a fixed deadline, so a body that
    // never arrives gives TIMEOUT (a rejected read gives UNREADABLE) and the call still becomes terminal with its HTTP
    // status. The category is assigned once: a read that completes after the deadline, or after stop(), changes nothing.
    if (r && isStorageError(c)) {
      let timer;
      const deadline = new Promise((res) => { timer = setTimeout(() => res(STORAGE_TIMEOUT), readMs); });
      const read = Promise.resolve().then(() => r.text()).then((t) => storageCategory(t), () => STORAGE_UNREADABLE);
      const cat = await Promise.race([read, deadline]);
      clearTimeout(timer);
      if (stopped) return;           // the recorder was stopped while the diagnostic read was pending: leave the call as is
      c.storage = cat;
    }
    c.done = true;
  };
  const onFail = (req) => { const c = byReq.get(req); if (c) { c.failed = true; c.done = true; } };
  target.on('request', onReq); target.on('requestfinished', onFin); target.on('requestfailed', onFail);
  return {
    calls,
    stop() { stopped = true; target.off('request', onReq); target.off('requestfinished', onFin); target.off('requestfailed', onFail); },
  };
}

/** Storage error-body fields, reduced to FIXED names (storage-api legacy `error` strings and newer `code` names). */
const STORAGE_ERR = new Map([
  ['Unauthorized', 'UNAUTHORIZED'], ['AccessDenied', 'ACCESS_DENIED'], ['Bucket not found', 'BUCKET_NOT_FOUND'], ['NoSuchBucket', 'BUCKET_NOT_FOUND'],
  ['not_found', 'NOT_FOUND'], ['NoSuchKey', 'NOT_FOUND'], ['Duplicate', 'DUPLICATE'], ['KeyAlreadyExists', 'DUPLICATE'], ['ResourceAlreadyExists', 'DUPLICATE'],
  ['invalid_mime_type', 'MIME_TYPE'], ['InvalidMimeType', 'MIME_TYPE'], ['Payload too large', 'TOO_LARGE'], ['EntityTooLarge', 'TOO_LARGE'],
  ['InvalidKey', 'INVALID_KEY'], ['Invalid key', 'INVALID_KEY'], ['InvalidJWT', 'INVALID_JWT'], ['invalid_jwt', 'INVALID_JWT'],
  ['InvalidRequest', 'INVALID_REQUEST'], ['DatabaseError', 'DATABASE_ERROR'], ['InternalError', 'INTERNAL'], ['Error', 'GENERIC_ERROR'],
]);
/** Exact known message strings only (whole-string equality); anything else is OTHER. The message itself never leaves. */
const STORAGE_MSG = new Map([
  ['new row violates row-level security policy', 'RLS'], ['jwt expired', 'JWT_EXPIRED'], ['invalid signature', 'JWT_SIGNATURE'],
  ['jwt malformed', 'JWT_MALFORMED'], ['Bucket not found', 'BUCKET_NOT_FOUND'], ['The resource already exists', 'DUPLICATE'],
  ['Invalid key', 'INVALID_KEY'], ['mime type not supported', 'MIME_TYPE'],
]);
const FIELD_STATES = ['ABSENT', 'OTHER', 'NA'];
export const STORAGE_ERR_NAMES = Object.freeze([...new Set([...STORAGE_ERR.values(), ...FIELD_STATES, 'UNPARSEABLE', 'SHAPE', 'OVERSIZE', 'UNREADABLE', 'TIMEOUT'])]);
export const STORAGE_MSG_NAMES = Object.freeze([...new Set([...STORAGE_MSG.values(), ...FIELD_STATES])]);
/** Parse bound, checked AFTER the full body text has been read: its UTF-8 byte length. It limits what is parsed, not what
 *  is read from the network (the read itself is bounded only in time, by STORAGE_READ_MS). */
const STORAGE_MAX_BODY_BYTES = 4096;
export const STORAGE_READ_MS = 2000;
const STORAGE_TIMEOUT = Object.freeze({ err: 'TIMEOUT', code: 'NA', msg: 'NA', status: 'NA' });
const STORAGE_UNREADABLE = Object.freeze({ err: 'UNREADABLE', code: 'NA', msg: 'NA', status: 'NA' });
const isStorageError = (c) => c.url.pathname.startsWith('/storage/v1/') && Number.isInteger(c.status) && c.status >= 400;
/**
 * Fixed categories from a Storage error body: err (`error`), code (`code`), msg (`message`, exact known strings only) and
 * the body's own `statusCode` when it is exactly three digits. Own keys only; non-string values are OTHER. A text over
 * 4096 UTF-8 bytes is OVERSIZE and is not parsed. Pure.
 * @param {unknown} text @returns {{ err: string, code: string, msg: string, status: string }}
 */
export function storageCategory(text) {
  if (typeof text !== 'string') return STORAGE_UNREADABLE;
  if (new TextEncoder().encode(text).length > STORAGE_MAX_BODY_BYTES) return { err: 'OVERSIZE', code: 'NA', msg: 'NA', status: 'NA' };
  let b;
  try { b = JSON.parse(text); } catch { return { err: 'UNPARSEABLE', code: 'NA', msg: 'NA', status: 'NA' }; }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { err: 'SHAPE', code: 'NA', msg: 'NA', status: 'NA' };
  const own = (k) => (Object.prototype.hasOwnProperty.call(b, k) ? b[k] : undefined);
  const pick = (k, map) => { const v = own(k); return v === undefined ? 'ABSENT' : typeof v === 'string' && map.has(v) ? map.get(v) : 'OTHER'; };
  const sc = own('statusCode');
  const status = (typeof sc === 'string' || typeof sc === 'number') && /^[1-5][0-9]{2}$/.test(String(sc)) ? String(sc) : 'NA';
  return { err: pick('error', STORAGE_ERR), code: pick('code', STORAGE_ERR), msg: pick('message', STORAGE_MSG), status };
}

/** True once every expectation has at least its count of exact matches and all of them are terminal. */
export function settled(calls, want, origin) {
  return want.every((w) => {
    const ex = calls.filter((c) => isCandidate(c, w.spec, origin) && queryExact(c, w.spec));
    return ex.length >= (w.count ?? 1) && ex.every((c) => c.done);
  });
}

/**
 * Verdict for one action. Codes: OBS_NEAR_MISS (same origin+method+path, other query, and not an exact match of another
 * expectation in the same set), OBS_COUNT (started count differs),
 * OBS_PENDING (never reached a terminal event), OBS_FAILED (requestfailed), OBS_STATUS (terminal status not allowed),
 * OBS_ORDER (with ordered: the first exact start of each expectation is not in the declared order). DIAGNOSTIC: an
 * OBS_STATUS on a Storage call is followed by OBS_STORAGE <err> <code> <msg> <bodyStatus> (fixed names, storageCategory).
 * @param {Call[]} calls @param {Expect[]} want @param {{ origin: string, ordered?: boolean }} opts
 */
export function evaluate(calls, want, opts) {
  const failures = [];
  // A call that exactly matches ANOTHER expectation declared in the same set is that expectation's call (counted, status-
  // checked and pending-checked there), not a near miss of this one. Any other same-origin/method/path call still is.
  const declaredElsewhere = (c, self) => want.some((o) => o !== self && isCandidate(c, o.spec, opts.origin) && queryExact(c, o.spec));
  const matched = want.map((w) => {
    const label = `${w.spec.method} ${w.spec.path}`;
    const cands = calls.filter((c) => isCandidate(c, w.spec, opts.origin));
    const exact = cands.filter((c) => queryExact(c, w.spec));
    if (cands.some((c) => !queryExact(c, w.spec) && !declaredElsewhere(c, w))) failures.push(`OBS_NEAR_MISS ${label}`);
    if (exact.length !== (w.count ?? 1)) failures.push(`OBS_COUNT ${label} ${exact.length}`);
    for (const c of exact) {
      if (!c.done) failures.push(`OBS_PENDING ${label}`);
      else if (c.failed) failures.push(`OBS_FAILED ${label}`);
      else if (w.status && !w.status.includes(c.status)) {
        failures.push(`OBS_STATUS ${label} ${c.status}`);
        if (c.storage) failures.push(`OBS_STORAGE ${c.storage.err} ${c.storage.code} ${c.storage.msg} ${c.storage.status}`);
      }
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
