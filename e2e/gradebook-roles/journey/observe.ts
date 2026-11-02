// ABOUTME: Request-level observation for the journey lane (UNRUN proposal). The journey never SENDS a write itself: it records
// ABOUTME: every request the app STARTS, matches exact origin/path/query, and requires an exact count with a terminal status.
import { createHash } from 'node:crypto';
import { expect, type BrowserContext, type Page, type Request, type TestInfo } from '@playwright/test';
import { BINDING } from '../fixture';
import { SUBMISSION_PREFIX } from './ids';
import { readPrivateJson, writePrivateFile } from './private-dir.mjs';
import { createRecorder, evaluate, isCandidate, runStateFailures, settled } from './observe-core.mjs';
import { scanPage, shotSecrets, writeShot } from './shot-core.mjs';
import { assertPairingProof } from './pairing-proof.mjs';

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD';
export type CallSpec = {
  method: Method;
  /** Exact pathname on the approved API origin, or a pathname PREFIX when it ends with '/'. */
  path: string;
  /** Exact values for these keys; any other non-passthrough key on the request makes it NOT match (and is reported). */
  query?: Record<string, string>;
};
export type Call = { req: Request; url: URL; method: string; seq: number; status: number | null; failed: boolean; done: boolean };
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

/** Everything the page renders as text: visible text, markup, form values, title and URL (read-only Playwright APIs; no
 *  script runs in the page). */
async function pageTexts(page: Page): Promise<string[]> {
  const values: string[] = [];
  for (const f of await page.locator('input, textarea, select').all()) values.push(await f.inputValue()); // unreadable: the test fails (closed)
  return [await page.locator('body').innerText(), await page.content(), values.join('\n'), await page.title(), page.url()];
}

/**
 * A real screenshot of the page as the persona sees it, kept only if the page text holds neither this run's pairing nonce
 * (nor its carrier prefix) nor a credential, checked before and after the capture. A dirty page fails the test with a
 * fixed code and nothing is written. Clean captures go to the private GB_SHOT_DIR with a scan record bound to their
 * sha256; shot-export.mjs is the only way out of the run.
 */
export async function shot(page: Page, _info: TestInfo, name: string) {
  const proof = assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF, { sessionDir: sessionDir() });
  const secrets = shotSecrets(process.env, proof);
  const before = scanPage(await pageTexts(page), secrets);
  const png = await page.screenshot({ fullPage: true, animations: 'disabled' });
  const after = scanPage(await pageTexts(page), secrets);
  writeShot(process.env.GB_SHOT_DIR ?? '', name, png, [before, after]);
}
