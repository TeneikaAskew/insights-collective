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
    if (total && /^\d+$/.test(total)) return Number(total);
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

/** Records allowlisted API responses of one page (reductions only), with a bounded settle like the grant recorder. */
export function createCaseRecorder(page) {
  const pending = new Set();
  const byPath = new Map();
  const onResponse = (r) => {
    const p = apiPathOf(r.url());
    if (!p) return;
    const method = r.request().method();
    if (method === 'OPTIONS') return;
    const job = (async () => {
      let json = null;
      try { json = await r.json(); } catch { json = null; }
      let cr = null;
      try { cr = (await r.allHeaders())['content-range'] ?? null; } catch { cr = null; }
      const list = byPath.get(p) ?? [];
      list.push(reduceResponse(method, r.status(), cr, json));
      byPath.set(p, list.slice(-MAX_PER_PATH));
    })();
    pending.add(job);
    job.finally(() => pending.delete(job));
  };
  page.on('response', onResponse);
  return {
    async settle(timeoutMs = 3000) {
      let timer;
      const all = Promise.allSettled([...pending]).then(() => true);
      const ok = await Promise.race([all, new Promise((res) => { timer = setTimeout(() => res(false), timeoutMs); })]);
      clearTimeout(timer);
      return { byPath: new Map(byPath), settled: ok === true && pending.size === 0 };
    },
    detach() { page.off('response', onResponse); },
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

/** Bounded capture for a failed case. Writes <out>/case-diagnostics/<slug>.txt (0600). No screenshot, no DOM text. */
export async function captureCaseFailure(page, { out, title, recorder }) {
  const r = await recorder.settle();
  let probe = { present: [], shown: [] };
  let probeOk = true;
  try { probe = await probePage(page); } catch { probeOk = false; }
  const line = `${caseLine({ test: title, route: routeShape(page.url()), present: probe.present, shown: probe.shown, byPath: r.byPath, settled: r.settled })} page_probe=${probeOk ? 'ok' : 'failed'}`;
  const dir = path.join(out, 'case-diagnostics');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, `${slug(title)}.txt`), `${line}\n`, { mode: 0o600 });
  return line;
}
