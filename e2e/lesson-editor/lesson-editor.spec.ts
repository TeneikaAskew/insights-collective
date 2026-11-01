// ABOUTME: Real-backend, real-TipTap acceptance for lesson save/reload persistence on the ISOLATED LOCAL stack (fixture personas).
// ABOUTME: Egress-confined browser, no stubs; every claim is paired with a loopback DB readback through run.sh. NOT YET RUN.
//
// Tier: authentic isolated local Supabase (supabase start, loopback) + the built app. NOT production, NOT the deployed backend.
// Run only with playwright.lesson-editor.config.ts after `run.sh setup` has passed. Fault injection is labelled per case:
//   AUTHENTIC        real request to the local stack, real response
//   BROWSER-OFFLINE  context.setOffline(true): the browser genuinely has no network (no response is faked)
//   RLS-ZERO-ROW     real RLS denial produced by moving fixture course C1 to persona OTHER (run.sh owner)
//   SECOND-TAB       a second page in the same signed-in context writes first (real conflict on the real trigger)
//   DOCUMENT-LOSS    the tab leaves the app while offline, so the old document never settles; a fresh document then loads
// Egress: egress-test.ts confines every page of the context to exactly LE_APP_ORIGIN and LE_API_ORIGIN (allowlist proxy,
// route/WebSocket filter that only aborts or continues, observation; see egress-boundary.ts). Nothing is fulfilled or faked.
// Writes: only fixture rows ed170000-... (course C1), once per fresh stack.
//
// Explicitly NOT claimed here (pending, labelled in README): same-lesson write serialization under real concurrency; the
// durable ambiguous Undo-to-base case (a send that may commit while the author returns to the base); storage-disabled
// browsers; sign-out A -> B -> A; delayed-response schedules; existing student quiz HISTORY preservation; curriculum
// rename/publish side actions.
import { test, expect, CONTROL_OFF } from './egress-test';
import type { Page, TestInfo, BrowserContext, Request, Locator } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateLabels, apiPath, method as httpMethod } from '../evidence/evidence-metadata.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUNNER = path.join(ROOT, 'scripts/local-stack/lesson-editor/run.sh');
const ENV = {
  app: process.env.LE_APP_ORIGIN || '',
  api: process.env.LE_API_ORIGIN || '',
  db: process.env.LE_DB_URL || '',
  work: process.env.LE_WORK_DIR || '',
  evidence: process.env.LE_EVIDENCE_DIR || '',
  output: process.env.LE_OUTPUT_DIR || '',
  report: process.env.LE_REPORT_JSON || '',
};
const LOOPBACK = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(x.hostname) && x.pathname === '/' && !x.search && !x.username;
  } catch {
    return false;
  }
};
const within = (child: string, parent: string) => {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};
const LABEL_CHECK = validateLabels(process.env);
const LABELS = LABEL_CHECK.labels;

const C1 = 'ed170000-0000-4000-8000-0000000000c1';
const A = 'ed170000-0000-4000-8000-0000000000a1';
const B = 'ed170000-0000-4000-8000-0000000000a2';
const N = 'ed170000-0000-4000-8000-0000000000a3';
const Q = 'ed170000-0000-4000-8000-0000000000a4';
const MISSING = 'ed170000-0000-4000-8000-0000000000ff';
const FIXTURE_IDS: Record<string, string> = { [A]: 'A', [B]: 'B', [N]: 'N', [Q]: 'Q', 'ed170000-0000-4000-8000-0000000000b1': 'K', 'ed170000-0000-4000-8000-0000000000b2': 'KN' };

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
] as const;
type Mode = 'AUTHENTIC' | 'BROWSER-OFFLINE' | 'RLS-ZERO-ROW' | 'SECOND-TAB' | 'DOCUMENT-LOSS';

const personaId = (p: 'OWNER' | 'OTHER' | 'STUDENT'): string => {
  try {
    const id = JSON.parse(readFileSync(path.join(ENV.work, 'personas.json'), 'utf8'))[p]?.id;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error();
    return id;
  } catch {
    throw new Error(`persona ${p} unreadable (detail withheld)`);
  }
};
const stateFor = (p: 'OWNER' | 'OTHER' | 'STUDENT') => path.join(ENV.work, `state-${p}.json`);

