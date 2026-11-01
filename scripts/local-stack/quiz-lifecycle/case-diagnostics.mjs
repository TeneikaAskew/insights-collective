// ABOUTME: Safe, allowlisted diagnostics for a quiz-lifecycle CASE that fails after sign-in: which fixed player state and
// ABOUTME: which fixed heading were on screen, the route shape, and status/code/row-count of allowlisted API reads. Never values.
//
// Why (run 41359219343): all 7 cases failed after sign-in at the first positive selector and the run kept no evidence
// of WHERE the page was. The login capture (login-diagnostics.mjs) covers /login only, by design.
//
// Recorded per failed case, as ONE fixed-format line in <out>/case-diagnostics/<slug>.txt:
//   - the route TEMPLATE (/courses/:c/learn/:m/:i, or "other") and per-segment booleans: is it a synthetic fixture id
//   - which entries of a fixed test-id allowlist are present (quiz player states, error state)
//   - which entries of a fixed heading allowlist are visible (e.g. "Course not found")
//   - for an allowlist of API paths: method, HTTP status, an allowlisted PostgREST/Postgres error code and the ROW COUNT
// Never recorded: bodies, ids, query strings, headers, tokens, cookies, DOM text, screenshots, traces.
import fs from 'node:fs';
import path from 'node:path';
import { slug } from './login-diagnostics.mjs';

/** API reads that decide whether the player can mount. Path only (origin and query are ignored). */
export const API_PATH_ALLOWLIST = Object.freeze([
  '/rest/v1/courses',
  '/rest/v1/modules',
  '/rest/v1/content_items',
  '/rest/v1/quizzes',
  '/rest/v1/enrollments',
  '/rest/v1/rpc/get_quiz_questions_for_taking',
  '/rest/v1/rpc/start_quiz_attempt',
]);
/** Error codes that may be named; anything else is "other". */
export const ERROR_CODE_ALLOWLIST = Object.freeze(['PGRST116', 'PGRST301', 'PGRST302', '42501', '42P01', '42703', '22P02', 'P0001']);
export const TESTID_ALLOWLIST = Object.freeze([
  'quiz-player-loading', 'quiz-player-empty', 'quiz-player-active', 'quiz-player-review', 'quiz-player-exhausted',
]);
/** Exact static headings the learn page or player can show instead of the quiz. */
export const HEADING_ALLOWLIST = Object.freeze([
  'Course not found',
  "Couldn't load this quiz",
  "Couldn't restore your saved answers",
  "Couldn't confirm whether your quiz was submitted",
  'Failed to load course',
]);
const MAX_PER_PATH = 4;
const FIXTURE_ID = /^9c00[0-9a-f]{4}-0000-4000-8000-[0-9a-f]{12}$/;

/** Route template plus per-segment fixture-id booleans; nothing else of the URL is kept. */
export function routeShape(url) {
  let p;
  try { p = new URL(url).pathname; } catch { return { template: 'unparsable', ids: [] }; }
  const m = p.match(/^\/courses\/([^/]+)\/learn(?:\/([^/]+)\/([^/]+))?\/?$/);
  if (!m) return { template: p === '/login' ? '/login' : 'other', ids: [] };
  const segs = m.slice(1).filter((x) => x !== undefined);
  return { template: segs.length === 3 ? '/courses/:c/learn/:m/:i' : '/courses/:c/learn', ids: segs.map((s) => FIXTURE_ID.test(s)) };
}

export function apiPathOf(url) {
  try {
    const p = new URL(url).pathname;
    return API_PATH_ALLOWLIST.includes(p) ? p : null;
  } catch { return null; }
}

export function classifyCode(json) {
  const c = json && typeof json === 'object' && !Array.isArray(json) ? json.code : undefined;
  if (typeof c !== 'string') return 'none';
  return ERROR_CODE_ALLOWLIST.includes(c) ? c : 'other';
}

