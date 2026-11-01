// ABOUTME: Positive readiness for the learner quiz lifecycle cases: the learn page's own course GET must return the expected
// ABOUTME: synthetic course, and a mounted player state must be visible. Failures throw one fixed, redacted classification line.
//
// Why: run 41359219343 waited only for "quiz-player-loading count 0", which is vacuously true when the player never mounts
// (the learner could not read an unpublished course, so CourseLearn rendered "Course not found"). Every case then failed
// later, on radio "Four", with nothing that named the cause.
//
// Redaction contract: the classification line carries only fixed tokens, booleans, HTTP status integers and PostgREST
// error codes from CODE_ALLOW. Never a response body, header, token, id, URL value, DOM text or screenshot. Response
// bodies are parsed in memory only to compute `code` (allowlisted) and `id_match` (boolean). This file adds no request
// of its own: it observes the GET the app already makes.
import type { Page, Response } from '@playwright/test';
import { expect } from '../fixtures/console-errors.fixture';

import {
  CODE_ALLOW, READY_TESTIDS, STATE_TESTIDS, HEADING_ALLOW, learnIds, isCourseGet, classifyCourseBody, readinessLine,
  type CourseGet,
} from './readiness-core';
export { CODE_ALLOW, READY_TESTIDS, HEADING_ALLOW, learnIds, isCourseGet, classifyCourseBody, readinessLine };

async function classifyCourseResponse(r: Response, course: string): Promise<CourseGet> {
  let text = '';
  try { text = await r.text(); } catch { text = ''; }
  return classifyCourseBody(r.status(), text, course);
}

async function classifyPage(page: Page, label: string, expected: { course: string; item: string }, get: CourseGet) {
  let routeTemplate = false; let courseMatch = false; let itemMatch = false;
  try {
    const ids = learnIds(page.url());
    routeTemplate = true; courseMatch = ids.course === expected.course; itemMatch = ids.item === expected.item;
  } catch { /* not a learn route */ }
  const headings: Record<string, boolean> = {};
  for (const h of HEADING_ALLOW) headings[h] = await page.getByText(h, { exact: true }).filter({ visible: true }).count().then((n) => n > 0, () => false);
  const states: Record<string, boolean> = {};
  for (const t of STATE_TESTIDS) states[t] = await page.getByTestId(t).filter({ visible: true }).count().then((n) => n > 0, () => false);
  return readinessLine(label, { routeTemplate, courseMatch, itemMatch, get, headings, states });
}

async function waitMounted(page: Page, timeout: number): Promise<boolean> {
  const sel = READY_TESTIDS.map((t) => `[data-testid="${t}"]:visible`).join(', ');
  try { await page.locator(sel).first().waitFor({ state: 'visible', timeout }); return true; } catch { return false; }
}

/**
 * Navigates to a learn URL and requires, in order: the app's own course GET returned 200 with the expected course id,
 * then a mounted player state. Any miss throws one QLC-READINESS line (redacted, fixed format).
 */
export async function gotoReady(page: Page, url: string, label: string, timeout = 30000) {
  const expected = learnIds(url);
  let get: CourseGet = { observed: false };
  const seen = page.waitForResponse((r) => isCourseGet(r.request().method(), r.url(), expected.course), { timeout })
    .then((r) => classifyCourseResponse(r, expected.course), () => ({ observed: false }) as CourseGet);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  get = await seen;
  const courseOk = get.observed && get.status === 200 && get.id_match;
  const mounted = courseOk && (await waitMounted(page, timeout));
  if (!courseOk || !mounted) throw new Error(await classifyPage(page, label, expected, get));
}

/** In-app navigation (no new course GET): requires a mounted player state on the expected item. */
export async function expectMounted(page: Page, label: string, timeout = 30000) {
  const mounted = await waitMounted(page, timeout);
  if (!mounted) {
    let expected = { course: '', item: '' };
    try { expected = learnIds(page.url()); } catch { /* reported as route_template=false */ }
    throw new Error(await classifyPage(page, label, expected, { observed: false }));
  }
  await expect(page.getByTestId('quiz-player-loading')).toHaveCount(0);
}
