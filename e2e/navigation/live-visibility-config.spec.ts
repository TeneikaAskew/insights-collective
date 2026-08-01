// ABOUTME: Fails when production hides a page that nobody signed off on, so an
// ABOUTME: accidental toggle cannot hide behind the suite's gated-page handling.
//
// Specs cope with hidden sections in ways that are correct for a DELIBERATE
// toggle — route-parity compares an alias against its canonical route,
// mobile-overflow skips with a reason — but none of them can tell a deliberate
// toggle from an accidental one. Left there, a page switched off by mistake
// would quietly stop being measured while real users sat in front of the lock
// card, and CI would stay green.
//
// This spec closes that gap. It reads the live table and compares it against
// EXPECTED_HIDDEN_PAGES, the reviewed record of intent, failing in both
// directions: a page hidden without an entry, or an entry whose page is no
// longer hidden.
//
// Read-only: anon SELECT, no writes. Toggling real visibility from a spec is
// forbidden — admin-page-visibility.spec.ts:43-46 records the run that left the
// landing page hidden for every visitor.

import { test, expect } from '@playwright/test';
import {
  fetchLiveVisibility,
  staleAllowlistEntries,
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
    const staleEntries = staleAllowlistEntries(rows);

    expect(
      staleEntries,
      staleEntries.length
        ? `These paths are listed in EXPECTED_HIDDEN_PAGES but are visible in production: ${staleEntries.join(', ')}. ` +
          'Remove them from the allowlist so it keeps protecting against accidental hides.'
        : '',
    ).toEqual([]);
  });
});
