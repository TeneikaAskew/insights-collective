// ABOUTME: Lets a spec assert the right thing for a page's real visibility —
// ABOUTME: the gate when an admin has hidden it, the page content when not —
// ABOUTME: plus the allowlist that catches pages hidden by accident.
//
// WHY THIS EXISTS
// Page visibility is admin-controlled data in the shared production database.
// When an admin hides a section, VisibilityGate renders <ComingSoon/> instead
// of the route element (src/components/VisibilityGate.tsx:33) and the page
// never mounts — so a spec asserting that page's content fails even though
// nothing is broken. That is what happened when /assistants was hidden
// deliberately: e2e/navigation/route-parity.spec.ts went red on three PRs for
// a configuration change, with a ComingSoon screenshot as the only clue.
//
// Two wrong answers were available: delete the assertion (loses coverage), or
// stub every page visible (never exercises the gate, and an ACCIDENTAL hide
// would then be invisible to CI while real users saw the lock card).
//
// What we do instead: ask the live table what the acting role can actually see,
// and assert accordingly.
//   hidden  -> the visibility guard must render, and the page must NOT
//   visible -> the page's own content must render
// Neither state is a pass-by-default: a broken page still fails when visible,
// and a gate that stops gating still fails when hidden. assertExpectedHidden
// (e2e/navigation/live-visibility-config.spec.ts) separately fails when a page
// is hidden in production without a signed-off reason, so "hidden" can never
// quietly become an excuse.
//
// Reads only. Toggling real visibility from a spec is forbidden —
// admin-page-visibility.spec.ts:43-46 records the run that left the landing
// page hidden for every visitor.

import { expect, type Page } from '@playwright/test';
import { getAllManifestEntries, resolveGoverningPaths } from '../../src/config/pageManifest';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
// Same public anon key + fallback as e2e/fixtures/seed-check.ts:21-23 and
// src/config/security.ts. page_visibility has a public SELECT policy
// (supabase/migrations/20250702015100 "Everyone can view page visibility"),
// so an anon read is all this needs.
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';

/**
 * Sections intentionally hidden in the live database, with who decided and why.
 * The reviewable record of intent: anything hidden in production that is NOT
 * listed here fails live-visibility-config.spec.ts, so an accidental toggle
 * cannot pass as a deliberate one.
 */
export const EXPECTED_HIDDEN_PAGES: Record<string, string> = {
  '/assistants': 'Owner hid the AI Assistants section deliberately (2026-08-01).',
  '/teneika-linkedin': 'Owner keeps the LinkedIn archive hidden; see social-archives.spec.ts.',
};

export type VisibilityRow = {
  page_path: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
};

/** Which column decides for the acting role, mirroring PageVisibilityContext. */
export type ViewerRole = 'user' | 'instructor';

let cached: Promise<VisibilityRow[]> | null = null;

/** Reads page_visibility from the live database. Read-only; cached per worker. */
export function fetchLiveVisibility(): Promise<VisibilityRow[]> {
  if (!cached) {
    cached = (async () => {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/page_visibility?select=page_path,visible_to_users,visible_to_instructors`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
      );
      if (!res.ok) {
        throw new Error(
          `[visibility] Could not read page_visibility: ${res.status} ${await res.text()}`,
        );
      }
      return (await res.json()) as VisibilityRow[];
    })();
  }
  return cached;
}

/**
 * True when the live configuration hides `pathname` from the acting role.
 *
 * Uses the app's own resolver so aliases and parent/child chains agree with
 * production: /assistant-interface resolves to /assistants, and a child page is
 * hidden when any path in its governing chain is (AND semantics, matching
 * PageVisibilityContext). Paths outside the manifest are never gated.
 */
export async function isHiddenFromViewer(
  pathname: string,
  role: ViewerRole = 'user',
): Promise<boolean> {
  const governing = resolveGoverningPaths(pathname);
  if (governing.length === 0) return false;

  const rows = await fetchLiveVisibility();
  const byPath = new Map(rows.map(row => [row.page_path, row]));

  return governing.some(path => {
    const row = byPath.get(path);
    // No row means the page is unmanaged, which the app treats as visible.
    if (!row) return false;
    return role === 'instructor'
      ? !(row.visible_to_users || row.visible_to_instructors)
      : !row.visible_to_users;
  });
}

/**
 * Assert the visibility gate is what rendered: the Coming Soon card is on
 * screen and the routed page did not mount. Use this as the hidden-page branch
 * of a content spec so a hidden section still carries an assertion — if the
 * gate ever stops gating, this fails.
 */
export async function expectVisibilityGuard(page: Page): Promise<void> {
  await expect(page.getByTestId('coming-soon')).toBeVisible();
  await expect(page.getByRole('button', { name: /back to dashboard/i })).toBeVisible();
}

/**
 * Force every manifest page visible for this page's lifetime.
 *
 * Prefer isHiddenFromViewer + expectVisibilityGuard in content specs: branching
 * on the real config keeps the gate under test. Reach for this stub only when a
 * spec must get PAST the gate to exercise something else entirely — e.g.
 * asserting a route's AUTH guard, where a gated page would otherwise render
 * Coming Soon before the redirect can run.
 *
 * The context selects `*` and reads page_path / visible_to_users /
 * visible_to_instructors (src/contexts/PageVisibilityContext.tsx), so the rows
 * below carry those plus id and page_name. If the context starts reading a new
 * column, add it here — otherwise the stub answers with under-shaped rows and
 * the gate quietly mis-evaluates.
 */
export async function forceAllPagesVisible(page: Page): Promise<void> {
  const rows = getAllManifestEntries().map((entry, idx) => ({
    id: `e2e-visible-${idx}`,
    page_path: entry.page_path,
    page_name: entry.page_name,
    visible_to_users: true,
    visible_to_instructors: true,
  }));

  await page.route('**/rest/v1/page_visibility*', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      });
      return;
    }
    await route.continue();
  });
}

/**
 * Paths hidden from regular users in production that are not on the reviewed
 * allowlist. Empty array = production matches intent.
 */
export function unexpectedHiddenPaths(rows: VisibilityRow[]): string[] {
  return rows
    .filter(row => !row.visible_to_users)
    .map(row => row.page_path)
    .filter(path => !(path in EXPECTED_HIDDEN_PAGES))
    .sort();
}
