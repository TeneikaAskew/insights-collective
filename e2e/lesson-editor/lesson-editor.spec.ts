// ABOUTME: Real-backend, real-TipTap acceptance for lesson save/reload persistence on the ISOLATED LOCAL stack (fixture personas).
// ABOUTME: No route stubs; every claim is paired with a loopback DB readback through scripts/local-stack/lesson-editor/run.sh.
//
// Tier: authentic isolated local Supabase (supabase start, loopback) + the built app. NOT production, NOT the deployed backend.
// Run only with playwright.lesson-editor.config.ts after `run.sh setup` (personas, fixture, backend contract) has passed.
// Fault injection is labelled per case, never hidden:
//   AUTHENTIC        real request to the local stack, real response
//   BROWSER-OFFLINE  context.setOffline(true): the browser genuinely has no network (no response is faked)
//   RLS-ZERO-ROW     real RLS denial produced by moving fixture course C1 to persona OTHER (run.sh owner)
//   SECOND-TAB       a second page in the same signed-in context writes first (real conflict on the real trigger)
//   RELOAD           page.reload() after an unconfirmed send; the fresh document restores from sessionStorage
// No page.route() / context.route() is installed anywhere in this file.
// Writes: only fixture rows ed170000-... (course C1). The fixture is applied once per fresh stack; tests read the current DB
// state instead of assuming seed titles, so the order of tests never matters for correctness.
import { test, expect } from '@playwright/test';
import type { Page, TestInfo, BrowserContext, Request } from '@playwright/test';
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
};
const LOOPBACK = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(x.hostname) && x.pathname === '/';
  } catch {
    return false;
  }
};
const LABEL_CHECK = validateLabels(process.env);
const LABELS = LABEL_CHECK.labels;

const C1 = 'ed170000-0000-4000-8000-0000000000c1';
const A = 'ed170000-0000-4000-8000-0000000000a1';
const B = 'ed170000-0000-4000-8000-0000000000a2';
const N = 'ed170000-0000-4000-8000-0000000000a3';
const Q = 'ed170000-0000-4000-8000-0000000000a4';
const MISSING = 'ed170000-0000-4000-8000-0000000000ff';

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
] as const;
type Mode = 'AUTHENTIC' | 'BROWSER-OFFLINE' | 'RLS-ZERO-ROW' | 'SECOND-TAB' | 'RELOAD';

type Persona = { id: string; email: string };
const personas = (): Record<'OWNER' | 'OTHER' | 'STUDENT', Persona> => JSON.parse(readFileSync(path.join(ENV.work, 'personas.json'), 'utf8'));
const stateFor = (p: 'OWNER' | 'OTHER' | 'STUDENT') => path.join(ENV.work, `state-${p}.json`);

// ---------- guarded DB access (loopback only, fixture ids only, through the reviewed runner) ----------
function runner(args: string[]): string {
  return execFileSync(RUNNER, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }).trim();
}
type DbRow = { id: string; title: string; content: string; type: string; published: boolean; updated_at: string | null };
const dbLesson = (id: string): DbRow => JSON.parse(runner(['read', ENV.db, id]));
const quizHash = () => runner(['quizhash', ENV.db]);
const setOwner = (who: 'OWNER' | 'OTHER') => runner(['owner', ENV.db, ENV.work, who]);