// ---------- guarded DB access: errors carry only the subcommand and exit status (never the DSN, stderr or output) ----------
function runner(args: string[]): string {
  try {
    return execFileSync(RUNNER, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000 }).trim();
  } catch (e) {
    throw new Error(`run.sh ${args[0]} failed (exit ${(e as { status?: number }).status ?? 'signal'}; detail withheld)`);
  }
}
type DbRow = { id: string; title: string; content: string; type: string; published: boolean; updated_at: string | null };
const dbLesson = (id: string): DbRow => {
  const out = runner(['read', ENV.db, id]);
  try {
    return JSON.parse(out);
  } catch {
    throw new Error('run.sh read returned unparseable output (detail withheld)');
  }
};
const quizHash = () => runner(['quizhash', ENV.db]);
const setOwner = (who: 'OWNER' | 'OTHER') => runner(['owner', ENV.db, ENV.work, who]);

// ---------- request tracking over the whole CONTEXT (every tab), from request start to finished/failed ----------
type Cond = 'eq' | 'is.null' | 'none' | 'other';
type Write = {
  lesson: string; cond: Cond; startedAt: number; endedAt: number | null; state: 'pending' | 'finished' | 'failed';
  status: number; rows: number | null; row: DbRow | null;
};
const lessonLabel = (raw: string | null) => {
  const id = (raw || '').replace(/^eq\./, '');
  return FIXTURE_IDS[id] ?? (id ? '<other>' : '<none>'); // bounded: never raw query text
};
const condOf = (raw: string | null): Cond => (raw === null ? 'none' : raw === 'is.null' ? 'is.null' : raw.startsWith('eq.') ? 'eq' : 'other');
function observe(context: BrowserContext) {
  const api = new URL(ENV.api).origin;
  const writes: Write[] = [];
  const calls: { method: string; path: string; status: number; lesson: string }[] = [];
  const byReq = new Map<Request, Write>();
  const bodies = new Set<Promise<void>>();
  const isWrite = (req: Request, u: URL) => req.method() === 'PATCH' && u.origin === api && u.pathname === '/rest/v1/content_items';
  context.on('request', (req) => {
    const u = new URL(req.url());
    if (!isWrite(req, u)) return;
    const w: Write = {
      lesson: lessonLabel(u.searchParams.get('id')), cond: condOf(u.searchParams.get('updated_at')), startedAt: Date.now(),
      endedAt: null, state: 'pending', status: 0, rows: null, row: null,
    };
    writes.push(w);
    byReq.set(req, w);
  });
  context.on('requestfailed', (req) => {
    const w = byReq.get(req);
    if (w) Object.assign(w, { state: 'failed', endedAt: Date.now() });
  });
  context.on('requestfinished', (req) => {
    const u = new URL(req.url());
    const p = (async () => {
      const res = await req.response();
      if (u.origin === api && /^\/(rest|auth|functions|storage)\/v1\//.test(u.pathname)) {
        calls.push({ method: httpMethod(req.method()), path: apiPath(u.pathname), status: res?.status() ?? 0, lesson: lessonLabel(u.searchParams.get('id')) });
      }
      const w = byReq.get(req);
      if (!w) return;
      w.status = res?.status() ?? 0;
      try {
        const body = res ? await res.json() : null;
        w.rows = Array.isArray(body) ? body.length : body ? 1 : 0;
        w.row = Array.isArray(body) ? (body[0] ?? null) : body;
      } catch {
        w.rows = null;
      }
      Object.assign(w, { state: 'finished', endedAt: Date.now() });
    })();
    bodies.add(p);
    void p.finally(() => bodies.delete(p));
  });
  const of = (lesson?: string) => writes.filter((w) => !lesson || w.lesson === FIXTURE_IDS[lesson]);
  /** Waits until every write started so far (optionally for one lesson) has finished or failed, bodies included. */
  async function settle(lesson?: string) {
    await expect.poll(() => of(lesson).filter((w) => w.state === 'pending').length, { timeout: 20_000 }).toBe(0);
    await Promise.all([...bodies]);
  }
  return { writes, calls, of, settle };
}
type Obs = ReturnType<typeof observe>;
const sha = (s: string | null) => createHash('sha256').update(s ?? '').digest('hex').slice(0, 16);
const rowEvidence = (r: DbRow | null) => r && { id: FIXTURE_IDS[r.id] ?? '<other>', type: r.type, updated_at: r.updated_at, titleSha: sha(r.title), contentSha: sha(r.content) };