/** Row count from Content-Range ("0-0/1", "*\/0") or from an array body; the body itself is dropped. */
export function rowCount(contentRange, json) {
  if (typeof contentRange === 'string') {
    const total = contentRange.split('/')[1];
    // Only a finite, safe, non-negative integer is a count; "400 digits" (Infinity) or 2^53+ is the fixed unknown.
    if (total && /^\d{1,16}$/.test(total)) {
      const n = Number(total);
      if (Number.isSafeInteger(n) && n >= 0) return n;
    }
    if (total && /^\d+$/.test(total)) return 'n/a';
  }
  if (Array.isArray(json)) return json.length;
  if (json && typeof json === 'object' && !('code' in json)) return 1; // .single() object
  return 'n/a';
}

/** Reduce one response to fixed fields. */
export function reduceResponse(method, status, contentRange, json) {
  return {
    method: String(method).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 7) || 'OTHER',
    status: Number.isInteger(status) ? status : 'none',
    code: status >= 200 && status < 300 ? 'none' : classifyCode(json),
    rows: status >= 200 && status < 300 ? rowCount(contentRange, json) : 'n/a',
  };
}

/**
 * Records allowlisted API responses of one page (reductions only).
 *
 * Capture boundary (safety review 23:34Z): freeze() awaits pending reductions (bounded), then CLOSES intake and detaches
 * the listeners. Anything that completes after that point is dropped, never added to evidence already returned. The
 * snapshot is a deep copy, ordered by REQUEST order (a sequence number taken when the request was issued, not when its
 * body finished parsing), and frozen. freeze() is idempotent: later calls return the same snapshot.
 */
export function createCaseRecorder(page) {
  const pending = new Set();
  /** seq -> { path, reduced } */
  const slots = new Map();
  const seqOf = new WeakMap();
  let nextSeq = 0;
  let closed = false;
  let attached = true;
  let snapshot = null;
  let late = 0;
  /** Allowlisted requests issued but not yet answered: an outstanding read at the boundary is NOT settled. */
  const inflight = new Set();
  const onRequest = (req) => {
    if (closed) return;
    if (!apiPathOf(req.url()) || req.method() === 'OPTIONS') return;
    seqOf.set(req, nextSeq++);
    inflight.add(req);
  };
  const onRequestFailed = (req) => {
    if (closed || !inflight.has(req)) return;
    inflight.delete(req);
    slots.set(seqOf.get(req), { path: apiPathOf(req.url()), reduced: { ...reduceResponse(req.method(), NaN, null, null), status: 'none' } }); // failed transport: no status
  };
  const onResponse = (r) => {
    if (closed) { late += 1; return; }
    const p = apiPathOf(r.url());
    if (!p) return;
    const req = r.request();
    const method = req.method();
    if (method === 'OPTIONS') return;
    inflight.delete(req);
    // A response whose request predates the recorder still gets an order, after every request seen so far.
    const seq = seqOf.has(req) ? seqOf.get(req) : nextSeq++;
    const job = (async () => {
      let json = null;
      try { json = await r.json(); } catch { json = null; }
      let cr = null;
      try { cr = (await r.allHeaders())['content-range'] ?? null; } catch { cr = null; }
      if (closed) { late += 1; return; } // completed after the capture boundary: dropped
      slots.set(seq, { path: p, reduced: reduceResponse(method, r.status(), cr, json) });
    })();
    pending.add(job);
    job.finally(() => pending.delete(job));
  };
  const detach = () => {
    if (!attached) return;
    attached = false;
    page.off('request', onRequest);
    page.off('response', onResponse);
    page.off('requestfailed', onRequestFailed);
  };
  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('requestfailed', onRequestFailed);
  return {
    async freeze(timeoutMs = 3000) {
      if (snapshot) return snapshot;
      let timer;
      const all = Promise.allSettled([...pending]).then(() => true);
      const ok = await Promise.race([all, new Promise((res) => { timer = setTimeout(() => res(false), timeoutMs); })]);
      clearTimeout(timer);
      const incomplete = pending.size + inflight.size;
      closed = true; // capture boundary: no reduction is accepted after this line
      detach();
      const byPath = new Map();
      for (const seq of [...slots.keys()].sort((a, b) => a - b)) {
        const { path: p, reduced } = slots.get(seq);
        const list = byPath.get(p) ?? [];
        list.push(Object.freeze({ ...reduced }));
        byPath.set(p, list);
      }
      for (const [p, list] of byPath) byPath.set(p, Object.freeze(list.slice(-MAX_PER_PATH)));
      snapshot = Object.freeze({ byPath, settled: ok === true && incomplete === 0, incomplete });
      inflight.clear();
      return snapshot;
    },
    /** Reductions dropped because they finished after the boundary (for controls; never written). */
    lateDropped() { return late; },
    detach,
  };
}