// ---------- API observation: method/path/status only, plus the PATCH response row for content_items ----------
type Call = { start: number; end: number; method: string; path: string; status: number; lessonId: string | null; row: DbRow | null };
function observe(page: Page) {
  const calls: Call[] = [];
  const foreign: string[] = [];
  const api = new URL(ENV.api).origin;
  page.on('requestfinished', async (req: Request) => {
    const u = new URL(req.url());
    if (!/^\/(rest|auth|functions|storage)\/v1\//.test(u.pathname)) return;
    if (u.origin !== api) {
      foreign.push(`${httpMethod(req.method())} ${apiPath(u.pathname)}`);
      return;
    }
    const res = await req.response();
    const t = req.timing();
    const call: Call = {
      start: t.startTime, end: t.startTime + Math.max(t.responseEnd, 0),
      method: httpMethod(req.method()), path: apiPath(u.pathname), status: res?.status() ?? 0,
      lessonId: (u.searchParams.get('id') || '').replace(/^eq\./, '') || null, row: null,
    };
    if (call.method === 'PATCH' && call.path === '/rest/v1/content_items' && res) {
      try {
        const body = await res.json();
        call.row = Array.isArray(body) ? (body[0] ?? null) : body;
      } catch {
        call.row = null;
      }
    }
    calls.push(call);
  });
  const writes = (id?: string) => calls.filter((c) => c.method === 'PATCH' && c.path === '/rest/v1/content_items' && (!id || c.lessonId === id));
  return { calls, foreign, writes };
}
type Obs = ReturnType<typeof observe>;
const sha = (s: string | null) => createHash('sha256').update(s ?? '').digest('hex').slice(0, 16);
const rowEvidence = (r: DbRow | null) => r && { id: r.id, type: r.type, updated_at: r.updated_at, titleSha: sha(r.title), contentSha: sha(r.content) };

async function capture(page: Page, info: TestInfo, vp: string, shot: string, mode: Mode, obs: Obs, db: Record<string, unknown>) {
  const name = `${LABELS.commit.slice(0, 12)}__${vp}__${shot}__retry${info.retry}`;
  await info.attach(`${name}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  const entry = {
    tier: 'authentic isolated LOCAL stack (NOT mocked, NOT production, NOT the deployed backend)', faultInjection: mode, routeStubs: 0,
    commit: LABELS.commit, environment: LABELS.environment, viewport: vp, shot, path: new URL(page.url()).pathname,
    api: obs.calls.map(({ method, path, status, lessonId }) => ({ method, path, status, lessonId })), foreignApi: obs.foreign,
    db, capturedAt: new Date().toISOString(),
  };
  await info.attach(`${name}.json`, { body: Buffer.from(JSON.stringify(entry, null, 2)), contentType: 'application/json' });
  expect(obs.foreign, 'no API call may leave the loopback stack').toEqual([]);
}

// ---------- UI helpers (every read filtered to the visible presentation) ----------
const builder = (lesson?: string) => `/courses/${C1}/builder?view=lesson${lesson ? `&lesson=${lesson}` : ''}`;
const title = (page: Page) => page.locator('#lesson-title:visible');
const status = (page: Page) => page.locator('[data-testid="lesson-save-status"]:visible');
const editor = (page: Page) => page.locator('.ProseMirror:visible').first(); // the real TipTap surface
const preview = (page: Page) => page.locator('[data-onboarding="builder-preview"]:visible').first();
const mirrorKey = (userId: string, lesson: string) => `ic.builder.lessonDraft.v2.${userId}:${C1}.${lesson}`;
const leaveHandled = new WeakSet<Page>();
async function openLesson(page: Page, lesson: string) {
  if (!leaveHandled.has(page)) {
    // A reload with unconfirmed changes raises the app's beforeunload prompt; Playwright would dismiss it (and cancel the
    // reload). Accept only that prompt, so RELOAD cases really load a new document; any other dialog is a failure.
    page.on('dialog', (d) => (d.type() === 'beforeunload' ? d.accept() : d.dismiss()));
    leaveHandled.add(page);
  }
  const expected = dbLesson(lesson).title;
  await page.goto(builder(lesson));
  await expect(title(page)).toHaveValue(expected, { timeout: 30_000 });
  await expect(editor(page)).toBeVisible();
}
async function outline(page: Page, lesson: string) {
  await page.getByRole('button', { name: dbLesson(lesson).title, exact: true }).filter({ visible: true }).first().click();
}
async function typeInBody(page: Page, text: string) {
  await editor(page).click();
  await page.keyboard.press('End');
  await page.keyboard.type(text);
}
async function saved(page: Page) {
  await expect(status(page)).toHaveAttribute('data-status', 'saved', { timeout: 20_000 });
}
const mirror = (page: Page, key: string) => page.evaluate((k) => window.sessionStorage.getItem(k), key);

test.describe.configure({ mode: 'serial' });

let ready = false;
test.beforeAll(() => {
  expect(LABEL_CHECK.problems, 'evidence labels must be valid').toEqual([]);
  for (const [k, v] of Object.entries(ENV)) expect(v, `LE_* ${k} must be set`).not.toBe('');
  expect(LOOPBACK(ENV.app), 'LE_APP_ORIGIN must be a loopback http origin').toBe(true);
  expect(LOOPBACK(ENV.api), 'LE_API_ORIGIN must be a loopback http origin').toBe(true);
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

  test('E1 save: the returned row is exactly the stored row, the trigger advanced the version, reload keeps it', async ({ page }, info) => {
    const obs = observe(page);
    await openLesson(page, A);
    const before = dbLesson(A);
    await title(page).fill('E1 saved title');
    await typeInBody(page, ' E1 body');
    await saved(page);
    const stored = dbLesson(A);
    const last = obs.writes(A).at(-1)!;
    expect(last.status).toBe(200);
    expect(last.row, 'PATCH returned the row').not.toBeNull();
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

  test('E2 quick navigation inside 800 ms: switch lesson, Preview, Back, reload', async ({ page }) => {
    const obs = observe(page);
    await openLesson(page, A);
    await title(page).fill('E2 switch');
    await outline(page, B); // well inside the 800 ms debounce
    await expect(title(page)).toHaveValue(dbLesson(B).title);
    await expect.poll(() => dbLesson(A).title, { timeout: 20_000 }).toBe('E2 switch');

    await title(page).fill('E2 preview');
    await preview(page).click(); // immediately
    await expect(page).toHaveURL(new RegExp(`/courses/${C1}/learn`), { timeout: 20_000 });
    expect(dbLesson(B).title, 'saved before the navigation completed').toBe('E2 preview');
    await page.goBack();
    await expect(page).toHaveURL(/\/builder/);
    await page.reload();
    await expect(title(page)).toHaveValue('E2 preview', { timeout: 30_000 });
    expect(obs.writes().every((w) => w.status === 200)).toBe(true);
    for (const id of [A, B]) {
      const ws = obs.writes(id).sort((x, y) => x.start - y.start);
      for (let i = 1; i < ws.length; i++) expect(ws[i].start, `writes for ${id} never overlap`).toBeGreaterThanOrEqual(ws[i - 1].end);
    }
  });

  test('E3 offline: "Save not confirmed", draft kept, leave warning, retry fences then persists the latest draft', async ({ page, context }) => {
    await openLesson(page, A);
    const before = dbLesson(A);
    await context.setOffline(true); // BROWSER-OFFLINE
    await title(page).fill('E3 offline draft');
    await expect(status(page)).toHaveAttribute('data-status', 'error', { timeout: 20_000 });
    await expect(status(page)).toContainText(/offline/i);
    expect(dbLesson(A).title, 'nothing reached the server').toBe(before.title);
    await preview(page).click();
    await expect(page.getByText('Lesson changes are not saved')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Stay and retry' }).click();
    await expect(page).toHaveURL(/\/builder/);
    await expect(title(page)).toHaveValue('E3 offline draft');
    await context.setOffline(false);
    await status(page).getByRole('button', { name: /retry save/i }).click();
    await saved(page);
    expect(dbLesson(A).title).toBe('E3 offline draft');
  });

  test('E4 reload after an unconfirmed send: the fresh page restores the draft, reconciles, then saves it', async ({ page, context }) => {
    const owner = personas().OWNER;
    await openLesson(page, B);
    await context.setOffline(true);
    await title(page).fill('E4 restored after reload');
    await expect(status(page)).toHaveAttribute('data-status', 'error', { timeout: 20_000 });
    expect(await mirror(page, mirrorKey(owner.id, B)), 'durable record written before the send').not.toBeNull();
    await context.setOffline(false);
    await page.reload(); // RELOAD: new document, same sessionStorage
    await expect(page.getByTestId('lesson-recovered-notice').filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    await expect(title(page)).toHaveValue('E4 restored after reload');
    // Restored as uncertain: the queue reconciles and fences before calling it saved.
    await saved(page);
    expect(dbLesson(B).title).toBe('E4 restored after reload');
    await expect.poll(() => mirror(page, mirrorKey(owner.id, B)), { timeout: 10_000 }).toBeNull();
  });

  test('E5 a lesson with a NULL version saves through the IS NULL condition', async ({ page }) => {
    expect(dbLesson(N).updated_at === null || typeof dbLesson(N).updated_at === 'string').toBe(true);
    const wasNull = dbLesson(N).updated_at === null;
    await openLesson(page, N);
    await title(page).fill('E5 first save');
    await saved(page);
    const row = dbLesson(N);
    expect(row.title).toBe('E5 first save');
    expect(row.updated_at, 'the trigger set a version').not.toBeNull();
    test.info().annotations.push({ type: 'null-version', description: wasNull ? 'started NULL (fixture)' : 'already versioned (rerun)' });
  });

  test('E6 second tab saves first: explicit conflict, no overwrite; Keep my version then wins', async ({ page, context }) => {
    await openLesson(page, A);
    const tab2 = await context.newPage(); // SECOND-TAB
    await openLesson(tab2, A);
    await title(tab2).fill('E6 tab two');
    await saved(tab2);
    const afterTab2 = dbLesson(A);
    await title(page).fill('E6 tab one');
    await expect(status(page)).toHaveAttribute('data-status', 'conflict', { timeout: 20_000 });
    expect(dbLesson(A).title, 'tab one did not overwrite').toBe('E6 tab two');
    await status(page).getByRole('button', { name: 'Keep my version' }).click();
    await saved(page);
    const final = dbLesson(A);
    expect(final.title).toBe('E6 tab one');
    expect(new Date(final.updated_at!) > new Date(afterTab2.updated_at!)).toBe(true);
    await tab2.close();
  });

  test('E7 zero rows by real RLS: no false success, draft kept, retry after access returns', async ({ page }) => {
    await openLesson(page, B);
    const before = dbLesson(B);
    setOwner('OTHER'); // RLS-ZERO-ROW
    try {
      await title(page).fill('E7 denied draft');
      await expect(status(page)).toHaveAttribute('data-status', 'error', { timeout: 20_000 });
      await expect(status(page)).toContainText(/no longer have access|changed no rows/i);
      expect(dbLesson(B).title).toBe(before.title);
    } finally {
      setOwner('OWNER');
    }
    await status(page).getByRole('button', { name: /retry save/i }).click();
    await saved(page);
    expect(dbLesson(B).title).toBe('E7 denied draft');
  });

  test('E8 quiz lesson: type is fixed, a rename keeps the type and the quiz and question rows', async ({ page }) => {
    const before = quizHash();
    await openLesson(page, Q);
    await expect(page.locator('#lesson-type:visible')).toBeDisabled();
    await title(page).fill(`Graded quiz (E8 ${Date.now() % 1000})`);
    await saved(page);
    const row = dbLesson(Q);
    expect(row.type).toBe('quiz');
    expect(quizHash(), 'quiz, questions and submissions unchanged').toBe(before);
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
    test(`R-${who}: builder shows Not authorized and sends zero lesson writes`, async ({ page }) => {
      const obs = observe(page);
      const before = { A: dbLesson(A), B: dbLesson(B) };
      await page.goto(builder(A));
      await expect(page.getByRole('heading', { name: 'Not authorized' })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.ProseMirror:visible')).toHaveCount(0);
      await page.waitForTimeout(1500); // longer than the save debounce
      expect(obs.writes(), 'no content_items write').toEqual([]);
      expect({ A: dbLesson(A), B: dbLesson(B) }).toEqual(before);
    });
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`recovery screens @ ${vp.name}`, () => {
    test.use({ storageState: stateFor('OWNER'), viewport: { width: vp.width, height: vp.height } });
    test('deep link, saved, offline not confirmed, leave warning, restored after reload, conflict, fixed type', async ({ page, context }, info) => {
      const obs = observe(page);
      await openLesson(page, B);
      await capture(page, info, vp.name, '01-deep-link', 'AUTHENTIC', obs, { B: rowEvidence(dbLesson(B)) });

      await title(page).fill(`Saved at ${vp.name}`);
      await typeInBody(page, ` ${vp.name}`);
      await saved(page);
      await capture(page, info, vp.name, '02-saved', 'AUTHENTIC', obs, { B: rowEvidence(dbLesson(B)) });

      await context.setOffline(true);
      await title(page).fill(`Offline at ${vp.name}`);
      await expect(status(page)).toHaveAttribute('data-status', 'error', { timeout: 20_000 });
      await capture(page, info, vp.name, '03-not-confirmed', 'BROWSER-OFFLINE', obs, { B: rowEvidence(dbLesson(B)) });
      await preview(page).click();
      await expect(page.getByText('Lesson changes are not saved')).toBeVisible({ timeout: 20_000 });
      await capture(page, info, vp.name, '04-leave-warning', 'BROWSER-OFFLINE', obs, { B: rowEvidence(dbLesson(B)) });
      await page.getByRole('button', { name: 'Stay and retry' }).click();
      await context.setOffline(false);
      await page.reload();
      await expect(page.getByTestId('lesson-recovered-notice').filter({ visible: true })).toBeVisible({ timeout: 30_000 });
      await capture(page, info, vp.name, '05-restored-after-reload', 'RELOAD', obs, { B: rowEvidence(dbLesson(B)) });
      await saved(page);
      expect(dbLesson(B).title).toBe(`Offline at ${vp.name}`);

      const tab2 = await context.newPage();
      await openLesson(tab2, B);
      await title(tab2).fill(`Tab two at ${vp.name}`);
      await saved(tab2);
      await tab2.close();
      await title(page).fill(`Tab one at ${vp.name}`);
      await expect(status(page)).toHaveAttribute('data-status', 'conflict', { timeout: 20_000 });
      await capture(page, info, vp.name, '06-conflict', 'SECOND-TAB', obs, { B: rowEvidence(dbLesson(B)) });
      await status(page).getByRole('button', { name: 'Use the saved version' }).click();
      await saved(page);
      expect(dbLesson(B).title).toBe(`Tab two at ${vp.name}`);

      await openLesson(page, Q);
      await expect(page.locator('#lesson-type:visible')).toBeDisabled();
      await capture(page, info, vp.name, '07-type-fixed', 'AUTHENTIC', obs, { quiz: rowEvidence(dbLesson(Q)), quizHash: quizHash() });
    });
  });

  test.describe(`not-authorized screen @ ${vp.name}`, () => {
    test.use({ storageState: stateFor('OTHER'), viewport: { width: vp.width, height: vp.height } });
    test('another instructor sees Not authorized', async ({ page }, info) => {
      const obs = observe(page);
      await page.goto(builder(A));
      await expect(page.getByRole('heading', { name: 'Not authorized' })).toBeVisible({ timeout: 30_000 });
      await capture(page, info, vp.name, '08-not-authorized-other', 'AUTHENTIC', obs, {});
      expect(obs.writes()).toEqual([]);
    });
  });
}
