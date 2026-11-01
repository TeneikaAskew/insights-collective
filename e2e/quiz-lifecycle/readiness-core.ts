// ABOUTME: Pure, browser-free parts of the quiz lifecycle readiness check (classification and the redacted line), so they
// ABOUTME: are unit-tested under vitest. No Playwright import; see readiness.ts for the redaction contract.
const LEARN = /^\/courses\/([^/]+)\/learn\/([^/]+)\/([^/]+)$/;
export const CODE_ALLOW = ['PGRST116', 'PGRST301', 'PGRST303', '42501', '42P01'] as const;
// Mounted (positive) player states. quiz-player-empty and the error states are NOT ready.
export const READY_TESTIDS = ['quiz-player-active', 'quiz-player-review', 'quiz-player-exhausted'] as const;
export const STATE_TESTIDS = ['quiz-player-loading', 'quiz-player-empty', ...READY_TESTIDS] as const;
// Fixed headings, matched exactly; only their visibility is reported.
export const HEADING_ALLOW = [
  'Course not found',
  "Couldn't load this quiz",
  "Couldn't restore your saved answers",
  "Couldn't start this quiz",
] as const;

export type CourseGetCode = (typeof CODE_ALLOW)[number] | 'other' | 'none';
// One flat shape (no discriminated union: the repo compiles without strictNullChecks).
export type CourseGet = { observed: boolean; status?: number; code?: CourseGetCode; id_match?: boolean };

/** Parses a learn URL path into its three ids. */
export function learnIds(pathOrUrl: string): { course: string; module: string; item: string } {
  const p = pathOrUrl.startsWith('http') ? new URL(pathOrUrl).pathname : pathOrUrl;
  const m = LEARN.exec(p);
  if (!m) throw new Error('readiness: not a learn path');
  return { course: m[1], module: m[2], item: m[3] };
}

/** True for exactly the app's single-course read: GET /rest/v1/courses with id=eq.<course>. */
export function isCourseGet(method: string, url: string, course: string): boolean {
  if (method !== 'GET') return false;
  const u = new URL(url);
  return u.pathname === '/rest/v1/courses' && u.searchParams.get('id') === `eq.${course}`;
}

/** Reduces a course GET response to the redacted shape. The body never leaves this function. */
export function classifyCourseBody(status: number, bodyText: string, course: string): CourseGet {
  let body: any = null;
  try { body = JSON.parse(bodyText); } catch { body = null; }
  const raw = body && typeof body === 'object' && !Array.isArray(body) && typeof body.code === 'string' ? body.code : null;
  const code: CourseGetCode = raw === null ? 'none' : (CODE_ALLOW as readonly string[]).includes(raw) ? (raw as (typeof CODE_ALLOW)[number]) : 'other';
  const row = Array.isArray(body) ? body[0] : body;
  const id_match = status === 200 && !!row && typeof row === 'object' && row.id === course;
  return { observed: true, status, code, id_match };
}

export type NavResult = 'ok' | 'aborted' | 'timeout' | 'failed' | 'not_attempted';

/** Reduces a navigation error to a fixed token. The message is inspected here and never returned. */
export function classifyNavError(message: string): NavResult {
  if (/net::ERR_ABORTED/.test(message)) return 'aborted';
  if (/timeout/i.test(message)) return 'timeout';
  return 'failed';
}

/** Scenario titles from fixture.sql's scenario VALUES rows: ('nn', 'title', ...). */
export function scenarioTitles(fixtureSql: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of fixtureSql.matchAll(/^\s+\('([0-9a-f]{2})', '([^']+)',/gm)) out[m[1]] = m[2];
  return out;
}

/** The learn-page heading of a synthetic quiz item (content_items.title = 'QLC ' || title), or null if unknown. */
export function expectedItemTitle(titles: Record<string, string>, itemId: string): string | null {
  const m = /^9c00([0-9a-f]{2})01-0000-4000-8000-000000000000$/.exec(itemId);
  return m && titles[m[1]] ? `QLC ${titles[m[1]]}` : null;
}

/** One fixed-format line; every value is a fixed token, boolean or integer. */
export function readinessLine(label: string, f: {
  nav?: NavResult; routeTemplate: boolean; courseMatch: boolean; itemMatch: boolean; targetHeading?: boolean;
  get: CourseGet; headings: Record<string, boolean>; states: Record<string, boolean>;
}): string {
  const get = f.get.observed ? `status=${Number.isInteger(f.get.status) ? f.get.status : -1} code=${f.get.code} id_match=${f.get.id_match}` : 'not_observed';
  const heads = HEADING_ALLOW.map((h, i) => `h${i}=${f.headings[h] ? 1 : 0}`).join(',');
  const states = STATE_TESTIDS.map((t) => `${t.replace('quiz-player-', '')}=${f.states[t] ? 1 : 0}`).join(',');
  return `QLC-READINESS case=${label.replace(/[^A-Za-z0-9_-]/g, '_')} nav=${f.nav ?? 'not_attempted'} route_template=${f.routeTemplate} `
    + `course_match=${f.courseMatch} item_match=${f.itemMatch} target_heading=${f.targetHeading === true} `
    + `course_get[${get}] headings[${heads}] states[${states}]`;
}
