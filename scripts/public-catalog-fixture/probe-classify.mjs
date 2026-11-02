// ABOUTME: Pure classifier for the anonymous RLS probe. It turns one PostgREST response (status, content type, body text)
// ABOUTME: into a fixed verdict, so only a recognized denial or an intended empty result can count as "refused".
//
// Verdicts:
//   DENIED      recognized authorization denial: 401 or 403 with a JSON body whose code is exactly 42501.
//   EMPTY       intended successful no-op for PATCH/DELETE: status EXACTLY 200 with a JSON array of length 0
//               (Prefer: return=representation). 201/202/206 [] and a 204 that carries a body are UNVERIFIED.
//   ACCEPTED    a write that returned rows: 2xx with a non-empty JSON array. The test FAILS.
//   UNVERIFIED  anything else: other 4xx/5xx, a 42501 under an unexpected status, malformed or non-JSON bodies, 204 (ambiguous:
//               return=representation was asked for, so a bare 204 says nothing about how many rows changed), redirects.
// Only DENIED (any write) and EMPTY (PATCH/DELETE only) pass. An unchanged witness afterwards is supporting evidence only; it
// does not show that RLS, rather than some other failure, stopped the write.
// Nothing here returns or records a response body: only the verdict, the status, a recognized code and a row count.

export const V = { DENIED: 'DENIED', EMPTY: 'EMPTY', ACCEPTED: 'ACCEPTED', UNVERIFIED: 'UNVERIFIED' };
const RECOGNIZED_CODES = new Set(['42501']);

function parse(contentType, text) {
  if (!/^application\/(vnd\.pgrst\.[a-z.+]*|json)\b/i.test(contentType || '')) return { ok: false };
  try { return { ok: true, json: JSON.parse(text) }; } catch { return { ok: false }; }
}

/** Classify a write response. method is POST, PATCH or DELETE. */
export function classifyWrite(method, { status, contentType, text }) {
  const p = parse(contentType, text);
  const out = (verdict, extra = {}) => ({ verdict, status, ...extra });
  if (!p.ok) return out(V.UNVERIFIED, { why: status === 204 ? 'ambiguous-204' : 'not-json' });
  const j = p.json;
  if (status >= 200 && status < 300) {
    if (!Array.isArray(j)) return out(V.UNVERIFIED, { why: '2xx-not-array' });
    if (j.length > 0) return out(V.ACCEPTED, { rows: j.length });
    if (method === 'POST') return out(V.UNVERIFIED, { why: 'insert-2xx-empty' });
    return status === 200 ? out(V.EMPTY, { rows: 0 }) : out(V.UNVERIFIED, { why: 'empty-not-200' });
  }
  const code = j && typeof j === 'object' && !Array.isArray(j) && typeof j.code === 'string' ? j.code : null;
  if ((status === 401 || status === 403) && RECOGNIZED_CODES.has(code)) return out(V.DENIED, { code });
  return out(V.UNVERIFIED, { why: 'unrecognized-error', code: RECOGNIZED_CODES.has(code) ? code : null });
}

/** Classify a read response: 200 with a JSON array of objects carrying string ids, else UNVERIFIED. */
export function classifyRead({ status, contentType, text }) {
  const p = parse(contentType, text);
  if (status !== 200 || !p.ok || !Array.isArray(p.json) || !p.json.every((r) => r && typeof r.id === 'string')) {
    return { verdict: V.UNVERIFIED, status, ids: [] };
  }
  return { verdict: 'READ', status, ids: p.json.map((r) => r.id) };
}

/** A write probe passes only on the outcomes it allows. */
export const writePasses = (method, verdict) => verdict === V.DENIED || (verdict === V.EMPTY && method !== 'POST');

/** The OLD (e4c2f1d/405850e) rule, kept ONLY for the causal control: anything but a 2xx non-empty array was "PASS". */
export const oldWritePasses = ({ status, rows }) => !(status < 300 && Array.isArray(rows) && rows.length > 0);