// ---------- UI helpers (every read filtered to the visible presentation) ----------
const builder = (lesson?: string) => `/courses/${C1}/builder?view=lesson${lesson ? `&lesson=${lesson}` : ''}`;
const title = (page: Page) => page.locator('#lesson-title:visible');
const status = (page: Page) => page.locator('[data-testid="lesson-save-status"]:visible');
const editor = (page: Page) => page.locator('.ProseMirror:visible').first(); // the real TipTap surface
const preview = (page: Page) => page.locator('[data-onboarding="builder-preview"]:visible').first();
const outlineButton = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true }).filter({ visible: true }).first();
const mirrorKey = (userId: string, lesson: string) => `ic.builder.lessonDraft.v2.${userId}:${C1}.${lesson}`;
const leaveHandled = new WeakSet<Page>();
async function openLesson(page: Page, lesson: string) {
  if (!leaveHandled.has(page)) {
    // A navigation with unconfirmed changes raises the app's beforeunload prompt; Playwright would dismiss it (cancelling the
    // navigation). Accept only that prompt; any other dialog is dismissed.
    page.on('dialog', (d) => (d.type() === 'beforeunload' ? d.accept() : d.dismiss()));
    leaveHandled.add(page);
  }
  const expected = dbLesson(lesson).title;
  await page.goto(builder(lesson));
  await expect(title(page)).toHaveValue(expected, { timeout: 30_000 });
  await expect(editor(page)).toBeVisible();
}
async function typeInBody(page: Page, text: string) {
  await editor(page).click();
  await page.keyboard.press('End');
  await page.keyboard.type(text);
}
async function saved(page: Page) {
  await expect(status(page)).toHaveAttribute('data-status', 'saved', { timeout: 20_000 });
}
type Record2 = { v: number; owner: string; draft: { title: string }; outstanding: unknown[]; uncertain: boolean; confirmed: unknown };
const record = async (page: Page, key: string): Promise<Record2 | null> => {
  const raw = await page.evaluate((k) => window.sessionStorage.getItem(k), key);
  return raw ? (JSON.parse(raw) as Record2) : null;
};