/** In the page: which allowlisted test ids exist and which allowlisted headings are visible. Indices only leave the page. */
export async function probePage(page) {
  return page.evaluate(({ ids, heads }) => {
    const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const present = ids.map((id, i) => (document.querySelector(`[data-testid="${id}"]`) ? i : -1)).filter((i) => i >= 0);
    const texts = new Set([...document.querySelectorAll('h1,h2,h3,[role="heading"],[data-slot="card-title"],.font-semibold')]
      .filter(visible).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()));
    const shown = heads.map((h, i) => (texts.has(h) ? i : -1)).filter((i) => i >= 0);
    return { present, shown };
  }, { ids: [...TESTID_ALLOWLIST], heads: [...HEADING_ALLOWLIST] });
}

const headingToken = (h) => slug(h);

/** One fixed-format line; only allowlisted tokens, integers and booleans reach it. */
export function caseLine({ test, route, present, shown, byPath, settled }) {
  const ids = route.ids.length ? route.ids.map((b) => (b ? 'fixture' : 'other')).join(',') : 'none';
  const states = present.length ? present.map((i) => TESTID_ALLOWLIST[i]).join(',') : 'none';
  const heads = shown.length ? shown.map((i) => headingToken(HEADING_ALLOWLIST[i])).join(',') : 'none';
  const api = API_PATH_ALLOWLIST.map((p) => {
    const list = byPath.get(p);
    const name = p.replace('/rest/v1/', '').replace('rpc/', 'rpc.');
    if (!list || list.length === 0) return `${name}=unseen`;
    return `${name}=${list.map((r) => `${r.method}:${r.status}:${r.code}:${r.rows}`).join('|')}`;
  }).join(' ');
  return ['case-failure', `test=${slug(test)}`, `route=${route.template}`, `ids=${ids}`, `states=${states}`,
    `headings=${heads}`, api, `api_settled=${settled ? 'true' : 'false'}`].join(' ');
}

/** Fixed stage names for the diagnostic-failed marker. */
export const CAPTURE_STAGES = Object.freeze(['freeze', 'line', 'write']);
/** The fixed marker written (or, if the file cannot be written, printed) when capture itself fails. */
export function diagnosticFailedLine(title, stage) {
  const st = CAPTURE_STAGES.includes(stage) ? stage : 'other';
  return `case-failure test=${slug(String(title))} diagnostic=failed stage=${st}`;
}

/**
 * Bounded capture for a failed case. Writes <out>/case-diagnostics/<slug>.txt (0600). No screenshot, no DOM text.
 * Never throws and never fails silently: any failure inside capture yields the fixed diagnostic-failed marker, written to
 * the same file, or printed to stderr when the file itself cannot be written. Returns the line that was produced.
 */
export async function captureCaseFailure(page, { out, title, recorder }) {
  let stage = 'freeze';
  let line;
  try {
    const r = await recorder.freeze();
    stage = 'line';
    let probe = { present: [], shown: [] };
    let probeOk = true;
    try { probe = await probePage(page); } catch { probeOk = false; }
    line = `${caseLine({ test: title, route: routeShape(page.url()), present: probe.present, shown: probe.shown, byPath: r.byPath, settled: r.settled })} page_probe=${probeOk ? 'ok' : 'failed'}`;
  } catch {
    line = diagnosticFailedLine(title, stage);
  }
  try {
    const dir = path.join(out, 'case-diagnostics');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(dir, `${slug(String(title))}.txt`), `${line}\n`, { mode: 0o600 });
  } catch {
    line = diagnosticFailedLine(title, 'write');
    try { process.stderr.write(`${line}\n`); } catch { /* nothing else is safe to do */ }
  }
  return line;
}
