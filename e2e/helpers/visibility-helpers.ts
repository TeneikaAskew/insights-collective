// ABOUTME: Reads the live page_visibility table so a spec can tell an
// ABOUTME: intentionally hidden page from one hidden by accident.
//
// WHY THIS EXISTS
// Page visibility is admin-controlled data in the shared production database.
// When an admin hides a section, VisibilityGate renders <ComingSoon/> instead
// of the route element (src/components/VisibilityGate.tsx:33) and the page
// never mounts. Specs have to cope with that, and they now do — by comparing
// aliases against their canonical route (navigation/route-parity.spec.ts), or
// by skipping with a reason (helpers/mobile-overflow.ts:141).
//
// Both of those are the right call for a DELIBERATE toggle. Neither can tell a
// deliberate toggle from an accidental one, and that is the gap this closes: a
// page switched off by mistake would quietly stop being measured, while real
// users sat in front of the lock card.
//
// EXPECTED_HIDDEN_PAGES is the reviewable record of intent, and
// navigation/live-visibility-config.spec.ts fails when production disagrees
// with it in either direction. Hiding a page on purpose is a two-step act:
// flip it in the admin UI, then add it here with a reason.
//
// Reads only. Toggling real visibility from a spec is forbidden —
// admin-page-visibility.spec.ts:43-46 records the run that left the landing
// page hidden for every visitor.
//
// stopAtGuard() below is the third coping strategy, for specs that assert a
// page's CONTENT: when the section is hidden it asserts the gate instead and
// tells the caller to stop. Without it those specs did not fail — they passed
// against the lock card, because "main is visible", "a heading is visible" and
// "no spinners" are all true of ComingSoon. Seven of the eight assistants tests
// were green that way while testing nothing about assistants.

import { expect, type Page } from '@playwright/test';
import { resolveGoverningPaths } from '../../src/config/pageManifest';

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
 * Sections intentionally hidden in the live database, and why. Anything hidden
 * in production that is not listed here fails live-visibility-config.spec.ts,
 * so an accidental toggle cannot pass as a deliberate one.
 */
export const EXPECTED_HIDDEN_PAGES: Record<string, string> = {
  '/assistants': 'Owner hid the AI Assistants section deliberately (2026-08-01).',
  '/teneika-linkedin': 'Owner keeps the LinkedIn archive hidden; see resources/social-archives.spec.ts.',
};

export type VisibilityRow = {
  page_path: string;
  visible_to_users: boolean;
  visible_to_instructors: boolean;
};

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

/** Which column decides for the acting role, mirroring PageVisibilityContext. */
export type ViewerRole = 'user' | 'instructor';

/**
 * True when the live configuration hides `pathname` from the acting role.
 *
 * Uses the app's own resolver so aliases and parent/child chains agree with
 * production: /assistant-interface resolves to /assistants, and a child page is
 * hidden when any path in its governing chain is. Paths outside the manifest
 * are never gated.
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
    // No row means unmanaged, which the app treats as visible.
    if (!row) return false;
    return role === 'instructor'
      ? !(row.visible_to_users || row.visible_to_instructors)
      : !row.visible_to_users;
  });
}

/**
 * Assert the visibility gate is what rendered: the Coming Soon card is on
 * screen, with its way back. Use as the hidden branch of a content spec so a
 * hidden section still carries a real assertion — if the gate ever stops
 * gating, this fails.
 */
export async function expectVisibilityGuard(page: Page): Promise<void> {
  await expect(page.getByTestId('coming-soon')).toBeVisible();
  await expect(page.getByRole('button', { name: /back to dashboard/i })).toBeVisible();
}

/**
 * The one-liner for content specs: if the section is hidden, assert the gate and
 * return true so the caller stops before its content assertions.
 *
 *   if (await stopAtGuard(page, Routes.assistants)) return;
 *   ...content assertions...
 *
 * Restoring the section in Admin → Page Visibility turns the content assertions
 * back on with no code change, and live-visibility-config.spec.ts independently
 * fails if a page is hidden without a signed-off reason — so this can never
 * become a quiet way to drop coverage.
 */
export async function stopAtGuard(
  page: Page,
  pathname: string,
  role: ViewerRole = 'user',
): Promise<boolean> {
  if (!(await isHiddenFromViewer(pathname, role))) return false;
  await expectVisibilityGuard(page);
  return true;
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

/**
 * Allowlisted paths that are no longer hidden. Keeps the list from decaying
 * into a blanket exemption that would mask a future accidental hide.
 */
export function staleAllowlistEntries(rows: VisibilityRow[]): string[] {
  const hidden = new Set(
    rows.filter(row => !row.visible_to_users).map(row => row.page_path),
  );
  return Object.keys(EXPECTED_HIDDEN_PAGES)
    .filter(path => !hidden.has(path))
    .sort();
}
