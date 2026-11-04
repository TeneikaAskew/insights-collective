// ABOUTME: Request-level observation for the journey lane (UNRUN proposal). The journey never SENDS a write itself: it records
// ABOUTME: every request the app STARTS, matches exact origin/path/query, and requires an exact count with a terminal status.
import { createHash } from 'node:crypto';
import { expect, type BrowserContext, type Page, type Request, type TestInfo } from '@playwright/test';
import { BINDING } from '../fixture';
import { SUBMISSION_PREFIX, J, route } from './ids';
import { readPrivateJson, writePrivateFile } from './private-dir.mjs';
import { createRecorder, evaluate, isCandidate, runStateFailures, settled } from './observe-core.mjs';
import { SHOT_GUARD, SHOT_PLAN, WITHHOLD_ALWAYS, captureShot, shotSecrets, writeShot } from './shot-core.mjs';
import { randomBytes } from 'node:crypto';
import { assertPairingProof } from './pairing-proof.mjs';

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD';
export type CallSpec = {
  method: Method;
  /** Exact pathname on the approved API origin, or a pathname PREFIX when it ends with '/'. */
  path: string;
  /** Exact values for these keys; any other non-passthrough key on the request makes it NOT match (and is reported). */
  query?: Record<string, string>;
};
export type Call = { req: Request; url: URL; method: string; seq: number; status: number | null; failed: boolean; done: boolean; storage?: { err: string; code: string; msg: string; status: string } };
export type Expect = { spec: CallSpec; count?: number; status?: number[] };

/** Records every request the page/context STARTS from now on, with its terminal state (logic in observe-core.mjs). */
export function recordCalls(target: Page | BrowserContext) {
  const rec = createRecorder(target) as { calls: Call[]; stop(): void };
  return { calls: rec.calls, stop: rec.stop, candidates: (spec: CallSpec) => rec.calls.filter((c) => isCandidate(c, spec, BINDING.api.origin)) };
}
export type Recorder = ReturnType<typeof recordCalls>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a UI action and require, for EACH expectation, EXACTLY `count` app requests STARTED that match the spec (exact
 * origin, method, path and query), each terminal (finished, not failed) with an allowed status, and no near-miss during
 * the action. Settles before judging, so a late duplicate fails. With `ordered`, the first start of each expectation must
 * follow the declared order. The target may be a BrowserContext so requests from popups count too.
 */
export async function expectCallSet(target: Page | BrowserContext, want: Expect[], action: () => Promise<unknown>, opts: { settleMs?: number; timeoutMs?: number; ordered?: boolean } = {}): Promise<Call[][]> {
  const rec = createRecorder(target) as { calls: Call[]; stop(): void };
  try {
    await action();
    const deadline = Date.now() + (opts.timeoutMs ?? 30_000);
    while (Date.now() < deadline && !settled(rec.calls, want, BINDING.api.origin)) await sleep(100);
    await sleep(opts.settleMs ?? 1_500);
    const { failures, matched } = evaluate(rec.calls, want, { origin: BINDING.api.origin, ordered: opts.ordered });
    expect(failures, 'request-level expectations (fixed codes)').toEqual([]);
    return matched as Call[][];
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
/** Validated BEFORE it is written (fixed codes, see runStateFailures) and again when read back. */
export const saveRunState = (s: RunState) => {
  expect(runStateFailures(s, SUBMISSION_PREFIX), 'run state captured from the app responses').toEqual([]);
  return writePrivateFile(sessionDir(), 'run-state-j2.json', JSON.stringify(s));
};
export const loadRunState = (): RunState => {
  const s = readPrivateJson(sessionDir(), 'run-state-j2.json') as RunState;
  expect(runStateFailures(s, SUBMISSION_PREFIX), 'run state read back').toEqual([]);
  return s;
};

/** Exact path for each route key of SHOT_PLAN (the static contract checks the key set). */
const SHOT_PATH: Record<string, string> = {
  catalog: route.catalog, detail: route.detail, builder: route.builder, progress: route.progress, certificate: route.certificate,
  'lesson-assignment': route.lesson(J.item.assignment), grader: route.grader, grades: route.grades,
};

/** What the scan samples: main-document text, markup, form values, title, URL; plus image sources and the count of
 *  surfaces it cannot sample (read-only Playwright APIs). */
async function sample(page: Page) {
  const values: string[] = [];
  for (const f of await page.locator('input, textarea, select').all()) values.push(await f.inputValue()); // unreadable: the test fails (closed)
  const images: string[] = [];
  for (const i of await page.locator('img').all()) images.push((await i.getAttribute('src')) ?? '');
  return {
    url: page.url(),
    texts: [await page.locator('body').innerText(), await page.content(), values.join('\n'), await page.title(), page.url()],
    images,
    surfaces: await page.locator('iframe, canvas, video, embed, object').count(),
  };
}

/**
 * A real screenshot of a known synthetic route, kept only when the capture window is provably clean (shot-core.mjs
 * decideShot): right persona and exact path; no unsampled surface; clean sample BEFORE (a dirty page is never captured);
 * same document, no navigation, no mutation or input during the capture; an identical, clean sample AFTER. Anything else
 * WITHHOLDS the shot with a fixed reason and the buffer is dropped. The journey's own assertions are not affected.
 */
export async function shot(page: Page, info: TestInfo, name: string) {
  const dir = process.env.GB_SHOT_DIR ?? '';
  const proof = assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF, { sessionDir: sessionDir() });
  const secrets = shotSecrets(process.env, proof);
  const plan = SHOT_PLAN[name as keyof typeof SHOT_PLAN];
  const base = { project: info.project.name, expectedPath: plan ? SHOT_PATH[plan[1]] : '', appOrigin: BINDING.app.origin, apiOrigin: BINDING.api.origin };
  if (!plan || WITHHOLD_ALWAYS[name as keyof typeof WITHHOLD_ALWAYS]) { writeShot(dir, name, null, { ...base, incomplete: true }, secrets); return; }
  const drv = {
    watchNav: (cb: () => void) => { const on = (f: { parentFrame(): unknown }) => { if (!f.parentFrame()) cb(); }; page.on('framenavigated', on); return () => { page.off('framenavigated', on); }; },
    guard: (op: string, token: string) => page.evaluate(SHOT_GUARD, [op, token] as [string, string]),
    sample: () => sample(page),
    screenshot: () => page.screenshot({ fullPage: true, animations: 'disabled' }),
  };
  const { png, obs } = await captureShot(drv, base, randomBytes(16).toString('hex'), secrets);
  writeShot(dir, name, png, obs, secrets);
}
