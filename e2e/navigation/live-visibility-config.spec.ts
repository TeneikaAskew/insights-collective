// ABOUTME: Fails when production hides a page that nobody signed off on —
// ABOUTME: the counterweight to the force-visible stubs used by content specs.
//
// Content specs stub page_visibility force-visible (see
// e2e/helpers/visibility-helpers.ts) so an intentional admin toggle cannot
// redden the suite. That trade opens exactly one hole: a page hidden BY
// ACCIDENT would also stop reddening anything, and real users would sit in
// front of a "Coming Soon" card while CI stayed green.
//
// This spec closes it. It reads the live table and compares against
// EXPECTED_HIDDEN_PAGES, which is the reviewed record of intent. Hiding a page
// on purpose is a two-step act: flip it in the admin UI, add it here with a
// reason. Anything else fails loudly, naming the path.
//
// Read-only: anon SELECT, no writes. Toggling real visibility from a spec is
// forbidden — admin-page-visibility.spec.ts:43-46 records the run that left the
// landing page hidden for every visitor.

import { test, expect } from '@playwright/test';
import {
  EXPECTED_HIDDEN_PAGES,
  fetchLiveVisibility,
  unexpectedHiddenPaths,
} from '../helpers/visibility-helpers';

test.describe('Live page visibility configuration', () => {
  test('no page is hidden in production without a signed-off reason', async () => {
    const rows = await fetchLiveVisibility();

    // A read that comes back empty means the table is unreadable or truly
    // empty; either way the comparison below would vacuously pass.
    expect(
      rows.length,
      'page_visibility returned no rows — the table is empty or unreadable, so this check would pass vacuously.',
    ).toBeGreaterThan(0);

    const unexpected = unexpectedHiddenPaths(rows);

    expect(
      unexpected,
      unexpected.length
        ? `These pages are hidden from users in production but are not in EXPECTED_HIDDEN_PAGES: ${unexpected.join(', ')}. ` +
          'If that is intentional, add each path to EXPECTED_HIDDEN_PAGES in e2e/helpers/visibility-helpers.ts with the reason. ' +
          'If it is not, restore it in Admin → Page Visibility — real users are seeing the Coming Soon card.'
        : '',
    ).toEqual([]);
  });

  test('every allowlisted hidden page is actually still hidden', async () => {
    // Keeps the allowlist honest in the other direction: once a page is
    // restored, its entry must come out, or the allowlist silently grows into
    // a blanket exemption that would mask a future accidental hide.
    const rows = await fetchLiveVisibility();
    const hidden = new Set(
      rows.filter(row => !row.visible_to_users).map(row => row.page_path),
    );

    const staleEntries = Object.keys(EXPECTED_HIDDEN_PAGES).filter(
      path => !hidden.has(path),
    );

    expect(
      staleEntries,
      staleEntries.length
        ? `These paths are listed in EXPECTED_HIDDEN_PAGES but are visible in production: ${staleEntries.join(', ')}. ` +
          'Remove them from the allowlist so it keeps protecting against accidental hides.'
        : '',
    ).toEqual([]);
  });
});
