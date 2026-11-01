// ABOUTME: Purpose-scoped fixtures for the learner quiz lifecycle mode: in-memory learner sign-in, a context-wide egress
// ABOUTME: gate on exact approved origins, validated forwarding for fault handlers, a strict read-only DB ledger, shots.
//
// Egress, in layers (any violation fails the test):
//   1. Browser level (playwright.quiz-lifecycle.config.ts): every non-loopback destination goes to a dead proxy and
//      cannot resolve, and service workers are blocked. This covers redirects, new pages and workers, not one page.
//   2. Context level (this file): every request from every page of the context must have an EXACT approved origin
//      (scheme + host + port of the app and of the API); anything else is aborted and recorded.
//   3. Observers: any redirect hop (request.redirectedFrom()), any 3xx response, and any second page are violations.
//   4. Fault handlers that forward a request themselves (route.fetch) must use forwardApproved(): it re-checks the exact
//      origin BEFORE the fetch, sends with maxRedirects: 0 and refuses a 3xx.
// Nothing is written to disk except evidence under QLC_EVIDENCE_DIR. No storage state, no password change, no cleanup.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIResponse, Page, Request, Route } from '@playwright/test';
import { test as base, expect } from '../fixtures/console-errors.fixture';
import { splitLocalDsn } from '../../scripts/local-stack/quiz-lifecycle/local-dsn.mjs';

export const LEARNER_ID = '9c000000-0000-4000-8000-0000000000a1';
export const COURSE_ID = '9c000000-0000-4000-8000-000000000001';
export const MODULE_ID = '9c000000-0000-4000-8000-000000000002';
const LEARNER_EMAIL = 'qlc-learner@insightscollective.local';
const OUT = process.env.QLC_EVIDENCE_DIR || path.join(os.tmpdir(), 'qlc-evidence');
const SHA = (process.env.E2E_EVIDENCE_COMMIT || 'local').slice(0, 12);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_SQL = path.resolve(HERE, '../../scripts/local-stack/quiz-lifecycle/ledger.sql');

