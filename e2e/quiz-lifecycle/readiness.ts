// ABOUTME: Positive readiness for the learner quiz lifecycle cases: the target item's heading and a mounted player state must be
// ABOUTME: visible together on the expected route (after the app's own course GET returned the expected course). Misses throw one fixed redacted line.
//
// Why: the cases waited only for "quiz-player-loading count 0", which is also true when the player never mounts. In run
// 41359219343 every case failed later, on radio "Four", with nothing that named the cause. That run itself established only
// that sign-in succeeded and that radio "Four" was missing; it carried no API, DOM or screenshot evidence. H1 (supported by
// source and a LOCAL-SHIM check, NOT observed in that run) is that the learner could not read the unpublished courses, so the
// learn page would have shown "Course not found".
//
// Target identity: CourseLearn renders the selected item's title as the lesson h1 and keys the player per item, so in the same
// React commit the heading changes, the previous item's player unmounts. Requiring, in ONE browser-side snapshot, the expected
// path, the expected item heading, a visible ready marker and no visible loading marker therefore proves the mounted player is
// the target's. The URL alone is not enough: history updates before React commits, so the previous player can still be on
// screen under the new URL.
//
// Redaction contract: the classification line carries only fixed tokens, booleans, HTTP status integers and PostgREST
// error codes from CODE_ALLOW. Never a response body, header, token, id, URL value, DOM text, error message or screenshot.
// Response bodies and navigation errors are inspected in memory only. This file adds no request of its own.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, Response } from '@playwright/test';
import {
  CODE_ALLOW, READY_TESTIDS, STATE_TESTIDS, HEADING_ALLOW, learnIds, isCourseGet, classifyCourseBody, readinessLine,
  classifyNavError, scenarioTitles, expectedItemTitle, type CourseGet, type NavResult,
} from './readiness-core';
export { CODE_ALLOW, READY_TESTIDS, HEADING_ALLOW, learnIds, isCourseGet, classifyCourseBody, readinessLine };

const FIXTURE_SQL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/local-stack/quiz-lifecycle/fixture.sql');
let titleCache: Record<string, string> | null = null;
function titleFor(itemId: string, override?: string): string | null {
  if (override) return override;
  if (!titleCache) { try { titleCache = scenarioTitles(fs.readFileSync(FIXTURE_SQL, 'utf8')); } catch { titleCache = {}; } }
  return expectedItemTitle(titleCache, itemId);
}

type Target = { course: string; item: string; title: string | null };

async function classifyCourseResponse(r: Response, course: string): Promise<CourseGet> {
  let text = '';
  try { text = await r.text(); } catch { text = ''; }
  return classifyCourseBody(r.status(), text, course);
}

/** Browser-side, single snapshot: expected path + expected heading + ready marker + no loading marker. */
async function targetReady(page: Page, t: Target, timeout: number): Promise<boolean> {
  if (!t.title) return false;
  try {
    await page.waitForFunction(({ item, title, ready }) => {
      const vis = (e: Element) => (e as HTMLElement).getClientRects().length > 0;
      if (!location.pathname.endsWith(`/${item}`)) return false;
      if (!Array.from(document.querySelectorAll('h1')).some((h) => vis(h) && (h.textContent || '').trim() === title)) return false;
      if (Array.from(document.querySelectorAll('[data-testid="quiz-player-loading"]')).some(vis)) return false;
      return ready.some((id: string) => Array.from(document.querySelectorAll(`[data-testid="${id}"]`)).some(vis));
    }, { item: t.item, title: t.title, ready: [...READY_TESTIDS] }, { timeout, polling: 100 });
    return true;
  } catch { return false; }
}

async function classifyPage(page: Page, label: string, t: Target, get: CourseGet, nav: NavResult): Promise<string> {
  try {
    let routeTemplate = false; let courseMatch = false; let itemMatch = false;
    try {
      const ids = learnIds(page.url());
      routeTemplate = true; courseMatch = ids.course === t.course; itemMatch = ids.item === t.item;
    } catch { /* not a learn route */ }
    const targetHeading = t.title ? await page.evaluate((title) => Array.from(document.querySelectorAll('h1'))
      .some((h) => (h as HTMLElement).getClientRects().length > 0 && (h.textContent || '').trim() === title), t.title).catch(() => false) : false;
    const headings: Record<string, boolean> = {};
    for (const h of HEADING_ALLOW) headings[h] = await page.getByText(h, { exact: true }).filter({ visible: true }).count().then((n) => n > 0, () => false);
    const states: Record<string, boolean> = {};
    for (const s of STATE_TESTIDS) states[s] = await page.getByTestId(s).filter({ visible: true }).count().then((n) => n > 0, () => false);
    return readinessLine(label, { nav, routeTemplate, courseMatch, itemMatch, targetHeading, get, headings, states });
  } catch {
    return `QLC-READINESS case=${label.replace(/[^A-Za-z0-9_-]/g, '_')} nav=${nav} classification=unavailable`;
  }
}

/**
 * Navigates to a learn URL and requires: the navigation completed, the app's own course GET returned 200 with the expected
 * course id, then the TARGET player is ready (targetReady). Any miss, including an aborted navigation, throws one
 * QLC-READINESS line and nothing else.
 */
export async function gotoReady(page: Page, url: string, label: string, timeout = 30000, title?: string) {
  const ids = learnIds(url);
  const t: Target = { course: ids.course, item: ids.item, title: titleFor(ids.item, title) };
  const seen = page.waitForResponse((r) => isCourseGet(r.request().method(), r.url(), t.course), { timeout })
    .then((r) => classifyCourseResponse(r, t.course), () => ({ observed: false }) as CourseGet);
  let nav: NavResult = 'ok';
  try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout }); } catch (e: any) { nav = classifyNavError(String(e?.message ?? '')); }
  const get = nav === 'ok' ? await seen : { observed: false };
  const courseOk = get.observed && get.status === 200 && get.id_match === true;
  const ready = nav === 'ok' && courseOk && (await targetReady(page, t, timeout));
  if (!ready) throw new Error(await classifyPage(page, label, t, get, nav));
}

/**
 * In-app navigation to a known item (no new course GET): requires the TARGET player ready on that item. A player still on
 * screen from the previous item does not pass. Misses throw one QLC-READINESS line and nothing else.
 */
export async function expectMounted(page: Page, label: string, expected: { course?: string; item: string; title?: string }, timeout = 30000) {
  let course = expected.course ?? '';
  if (!course) { try { course = learnIds(page.url()).course; } catch { course = ''; } }
  const t: Target = { course, item: expected.item, title: titleFor(expected.item, expected.title) };
  if (!(await targetReady(page, t, timeout))) throw new Error(await classifyPage(page, label, t, { observed: false }, 'not_attempted'));
}
