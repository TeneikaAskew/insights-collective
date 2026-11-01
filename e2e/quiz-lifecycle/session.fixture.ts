// ABOUTME: Purpose-scoped fixtures for the learner quiz lifecycle mode: in-memory sign-in of the dedicated synthetic
// ABOUTME: learner, a loopback-only egress gate, a read-only DB ledger, a network event log, and labelled evidence shots.
//
// Nothing here writes to disk except evidence under QLC_EVIDENCE_DIR (screenshots, ledger TSVs, egress count). No
// storage state is saved, no password is changed, no shared account or shared row is touched, and no cleanup runs:
// each mode run starts from a fresh local stack (fixture.sql refuses a used one).
//
// Extends the console-error fixture, so every test uses the instrumented, injected `page`.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, Request } from '@playwright/test';
import { test as base, expect } from '../fixtures/console-errors.fixture';

export const LEARNER_ID = '9c000000-0000-4000-8000-0000000000a1';
export const COURSE_ID = '9c000000-0000-4000-8000-000000000001';
export const MODULE_ID = '9c000000-0000-4000-8000-000000000002';
const LEARNER_EMAIL = 'qlc-learner@insightscollective.local';
const OUT = process.env.QLC_EVIDENCE_DIR || path.join(os.tmpdir(), 'qlc-evidence');
const SHA = (process.env.E2E_EVIDENCE_COMMIT || 'local').slice(0, 12);
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_SQL = path.resolve(HERE, '../../scripts/local-stack/quiz-lifecycle/ledger.sql');

/** Scenario NN -> ids, mirroring fixture.sql. */
export function scenario(nn: string) {
  return {
    item: `9c00${nn}01-0000-4000-8000-000000000000`,
    quiz: `9c00${nn}02-0000-4000-8000-000000000000`,
    q1: `9c00${nn}03-0000-4000-8000-000000000000`,
    q2: `9c00${nn}04-0000-4000-8000-000000000000`,
    four: `qlc-${nn}-four`, three: `qlc-${nn}-three`, red: `qlc-${nn}-red`, blue: `qlc-${nn}-blue`,
    url: `/courses/${COURSE_ID}/learn/${MODULE_ID}/9c00${nn}01-0000-4000-8000-000000000000`,
  };
}

export type Attempt = { attempt: number; id: string; state: string; score: string; startedAt: string; finishedAt: string; answers: number };
export type AnswerRow = { attempt: number; question: string; answer: unknown; correct: string; points: string };
export type Ledger = { attempts: Attempt[]; answers: AnswerRow[]; progress: string[] };

/**
 * Read-only ledger over loopback psql (ledger.sql sets the session read-only). The DSN is never printed; psql's
 * stderr is withheld on failure (byte count only). libpq environment overrides are removed so the checked DSN is used.
 */
export function readLedger(quizId: string, label: string): Ledger {
  const dsn = process.env.SUPABASE_DB_URL;
  if (!dsn) throw new Error('ledger: SUPABASE_DB_URL is unset');
  const env = { ...process.env };
  for (const k of ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGPORT', 'PGPASSFILE']) delete env[k];
  let out: string;
  try {
    out = execFileSync('psql', [dsn, '-X', '-At', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-v', `quiz=${quizId}`, '-f', LEDGER_SQL],
      { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  } catch (e: any) {
    throw new Error(`ledger: psql failed (status ${e?.status ?? 'none'}, stderr withheld: ${String(e?.stderr ?? '').length} bytes)`);
  }
  const lines = out.split('\n').filter((l) => /^[AWP]\t/.test(l));
  fs.mkdirSync(path.join(OUT, 'ledger'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'ledger', `${label}.tsv`), lines.join('\n') + '\n');
  const ledger: Ledger = { attempts: [], answers: [], progress: [] };
  for (const l of lines) {
    const c = l.split('\t');
    if (c[0] === 'A') ledger.attempts.push({ attempt: Number(c[1]), id: c[2], state: c[3], score: c[4], startedAt: c[5], finishedAt: c[6], answers: Number(c[7]) });
    else if (c[0] === 'W') ledger.answers.push({ attempt: Number(c[1]), question: c[2], answer: c[3] ? JSON.parse(c[3]) : null, correct: c[4], points: c[5] });
    else if (c[0] === 'P') ledger.progress.push(c[2]);
  }
  return ledger;
}

/** Ordered browser-side network events for the quiz endpoints, for ordering assertions. */
export type NetEvent = { kind: 'start' | 'score' | 'write' | 'progress'; phase: 'sent' | 'done' | 'failed'; at: number };
function kindOf(req: Request): NetEvent['kind'] | null {
  const u = req.url();
  if (u.includes('/rest/v1/rpc/start_quiz_attempt')) return 'start';
  if (u.includes('/functions/v1/score-quiz') && req.method() === 'POST') return 'score';
  if (u.includes('/rest/v1/quiz_submission_answers') && req.method() === 'POST') return 'write';
  if (u.includes('/rest/v1/content_item_progressions') && req.method() !== 'GET') return 'progress';
  return null;
}

type Fixtures = {
  net: NetEvent[];
  learner: Page;
  shoot: (name: string, tier: 'real' | 'fault') => Promise<void>;
};

export const test = base.extend<Fixtures & { egressGate: void }>({
  // Every request to a non-loopback host is aborted and counted; any count fails the test. Loopback requests fall
  // through to routes registered later (fault injection) or to the network.
  egressGate: [
    async ({ page }, use, testInfo) => {
      let blocked = 0;
      await page.route('**/*', (route) => {
        let host = '';
        try { host = new URL(route.request().url()).hostname; } catch { /* unparseable = not loopback */ }
        if (route.request().url().startsWith('data:') || LOOPBACK.has(host)) return route.fallback();
        blocked += 1;
        return route.abort('blockedbyclient');
      });
      await use();
      fs.mkdirSync(OUT, { recursive: true });
      fs.appendFileSync(path.join(OUT, 'egress.txt'), `${testInfo.title}\t${blocked}\n`);
      expect(blocked, 'requests to non-loopback hosts were attempted').toBe(0);
    },
    { auto: true },
  ],

  net: async ({ page }, use) => {
    const events: NetEvent[] = [];
    page.on('request', (r) => { const k = kindOf(r); if (k) events.push({ kind: k, phase: 'sent', at: Date.now() }); });
    page.on('requestfinished', (r) => { const k = kindOf(r); if (k) events.push({ kind: k, phase: 'done', at: Date.now() }); });
    page.on('requestfailed', (r) => { const k = kindOf(r); if (k) events.push({ kind: k, phase: 'failed', at: Date.now() }); });
    await use(events);
  },

  // Signs the dedicated learner in through the real login page, in this test's own context. Nothing is persisted.
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

  shoot: async ({ page }, use) => {
    await use(async (name, tier) => {
      const original = page.viewportSize();
      for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]] as const) {
        await page.setViewportSize({ width: w, height: h });
        const dir = path.join(OUT, 'screens', tier);
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${name}-${w}x${h}-${SHA}.png`), fullPage: true });
      }
      if (original) await page.setViewportSize(original);
    });
  },
});

export { expect };