/** F: a screen is evidence only when the UI shows the expected state AND the database agrees, checked before capture. */
async function captureVerified(
  page: Page, info: TestInfo, vp: string, shot: string, mode: Mode, obs: Obs,
  ui: { title?: string; status?: string; body?: string; heading?: string },
  db: { lesson?: string; title?: string; notTitle?: string },
) {
  if (ui.title !== undefined) await expect(title(page)).toHaveValue(ui.title);
  if (ui.status !== undefined) await expect(status(page)).toHaveAttribute('data-status', ui.status);
  if (ui.body !== undefined) await expect(editor(page)).toContainText(ui.body);
  if (ui.heading !== undefined) await expect(page.getByRole('heading', { name: ui.heading })).toBeVisible();
  await obs.settle();
  const row = db.lesson ? dbLesson(db.lesson) : null;
  if (db.title !== undefined) expect(row?.title, `${shot}: database agrees with the screen`).toBe(db.title);
  if (db.notTitle !== undefined) expect(row?.title, `${shot}: the unconfirmed draft is not in the database`).not.toBe(db.notTitle);
  const name = `${LABELS.commit.slice(0, 12)}__${vp}__${shot}__retry${info.retry}`;
  await info.attach(`${name}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  const entry = {
    tier: 'authentic isolated LOCAL stack (NOT mocked, NOT production, NOT the deployed backend)', faultInjection: mode, stubs: 0,
    commit: LABELS.commit, environment: LABELS.environment, viewport: vp, shot, path: new URL(page.url()).pathname,
    verified: { ui: Object.keys(ui), db: Object.keys(db) }, row: rowEvidence(row),
    api: obs.calls.map(({ method, path, status, lesson }) => ({ method, path, status, lesson })), capturedAt: new Date().toISOString(),
  };
  await info.attach(`${name}.json`, { body: Buffer.from(JSON.stringify(entry, null, 2)), contentType: 'application/json' });
}

test.describe.configure({ mode: 'serial' });

let ready = false;
test.beforeAll(() => {
  expect(CONTROL_OFF, 'LE_EGRESS_CONTROL must not be set for the lesson-editor spec').toBe(false);
  expect(LABEL_CHECK.problems, 'evidence labels must be valid').toEqual([]);
  for (const [k, v] of Object.entries(ENV)) expect(v, `LE_* ${k} must be set`).not.toBe('');
  expect(LOOPBACK(ENV.app), 'LE_APP_ORIGIN must be a loopback http origin').toBe(true);
  expect(LOOPBACK(ENV.api), 'LE_API_ORIGIN must be a loopback http origin').toBe(true);
  // Private session files and public evidence never mix.
  expect(within(ENV.output, ENV.evidence) && within(ENV.report, ENV.evidence), 'output and report must be inside LE_EVIDENCE_DIR').toBe(true);
  expect(within(ENV.work, ENV.evidence) || within(ENV.evidence, ENV.work), 'private dir and evidence dir must be disjoint').toBe(false);
  // The runner re-checks the DSN on every call; a non-loopback DSN throws here, before any browser work.
  expect(dbLesson(A).id).toBe(A);
  setOwner('OWNER');
  ready = true;
});
test.afterAll(() => {
  if (ready) setOwner('OWNER'); // never touch a target the preconditions refused
});

test.describe('owner, real backend and TipTap, desktop', () => {
  test.use({ storageState: stateFor('OWNER'), viewport: { width: 1440, height: 900 } });

  test('E1 save: the returned row is exactly the stored row, the trigger advanced the version, reload keeps it', async ({ page, context }, info) => {
    const obs = observe(context);
    await openLesson(page, A);
    const before = dbLesson(A);
    await title(page).fill('E1 saved title');
    await typeInBody(page, ' E1 body');
    await saved(page);
    await obs.settle(A);
    const stored = dbLesson(A);
    const last = obs.of(A).at(-1)!;
    expect(last.state).toBe('finished');
    expect([last.status, last.rows, last.cond]).toEqual([200, 1, 'eq']);
    expect({ id: last.row!.id, title: last.row!.title, content: last.row!.content, updated_at: last.row!.updated_at })
      .toEqual({ id: stored.id, title: stored.title, content: stored.content, updated_at: stored.updated_at });
    expect(stored.title).toBe('E1 saved title');
    expect(stored.content).toContain('E1 body');
    expect(stored.type).toBe('page');
    expect(new Date(stored.updated_at!) > new Date(before.updated_at!), 'trigger advanced updated_at').toBe(true);
    await page.reload();
    await expect(title(page)).toHaveValue('E1 saved title', { timeout: 30_000 });
    await expect(editor(page)).toContainText('E1 body');
    await info.attach('E1-db.json', { body: Buffer.from(JSON.stringify({ before: rowEvidence(before), stored: rowEvidence(stored) })), contentType: 'application/json' });
  });

  test('E2 navigation within 800 ms of the last input: switch lesson and Preview both persist the edit', async ({ page, context }) => {
    const obs = observe(context);
    await openLesson(page, A);
    // Navigation targets are resolved BEFORE the edit, so no DB read or lookup sits between input and click.
    const bTitle = dbLesson(B).title;
    const toB = outlineButton(page, bTitle);
    await expect(toB).toBeVisible();
    const startedA = obs.of(A).length;
    await title(page).fill('E2 switch');
    const t0 = Date.now();
    await toB.click();
    const dt = Date.now() - t0;
    expect(dt, 'input -> navigation inside the 800 ms save debounce').toBeLessThan(800);
    test.info().annotations.push({ type: 'E2 switch input->click ms', description: String(dt) });
    await expect(title(page)).toHaveValue(bTitle);
    await obs.settle(A);
    expect(obs.of(A).length, 'the switch itself sent the edit (flush), not a later debounce').toBeGreaterThan(startedA);
    expect(obs.of(A).at(-1)!.startedAt - t0, 'the write left before the debounce could have fired').toBeLessThan(800);
    expect(dbLesson(A).title).toBe('E2 switch');

    const toPreview = preview(page);
    await expect(toPreview).toBeVisible();
    await title(page).fill('E2 preview');
    const t1 = Date.now();
    await toPreview.click();
    const dt2 = Date.now() - t1;
    expect(dt2, 'input -> Preview inside the 800 ms save debounce').toBeLessThan(800);
    await expect(page).toHaveURL(new RegExp(`/courses/${C1}/learn`), { timeout: 20_000 });
    expect(dbLesson(B).title, 'saved before the navigation completed (the builder flushes, then navigates)').toBe('E2 preview');
    await page.goBack();
    await expect(page).toHaveURL(/\/builder/);
    await page.reload();
    await expect(title(page)).toHaveValue('E2 preview', { timeout: 30_000 });
    await obs.settle();
    expect(obs.writes.every((w) => w.state === 'finished' && w.status === 200 && w.rows === 1)).toBe(true);
    test.info().annotations.push({ type: 'pending', description: 'same-lesson serialization under concurrent in-flight writes is NOT claimed here (one write per lesson)' });
  });

  test('E3 offline: "Save not confirmed", Retry while offline stays unconfirmed, leave warning, reconnect persists', async ({ page, context }) => {
    const obs = observe(context);
    await openLesson(page, A);
    const before = dbLesson(A);
    await context.setOffline(true); // BROWSER-OFFLINE
    await title(page).fill('E3 offline draft');
    await expect(status(page)).toHaveAttribute('data-status', 'error', { timeout: 20_000 });
    await expect(status(page)).toHaveAttribute('data-uncertain', 'true');
    await expect(status(page)).toContainText(/offline/i);
    await status(page).getByRole('button', { name: /retry save/i }).click(); // still offline: must not claim success
    await expect(status(page)).toHaveAttribute('data-status', 'error', { timeout: 20_000 });
    await obs.settle(A);
    expect(obs.of(A).every((w) => w.state === 'failed'), 'every send while offline failed in the browser').toBe(true);
    expect(dbLesson(A).title, 'nothing reached the server').toBe(before.title);
    await preview(page).click();
    await expect(page.getByText('Lesson changes are not saved')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Stay and retry' }).click();
    await expect(page).toHaveURL(/\/builder/);
    await expect(title(page)).toHaveValue('E3 offline draft');
    await context.setOffline(false); // the builder's online handler retries (reconciles first)
    await saved(page);
    await obs.settle(A);
    expect(dbLesson(A).title).toBe('E3 offline draft');
  });

  test('E4 document loss while a send is unconfirmed: durable record, fresh document restores, reconciles, saves', async ({ page, context }) => {
    const owner = personaId('OWNER');
    await openLesson(page, B);
    const before = dbLesson(B);
    await context.setOffline(true);
    await title(page).fill('E4 restored after document loss');
    await expect(status(page)).toHaveAttribute('data-status', 'error', { timeout: 20_000 });
    const rec = await record(page, mirrorKey(owner, B));
    expect(rec, 'durable record exists while the send is unconfirmed').not.toBeNull();
    expect({ v: rec!.v, owner: rec!.owner, title: rec!.draft.title, uncertain: rec!.uncertain, outstanding: rec!.outstanding.length > 0 })
      .toEqual({ v: 2, owner, title: 'E4 restored after document loss', uncertain: true, outstanding: true });
    // DOCUMENT-LOSS: leave the app while still offline. The old document unloads without settling (its flush cannot reach the
    // server and its online handler dies with it). sessionStorage stays with this tab.
    await page.goto('about:blank');
    expect(dbLesson(B).title, 'nothing reached the server').toBe(before.title);
    await context.setOffline(false);
    await page.goto(builder(B)); // fresh document, same tab storage
    await expect(page.getByTestId('lesson-recovered-notice').filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    await expect(title(page)).toHaveValue('E4 restored after document loss');
    await saved(page); // restored as uncertain: reconciled and fenced before Saved
    expect(dbLesson(B).title).toBe('E4 restored after document loss');
    await expect.poll(async () => record(page, mirrorKey(owner, B)), { timeout: 10_000 }).toBeNull();
    test.info().annotations.push({ type: 'pending', description: 'the durable AMBIGUOUS case (a send that may still commit, Undo to base) is not reproduced here: offline sends never reach the server' });
  });

  test('E5 NULL version: the app writes with IS NULL, a second writer versions it first, the stale NULL save conflicts', async ({ page, context }) => {
    const obs = observe(context);
    expect(dbLesson(N).updated_at, 'true NULL baseline (fixture, fresh stack)').toBeNull();
    await openLesson(page, N);
    const tab2 = await context.newPage(); // SECOND-TAB, also loaded at the NULL baseline
    await openLesson(tab2, N);
    await title(tab2).fill('E5 second writer');
    await saved(tab2);
    await obs.settle(N);
    const first = obs.of(N)[0];
    expect([first.cond, first.status, first.rows]).toEqual(['is.null', 200, 1]);
    const versioned = dbLesson(N);
    expect(versioned.updated_at, 'the trigger versioned the row').not.toBeNull();
    await title(page).fill('E5 stale null writer');
    await expect(status(page)).toHaveAttribute('data-status', 'conflict', { timeout: 20_000 });
    await obs.settle(N);
    const stale = obs.of(N).at(-1)!;
    expect([stale.cond, stale.status, stale.rows], 'the stale writer still conditioned on IS NULL and matched nothing').toEqual(['is.null', 200, 0]);
    expect(dbLesson(N), 'an unconditional write would have overwritten; this one did not').toEqual(versioned);
    await status(page).getByRole('button', { name: 'Keep my version' }).click();
    await saved(page);
    await obs.settle(N);
    expect(obs.of(N).at(-1)!.cond, 'the resolution is conditioned on the observed version').toBe('eq');
    expect(dbLesson(N).title).toBe('E5 stale null writer');
    await tab2.close();
  });

  test('E6 second tab saves first: explicit conflict, no overwrite; Keep my version then wins', async ({ page, context }) => {
    const obs = observe(context);
    await openLesson(page, A);
    const tab2 = await context.newPage(); // SECOND-TAB
    await openLesson(tab2, A);
    await title(tab2).fill('E6 tab two');
    await saved(tab2);
    await obs.settle(A);
    const afterTab2 = dbLesson(A);
    await title(page).fill('E6 tab one');
    await expect(status(page)).toHaveAttribute('data-status', 'conflict', { timeout: 20_000 });
    await obs.settle(A);
    expect(obs.of(A).at(-1)!.rows, 'the stale write matched no row').toBe(0);
    expect(dbLesson(A).title, 'tab one did not overwrite').toBe('E6 tab two');
    await status(page).getByRole('button', { name: 'Keep my version' }).click();
    await saved(page);
    const final = dbLesson(A);
    expect(final.title).toBe('E6 tab one');
    expect(new Date(final.updated_at!) > new Date(afterTab2.updated_at!)).toBe(true);
    await tab2.close();
  });

  test('E7 zero rows by real RLS: no false success, draft kept, retry after access returns', async ({ page, context }) => {
    const obs = observe(context);
    await openLesson(page, B);
    const before = dbLesson(B);
    setOwner('OTHER'); // RLS-ZERO-ROW
    try {
      await title(page).fill('E7 denied draft');
      await expect(status(page)).toHaveAttribute('data-status', 'error', { timeout: 20_000 });
      await expect(status(page)).toContainText(/no longer have access|changed no rows/i);
      await obs.settle(B);
      expect(obs.of(B).at(-1)!.rows, 'RLS: the write matched no row').toBe(0);
      expect(dbLesson(B).title).toBe(before.title);
    } finally {
      setOwner('OWNER');
    }
    await status(page).getByRole('button', { name: /retry save/i }).click();
    await saved(page);
    expect(dbLesson(B).title).toBe('E7 denied draft');
  });

  test('E8 quiz lesson: type is fixed; a title edit keeps the quiz definition and its two questions unchanged', async ({ page }) => {
    const before = quizHash();
    await openLesson(page, Q);
    await expect(page.locator('#lesson-type:visible')).toBeDisabled();
    await title(page).fill(`Graded quiz (E8 ${Date.now() % 1000})`);
    await saved(page);
    expect(dbLesson(Q).type).toBe('quiz');
    expect(quizHash(), 'quiz definition and questions unchanged').toBe(before);
    test.info().annotations.push({ type: 'pending', description: 'existing student quiz HISTORY preservation and curriculum rename/publish side actions are NOT covered (no history canary in this fixture)' });
  });

  test('E9 deep link and reload keep the requested lesson; a missing lesson says so', async ({ page }) => {
    await openLesson(page, B);
    await page.reload();
    await expect(title(page)).toHaveValue(dbLesson(B).title, { timeout: 30_000 });
    await page.goto(builder(MISSING));
    await expect(page.getByRole('alert').filter({ hasText: 'was not found in this course' })).toBeVisible({ timeout: 30_000 });
  });
});

for (const who of ['OTHER', 'STUDENT'] as const) {
  test.describe(`role ${who} cannot edit`, () => {
    test.use({ storageState: stateFor(who), viewport: { width: 1440, height: 900 } });
    test(`R-${who}: builder shows Not authorized and starts zero lesson writes`, async ({ page, context }) => {
      const obs = observe(context);
      const before = { A: dbLesson(A), B: dbLesson(B) };
      await page.goto(builder(A));
      await expect(page.getByRole('heading', { name: 'Not authorized' })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.ProseMirror:visible')).toHaveCount(0);
      await page.waitForTimeout(1500); // longer than the save debounce
      await obs.settle();
      expect(obs.writes, 'no content_items write was even STARTED (pending and failed included)').toEqual([]);
      expect({ A: dbLesson(A), B: dbLesson(B) }).toEqual(before);
    });
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`recovery screens @ ${vp.name}`, () => {
    test.use({ storageState: stateFor('OWNER'), viewport: { width: vp.width, height: vp.height } });
    test('deep link, saved, not confirmed, leave warning, restored after document loss, conflict, fixed type', async ({ page, context }, info) => {
      const obs = observe(context);
      await openLesson(page, B);
      const start = dbLesson(B).title;
      await captureVerified(page, info, vp.name, '01-deep-link', 'AUTHENTIC', obs, { title: start }, { lesson: B, title: start });

      const savedTitle = `Saved at ${vp.name}`;
      await title(page).fill(savedTitle);
      await typeInBody(page, ` ${vp.name}`);
      await saved(page);
      await captureVerified(page, info, vp.name, '02-saved', 'AUTHENTIC', obs, { title: savedTitle, status: 'saved', body: vp.name }, { lesson: B, title: savedTitle });

      const draft = `Offline at ${vp.name}`;
      await context.setOffline(true);
      await title(page).fill(draft);
      await expect(status(page)).toHaveAttribute('data-status', 'error', { timeout: 20_000 });
      await captureVerified(page, info, vp.name, '03-not-confirmed', 'BROWSER-OFFLINE', obs, { title: draft, status: 'error' }, { lesson: B, title: savedTitle, notTitle: draft });
      await preview(page).click();
      await expect(page.getByText('Lesson changes are not saved')).toBeVisible({ timeout: 20_000 });
      await captureVerified(page, info, vp.name, '04-leave-warning', 'BROWSER-OFFLINE', obs, {}, { lesson: B, title: savedTitle });
      await page.getByRole('button', { name: 'Stay and retry' }).click();
      await page.goto('about:blank'); // DOCUMENT-LOSS while still offline
      await context.setOffline(false);
      await page.goto(builder(B));
      await expect(page.getByTestId('lesson-recovered-notice').filter({ visible: true })).toBeVisible({ timeout: 30_000 });
      await captureVerified(page, info, vp.name, '05-restored', 'DOCUMENT-LOSS', obs, { title: draft }, { lesson: B });
      await saved(page);
      expect(dbLesson(B).title).toBe(draft);

      const tab2 = await context.newPage();
      await openLesson(tab2, B);
      const theirs = `Tab two at ${vp.name}`;
      await title(tab2).fill(theirs);
      await saved(tab2);
      await tab2.close();
      await title(page).fill(`Tab one at ${vp.name}`);
      await expect(status(page)).toHaveAttribute('data-status', 'conflict', { timeout: 20_000 });
      await captureVerified(page, info, vp.name, '06-conflict', 'SECOND-TAB', obs, { status: 'conflict' }, { lesson: B, title: theirs });
      await status(page).getByRole('button', { name: 'Use the saved version' }).click();
      await saved(page);
      expect(dbLesson(B).title).toBe(theirs);

      await openLesson(page, Q);
      await expect(page.locator('#lesson-type:visible')).toBeDisabled();
      const q = dbLesson(Q);
      await captureVerified(page, info, vp.name, '07-type-fixed', 'AUTHENTIC', obs, { title: q.title }, { lesson: Q, title: q.title });
      expect(q.type).toBe('quiz');
    });
  });

  test.describe(`not-authorized screen @ ${vp.name}`, () => {
    test.use({ storageState: stateFor('OTHER'), viewport: { width: vp.width, height: vp.height } });
    test('another instructor sees Not authorized and starts no write', async ({ page, context }, info) => {
      const obs = observe(context);
      const before = dbLesson(A);
      await page.goto(builder(A));
      await expect(page.getByRole('heading', { name: 'Not authorized' })).toBeVisible({ timeout: 30_000 });
      await captureVerified(page, info, vp.name, '08-not-authorized-other', 'AUTHENTIC', obs, { heading: 'Not authorized' }, { lesson: A, title: before.title });
      expect(obs.writes).toEqual([]);
    });
  });
}
