// ABOUTME: Request-level observation for the journey lane (UNRUN proposal). The journey never SENDS a write itself: it records
// ABOUTME: every request the app STARTS, matches exact origin/path/query, and requires an exact count with a terminal status.
import { createHash } from 'node:crypto';
import { expect, type BrowserContext, type Page, type Request, type TestInfo } from '@playwright/test';
import { BINDING } from '../fixture';
import { J } from './ids';
import { readPrivateJson, writePrivateFile } from './private-dir.mjs';

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD';
/** Query keys that carry no target/filter meaning and may appear without being named in a spec. */
const PASSTHROUGH = new Set(['select', 'columns', 'order', 'limit', 'offset']);

export type CallSpec = {
  method: Method;
  /** Exact pathname on the approved API origin, or a pathname PREFIX when it ends with '/'. */
  path: string;
  /** Exact values for these keys; any other non-passthrough key on the request makes it NOT match (and is reported). */
  query?: Record<string, string>;
};
export type Call = { req: Request; url: URL; status: number | null; failed: boolean; done: boolean };

const matchesPath = (u: URL, spec: CallSpec) => (spec.path.endsWith('/') ? u.pathname.startsWith(spec.path) : u.pathname === spec.path);
/** Same origin, method and path: a candidate. Exact query is checked separately so near-misses are counted, not hidden. */
const candidate = (c: Call, spec: CallSpec) => c.url.origin === BINDING.api.origin && c.req.method() === spec.method && matchesPath(c.url, spec);
const queryExact = (c: Call, spec: CallSpec) => {
  const want = spec.query ?? {};
  for (const [k, v] of Object.entries(want)) if (c.url.searchParams.getAll(k).length !== 1 || c.url.searchParams.get(k) !== v) return false;
  for (const k of new Set(c.url.searchParams.keys())) if (!(k in want) && !PASSTHROUGH.has(k)) return false;
  return true;
};

/** Records every request the page/context starts from now on, with its terminal state. */
export function recordCalls(target: Page | BrowserContext) {
  const calls: Call[] = [];
  const byReq = new Map<Request, Call>();
  const onReq = (req: Request) => { let url: URL; try { url = new URL(req.url()); } catch { return; } const c = { req, url, status: null, failed: false, done: false }; calls.push(c); byReq.set(req, c); };
  const onFin = async (req: Request) => { const c = byReq.get(req); if (!c) return; try { c.status = (await req.response())?.status() ?? null; } catch { c.status = null; } c.done = true; };
  const onFail = (req: Request) => { const c = byReq.get(req); if (c) { c.failed = true; c.done = true; } };
  target.on('request', onReq); target.on('requestfinished', onFin); target.on('requestfailed', onFail);
  return {
    calls,
    stop() { target.off('request', onReq); target.off('requestfinished', onFin); target.off('requestfailed', onFail); },
    candidates: (spec: CallSpec) => calls.filter((c) => candidate(c, spec)),
  };
}
export type Recorder = ReturnType<typeof recordCalls>;

export type Expect = { spec: CallSpec; count?: number; status?: number[] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a UI action and require, for EACH expectation, EXACTLY `count` app requests STARTED that match the spec (exact
 * origin, method, path and query), each terminal (finished, not failed) with an allowed status, and no near-miss (same
 * origin, method and path with a different query) during the action. Settles before counting, so a late duplicate fails.
 * The target may be a BrowserContext so requests from popups count too.
 */
export async function expectCallSet(target: Page | BrowserContext, want: Expect[], action: () => Promise<unknown>, opts: { settleMs?: number; timeoutMs?: number } = {}): Promise<Call[][]> {
  const rec = recordCalls(target);
  try {
    await action();
    const deadline = Date.now() + (opts.timeoutMs ?? 30_000);
    const ready = () => want.every((w) => { const ex = rec.candidates(w.spec).filter((c) => queryExact(c, w.spec)); return ex.length >= (w.count ?? 1) && ex.every((c) => c.done); });
    while (Date.now() < deadline && !ready()) await sleep(100);
    await sleep(opts.settleMs ?? 1_500);
    return want.map((w) => {
      const label = `${w.spec.method} ${w.spec.path}`;
      const cands = rec.candidates(w.spec);
      const exact = cands.filter((c) => queryExact(c, w.spec));
      expect(cands.length - exact.length, `${label}: requests started with an unexpected query`).toBe(0);
      expect(exact.length, `${label}: number of app requests started`).toBe(w.count ?? 1);
      for (const c of exact) {
        expect(c.done && !c.failed, `${label}: request reached a terminal response`).toBe(true);
        if (w.status) expect(w.status, `${label}: terminal status`).toContain(c.status);
      }
      return exact;
    });
  } finally { rec.stop(); }
}

/** Single-expectation form of expectCallSet. */
export async function expectCalls(target: Page | BrowserContext, spec: CallSpec, action: () => Promise<unknown>, opts: { count?: number; status?: number[]; settleMs?: number; timeoutMs?: number } = {}): Promise<Call[]> {
  const [calls] = await expectCallSet(target, [{ spec, count: opts.count, status: opts.status }], action, opts);
  return calls;
}

/** The body of a finished call as JSON (object or array normalised to an array of rows). */
export async function rowsOf(c: Call): Promise<Array<Record<string, unknown>>> {
  const res = await c.req.response();
  expect(res, 'a response object').not.toBeNull();
  const body = await res!.json();
  return Array.isArray(body) ? body : [body];
}

export const sha256 = (b: Buffer | Uint8Array) => createHash('sha256').update(b).digest('hex');
export const sameInstant = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b);

/** Cross-project run state (learner submission id, attachment key, certificate identity), in the private session dir. */
export type RunState = { submissionId: string; attachmentId: string; attachmentKey: string; certificate: { id: string; code: string; issuedAt: string } };
const sessionDir = () => { const d = process.env.GB_SESSION_DIR; if (!d) throw new Error('JOURNEY_E_NO_SESSION_DIR'); return d; };
export const saveRunState = (s: RunState) => writePrivateFile(sessionDir(), 'run-state-j2.json', JSON.stringify(s));
export const loadRunState = (): RunState => {
  const s = readPrivateJson(sessionDir(), 'run-state-j2.json') as RunState;
  expect(s.submissionId).toMatch(/^[0-9a-f-]{36}$/);
  expect(s.attachmentKey.startsWith(`submissions/${J.course}/${J.memberId}/`)).toBe(true);
  return s;
};

export async function shot(page: Page, info: TestInfo, name: string) {
  await info.attach(`${name}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