function originOf(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  const u = new URL(value);
  if (!['127.0.0.1', 'localhost'].includes(u.hostname)) throw new Error(`${name} must be loopback`);
  return u.origin;
}
export const APPROVED_ORIGINS = new Set([
  originOf(process.env.E2E_BASE_URL, 'E2E_BASE_URL'),
  originOf(process.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL'),
]);
const NON_NETWORK = /^(data|blob):/;
function approved(url: string): boolean {
  if (NON_NETWORK.test(url)) return true;
  try { return APPROVED_ORIGINS.has(new URL(url).origin); } catch { return false; }
}

/** Scenario NN -> ids, mirroring fixture.sql. Option ids: four and blue are the keyed answers (1 point each). */
export function scenario(nn: string) {
  const s = {
    item: `9c00${nn}01-0000-4000-8000-000000000000`,
    quiz: `9c00${nn}02-0000-4000-8000-000000000000`,
    q1: `9c00${nn}03-0000-4000-8000-000000000000`,
    q2: `9c00${nn}04-0000-4000-8000-000000000000`,
    four: `qlc-${nn}-four`, three: `qlc-${nn}-three`, red: `qlc-${nn}-red`, blue: `qlc-${nn}-blue`,
    url: `/courses/${COURSE_ID}/learn/${MODULE_ID}/9c00${nn}01-0000-4000-8000-000000000000`,
  };
  return s;
}
export type Scenario = ReturnType<typeof scenario>;

export type Attempt = { attempt: number; id: string; state: string; score: string; startedAt: string; finishedAt: string; answers: number };
export type AnswerRow = { attempt: number; question: string; answer: unknown; correct: string; points: string };
export type Ledger = { attempts: Attempt[]; answers: AnswerRow[]; progress: string[]; raw: string[] };

/**
 * Read-only ledger over loopback psql. The DSN is validated by splitLocalDsn (assert-local-dsn, then URI-only, exact
 * loopback host and port) BEFORE psql runs; psql gets a password-free URI in argv and the password via PGPASSWORD in its
 * own environment. psql's stderr is withheld (byte count only).
 */
export function readLedger(quizId: string, label: string): Ledger {
  const dsn = splitLocalDsn(process.env.SUPABASE_DB_URL ?? '', process.env);
  if (!dsn.ok) throw new Error(`ledger: SUPABASE_DB_URL refused (${dsn.reason})`);
  if (!/^[0-9a-f-]{36}$/.test(quizId)) throw new Error('ledger: quiz id is not a uuid');
  const env: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: dsn.password };
  for (const k of ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGPORT', 'PGPASSFILE']) delete env[k];
  let out: string;
  try {
    out = execFileSync('psql', [dsn.uri, '-X', '-At', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-v', `quiz=${quizId}`, '-f', LEDGER_SQL],
      { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  } catch (e: any) {
    throw new Error(`ledger: psql failed (status ${e?.status ?? 'none'}, stderr withheld: ${String(e?.stderr ?? '').length} bytes)`);
  }
  const lines = out.split('\n').filter((l) => /^[AWP]\t/.test(l));
  fs.mkdirSync(path.join(OUT, 'ledger'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'ledger', `${label}.tsv`), lines.join('\n') + '\n');
  const ledger: Ledger = { attempts: [], answers: [], progress: [], raw: lines };
  for (const l of lines) {
    const c = l.split('\t');
    if (c[0] === 'A') ledger.attempts.push({ attempt: Number(c[1]), id: c[2], state: c[3], score: c[4], startedAt: c[5], finishedAt: c[6], answers: Number(c[7]) });
    else if (c[0] === 'W') ledger.answers.push({ attempt: Number(c[1]), question: c[2], answer: c[3] ? JSON.parse(c[3]) : null, correct: c[4], points: c[5] });
    else if (c[0] === 'P') ledger.progress.push(c[2]);
  }
  return ledger;
}

/**
 * Central persisted invariants for FINALIZED attempts: exactly these attempt numbers, distinct ids, state 'complete' with
 * a finished_at, the fixture score, and exactly two answer rows per attempt with the graded correct/points the fixture
 * key implies (four and blue correct, 1 point each). No other attempt and no other answer row.
 */
export function expectFinalized(l: Ledger, s: Scenario, expected: Array<{ attempt: number; q1: string; q2: string }>) {
  expect(l.attempts.map((a) => a.attempt)).toEqual(expected.map((e) => e.attempt));
  expect(new Set(l.attempts.map((a) => a.id)).size).toBe(expected.length);
  const keyed = new Set([s.four, s.blue]);
  const rows: AnswerRow[] = [];
  for (const e of expected) {
    const a = l.attempts.find((x) => x.attempt === e.attempt)!;
    const score = [e.q1, e.q2].filter((v) => keyed.has(v)).length;
    expect(a.state).toBe('complete');
    expect(a.finishedAt).not.toBe('');
    expect(a.score).toBe(String(score));
    expect(a.answers).toBe(2);
    for (const [q, v] of [[s.q1, e.q1], [s.q2, e.q2]] as const) {
      rows.push({ attempt: e.attempt, question: q, answer: v, correct: String(keyed.has(v)), points: keyed.has(v) ? '1.00' : '0.00' });
    }
  }
  const sort = (r: AnswerRow[]) => [...r].sort((x, y) => x.attempt - y.attempt || x.question.localeCompare(y.question));
  expect(sort(l.answers)).toEqual(sort(rows));
}

/**
 * Full persisted history of one attempt: its ledger row (id, state, score, started_at, finished_at, answer count) and
 * every answer row verbatim (answer, correct, points, row timestamp). Used to prove a retake leaves attempt n untouched.
 */
export function attemptHistory(l: Ledger, attempt: number): string[] {
  return l.raw.filter((line) => line.startsWith(`A\t${attempt}\t`) || line.startsWith(`W\t${attempt}\t`));
}

/** Polls until the item's progression row is exactly ['read'] (the app's contract: content_item_progressions). */
export async function expectProgressRead(s: Scenario, label: string) {
  await expect.poll(() => readLedger(s.quiz, label).progress, { timeout: 20000 }).toEqual(['read']);
}

/** Ordered browser-side events for the quiz endpoints. */
export type NetEvent = { kind: 'start' | 'score' | 'write' | 'progress'; phase: 'sent' | 'done' | 'failed'; at: number; status?: number; req: Request };
function kindOf(req: Request): NetEvent['kind'] | null {
  const u = req.url();
  if (u.includes('/rest/v1/rpc/start_quiz_attempt')) return 'start';
  if (u.includes('/functions/v1/score-quiz') && req.method() === 'POST') return 'score';
  if (u.includes('/rest/v1/quiz_submission_answers') && req.method() === 'POST') return 'write';
  if (u.includes('/rest/v1/content_item_progressions') && req.method() !== 'GET') return 'progress';
  return null;
}
export const sent = (net: NetEvent[], k: NetEvent['kind']) => net.filter((e) => e.kind === k && e.phase === 'sent');
/** Every request of kind k that was sent has finished or failed. */
export function settledAll(net: NetEvent[], k: NetEvent['kind']) {
  return net.filter((e) => e.kind === k && e.phase !== 'sent').length === sent(net, k).length;
}

type Egress = { violations: string[] };
type ShotCheck = () => Promise<void>;
type Fixtures = {
  egress: Egress;
  net: NetEvent[];
  learner: Page;
  /** Responsive snapshot: the SAME state resized to each viewport, with `check` asserted at every viewport. */
  snapshot: (name: string, tier: string, check: ShotCheck) => Promise<void>;
  forwardApproved: (route: Route) => Promise<APIResponse | null>;
};

export const test = base.extend<Fixtures & { egressGate: void }>({
  egress: async ({}, use) => { await use({ violations: [] }); },

  egressGate: [
    async ({ context, page, egress }, use, testInfo) => {
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (approved(url)) return route.fallback();
        egress.violations.push(`blocked ${route.request().method()} to a non-approved origin`);
        return route.abort('failed');
      });
      context.on('request', (r) => {
        if (r.redirectedFrom()) egress.violations.push('redirect hop observed');
        if (!approved(r.url())) egress.violations.push('request to a non-approved origin observed');
      });
      context.on('response', (r) => { if (r.status() >= 300 && r.status() < 400) egress.violations.push(`3xx response (${r.status()})`); });
      context.on('page', (p) => { if (p !== page) egress.violations.push('an additional page was opened'); });
      // serviceWorkers: 'block' (config) makes register() a stub that never creates a worker (measured in the egress
      // self-test); any worker that still starts is a violation.
      context.on('serviceworker', () => egress.violations.push('a service worker started'));
      await use();
      fs.mkdirSync(OUT, { recursive: true });
      fs.appendFileSync(path.join(OUT, 'egress.txt'), `${testInfo.title}\t${egress.violations.length}\n`);
      expect(egress.violations, 'egress violations').toEqual([]);
    },
    { auto: true },
  ],

  forwardApproved: async ({ egress }, use) => {
    await use(async (route) => {
      const url = route.request().url();
      if (!approved(url)) {
        egress.violations.push('fault handler asked to forward to a non-approved origin');
        await route.abort('failed');
        return null;
      }
      const res = await route.fetch({ maxRedirects: 0 });
      if (res.status() >= 300 && res.status() < 400) {
        egress.violations.push(`forwarded request answered ${res.status()} (redirects refused)`);
        await route.abort('failed');
        return null;
      }
      return res;
    });
  },

  net: async ({ page }, use) => {
    const events: NetEvent[] = [];
    page.on('request', (r) => { const k = kindOf(r); if (k) events.push({ kind: k, phase: 'sent', at: Date.now(), req: r }); });
    page.on('requestfinished', async (r) => {
      const k = kindOf(r); if (!k) return;
      const resp = await r.response().catch(() => null);
      events.push({ kind: k, phase: 'done', at: Date.now(), status: resp?.status(), req: r });
    });
    page.on('requestfailed', (r) => { const k = kindOf(r); if (k) events.push({ kind: k, phase: 'failed', at: Date.now(), req: r }); });
    await use(events);
  },

  learner: async ({ page }, use) => {
    const password = process.env.E2E_TEST_PASSWORD;
    if (!password) throw new Error('learner: E2E_TEST_PASSWORD is unset');
    await page.addInitScript(() => { try { window.localStorage.setItem('e2e:disable-tours', '1'); } catch { /* ignore */ } });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill(LEARNER_EMAIL);
    await page.locator('#password').fill(password);
    await page.locator('button[type="submit"]:has-text("Sign In")').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30000 });
    await use(page);
  },

  snapshot: async ({ page }, use) => {
    await use(async (name, tier, check) => {
      const original = page.viewportSize();
      for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]] as const) {
        await page.setViewportSize({ width: w, height: h });
        await check();
        const dir = path.join(OUT, 'screens', 'responsive-snapshot', tier);
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${name}-${w}x${h}-${SHA}.png`), fullPage: true });
      }
      if (original) await page.setViewportSize(original);
      await check();
    });
  },
});

/** Screenshot of a state reached by interacting AT this viewport (not a resize of another viewport's state). */
export async function interactionShot(page: Page, name: string) {
  const vp = page.viewportSize();
  const dir = path.join(OUT, 'screens', 'viewport-interaction');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}-${vp?.width}x${vp?.height}-${SHA}.png`), fullPage: true });
}

export { expect };
