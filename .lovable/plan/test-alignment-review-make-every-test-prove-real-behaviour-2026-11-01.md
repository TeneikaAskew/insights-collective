# Test alignment review: make every test prove real behaviour

## Goal
Every test should check what the page is actually supposed to do. Tests that fail because the page changed get fixed to the real page; tests that pass for weak reasons ("something appeared") get real assertions; tests for removed pages get retired.

## Scope
- 121 browser (E2E) specs across 30 areas in `e2e/`
- 172 unit/component test files in `src/**/__tests__`
- Product code is not changed. If a test exposes a real product bug, it is listed, not fixed.

## Step 1 — Build the "truth map" (read-only)
For each live page in `src/config/pageManifest.ts` and the router: what it shows, the main actions, who can see it (signed out / member / instructor / admin). This is what tests get judged against.

## Step 2 — Classify every test
Each test gets one label:
- **Aligned** — checks a real outcome (data saved, navigation, permission enforced).
- **Weak pass** — passes on presence only: bare `toBeVisible` of a heading, `.or()` fallbacks that accept either outcome, `toBeTruthy`, empty-state accepted as success, try/catch swallowing failures, `test.skip` conditions that always fire.
- **Stale** — targets text, routes or buttons that no longer exist (e.g. events cluster, roster strict-mode, career-quiz-results).
- **Orphaned** — page or feature removed.
- **Flaky** — timing/race (assignment-feedback, portfolio-explorer).
- **Missing** — key flows with no test (e.g. Students and Reports builder tabs, publish → catalog).

Output: `e2e/ALIGNMENT-REPORT.md` matrix (spec, test, label, reason, fix).

## Step 3 — Fix, area by area
Order: courses/instructor → assignments/journeys → events → admin → auth/navigation → remaining areas.
- Stale: update selectors/expectations to the current page; fix missing seed rows in `e2e/fixtures/seed.sql`.
- Weak pass: replace with outcome checks (value appears after save, redirect for wrong role, count matches seeded data).
- Flaky: replace sleeps with waits on real signals.
- Orphaned: rename to `*.OLD.ts` (no deletion), noted in the report.
- Missing: add short specs for the uncovered core flows.
Unit tests: same classification; fix only those that mock away the very thing they claim to test.

## Step 4 — Verify
- Run each fixed area's specs via `npm run e2e:relay -- <path>`, then one full run at the end.
- Run changed unit tests with `npx vitest run`.
- Report: before/after totals, every changed test with the reason, product bugs found, and anything still skipped and why.

## Limits
- No product code, database or deployment changes.
- No test is loosened to turn green; a test that fails on a real bug stays failing and is reported.
- Visual snapshots are not refreshed from relay runs.

## Technical notes
- Responsive components mount twice: use `:visible` / `filter({ visible: true })`.
- Signed-out tests use `test.use({ storageState: { cookies: [], origins: [] } })`.
- This is large; I'll deliver it in area batches with a progress note after each.
