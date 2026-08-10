// ABOUTME: Fails when a route a signed-out visitor can reach issues a query that
// ABOUTME: can never succeed for them. Lives under e2e/auth/ — chromium-public's path.
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { SupabaseIssue } from '../../src/integrations/supabase/instrumentation';
import { structuralIssues, describeIssue } from '../../src/integrations/supabase/issue-triage';

/**
 * Why this exists
 * ---------------
 * CTASection read `enrollments` — a table `anon` holds no grant on — from the
 * home page, which only ever renders for anonymous visitors. It failed 42501 on
 * every load for months. Nothing caught it:
 *
 *   • the console fixture's app-logger rule suppressed the message;
 *   • issue-triage did not count 42501 as structural (it does now);
 *   • the replay audit marks a shape OK when *any* role can run it, and admin
 *     can read enrollments, so `anon`'s 42501 was recorded as a pass;
 *   • no spec visited the section at all.
 *
 * The first three are fixed, but each only helps where a test already goes. This
 * sweep is the coverage half: it walks every parameterless route App.tsx does
 * not wrap in <ProtectedRoute> and reads the app's own instrumentation, so a new
 * public page is checked the day it is added rather than the day someone writes
 * a spec for it.
 *
 * Signed out deliberately. The point is what the *anonymous* role can do, and a
 * session would mask precisely the failures being looked for.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '../../src/App.tsx');

/**
 * Routes reachable without a session: a `<Route path=…>` whose element is not
 * wrapped in <ProtectedRoute>. Parameterised paths are excluded — a fabricated
 * id produces a 404 or an empty page, which measures nothing.
 *
 * Parsed from App.tsx rather than listed here so a new public route joins the
 * sweep automatically. That is the whole point: a hand-maintained list would
 * have to be updated by the same change that introduces the defect.
 */
function publicRoutes(): string[] {
  const src = fs.readFileSync(APP, 'utf8');
  const found = new Set<string>();
  for (const m of src.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g)) {
    const [, route, element] = m;
    if (element.includes('ProtectedRoute')) continue;
    if (route.includes(':') || route.includes('*')) continue;
    found.add(route);
  }
  return [...found].sort();
}

const ROUTES = publicRoutes();

test('App.tsx still declares routes in the shape this sweep parses', () => {
  // A refactor to <Route> that this regex stops matching would empty ROUTES and
  // turn the whole sweep green by rendering it vacuous.
  expect(ROUTES.length, 'no public routes parsed out of App.tsx').toBeGreaterThan(20);
  expect(ROUTES, 'the landing page should always be public').toContain('/');
});

for (const route of ROUTES) {
  test(`${route} issues no query that anon can never run`, async ({ page }) => {
    await page.goto(route);
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        return !!root && root.children.length > 0;
      },
      undefined,
      { timeout: 15_000 },
    );
    // Sections mount on scroll and queries fire after first paint, so give the
    // page a chance to make its requests before reading what it made.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const issues: SupabaseIssue[] = await page
      .evaluate(() => (window as unknown as { __supabaseIssues?: SupabaseIssue[] }).__supabaseIssues ?? [])
      .catch(() => []);

    const structural = structuralIssues(issues);
    expect(
      structural,
      `${route} made ${structural.length} request(s) a signed-out visitor can never satisfy:\n` +
        `${structural.map(describeIssue).join('\n')}\n\n` +
        `Either the page should not ask for this while signed out, or the data it\n` +
        `needs should come from an aggregate the anon role may read.`,
    ).toEqual([]);
  });
}
