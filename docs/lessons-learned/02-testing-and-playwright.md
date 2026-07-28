# Testing and Playwright

## Projects are assigned by path — putting a spec in the wrong folder inverts it

`playwright.config.ts` routes specs to role-scoped projects by glob:

- `chromium-admin` → `**/admin/**`
- `chromium-public` → includes `**/blog/**`
- `chromium-instructor` → an explicit `testMatch` list

An instructor spec was initially written into `e2e/admin/`. That directory is
claimed by `chromium-admin`, so it would have run **as admin** while asserting
instructor-only behaviour — passing for the wrong reason and proving the
opposite of what it claimed. Fixed by creating `e2e/instructor/`, adding it to
`chromium-instructor`'s `testMatch` and to `chromium-member`'s `testIgnore`.

**Lesson:** in a role-scoped suite, a spec's *location* is part of its meaning.
Check which project will claim a new file before writing assertions.

## A regex alternation in a locator can match more than one element

```ts
// matches TWO nodes on an empty form → strict-mode violation
await expect(page.getByText(/Nothing to preview yet|Untitled Post/)).toBeVisible();
```

The failure reads as "element not visible", which points at absence when the
real cause is multiplicity. Assert the branches separately — it is both correct
and stronger, proving each renders rather than one-or-the-other.

## Assert on a discriminating selector, not a convenient one

A sorting test originally asserted over all `h3` headings — which included six
stat cards, not just post titles. Two fixes were needed:

1. filter to the elements actually under test
2. assert an **order flip** (`['Beta','Alpha']` → `['Alpha','Beta']`) rather than
   a single ordering, so the test cannot pass coincidentally

**Lesson:** ask "could this assertion pass for a reason unrelated to the
behaviour?" A test that cannot fail for the right reason is worse than none.

## Don't ship a test that is flaky by construction

A Radix `Select` cannot be opened in jsdom, so the Featured-filter assertion
threw. Rather than force it with brittle mocking, it moved to Playwright with a
comment recording *why* it lives there. A skipped-and-explained test beats a
flaky one.

## Visual regression

**Baselines can only be generated where they will be compared.** Files are
`*-visual-linux.png` captured on the runner, and role-gated routes only render
with a real session. A baseline captured anywhere else relocates the failure
rather than fixing it. The mechanism added here is an opt-in `workflow_dispatch`
input that runs `--update-snapshots=changed` on the runner and commits the PNGs
back.

**Use `changed`, not `all`** — it rewrites only baselines that actually differ,
keeping the committed diff minimal and reviewable.

**Order matters: fix the data before photographing it.** Regenerating baselines
*before* applying the pending migrations would have captured admin pages in
their broken, RPC-less state and locked that in as "expected". Migrations first,
baselines second, always.

**Guard the regeneration.** `globalSetup` writes `{"cookies":[],"origins":[]}`
for any role that fails to authenticate, and those routes then render
logged-out. Committing that turns the check green on a lie — strictly worse than
the red check it replaces. The commit is gated on every role's session file
carrying a real token.

**Then actually look at the images.** Byte counts and a green guard are not
review. Reading the regenerated blog index is the *only* reason a real defect
was found — every byline rendering as "Unknown Author", which no test asserts
and no check would ever have caught.

**Know what `fullPage` gives you.** App-shell pages that scroll an inner
container produce a viewport-height capture, not a whole-document one. Thirteen
of fifteen baselines here are exactly `1280x800` for that reason. Interpreting
one as "the section is empty" was wrong.

### A baseline over live data measures the database, not the design

This is the suite's central design flaw, and it surfaced properly in PR #32.

A screenshot of a data-driven route pins three unrelated things into one PNG:
the **layout**, the **rows that happened to exist that day**, and the
**permissions in force at capture time**. Only the first is a design fact. The
other two drift on their own, so the check fails for reasons that have nothing
to do with a regression.

The `courses-catalog` baseline is the clearest case. Its three visible cards are

```
Smoke Course mryr1wv7   Smoke Course mryqon7l   Smoke Course mryq4cde
```

— fixtures created by a smoke test during the run that captured it, and deleted
afterwards. They sort first (`created_at desc`) so they dominate the frame. The
baseline is a photograph of throwaway data, committed as "expected". It also
predates a grant migration, so it encodes a permission state that no longer
exists.

Add to that: **seeded courses have no artwork**, so every card renders the
neutral placeholder block. Card height and the whole grid rhythm then depend on
title length and description wrap — i.e. on whatever rows exist. The baseline
moves whenever the data does, which for a shared database with parallel workers
is *most runs*.

The strain was already visible in the file before anyone named the cause:

- 3 of 14 routes carry a raised 5% tolerance, with a comment conceding the drift
  "reproduces at 2-3% of pixels regardless of how recently the baseline was
  captured — regenerating just moves it"
- 2 routes sit commented out awaiting regeneration
- 4 baseline-churn commits in four weeks

That is a suite spending real maintenance to assert facts about test fixtures.

**The fix is not to delete the technique — it is to freeze the inputs.** Stub
the network layer with a fixed payload and screenshot that:

```ts
await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, body: '[]' }));
await page.route('**/rest/v1/courses?*', r => r.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE),
}));
```

Then a diff means "the layout changed", full stop — it cannot be moved by a
smoke test, a parallel worker, a grant migration, or a course without a
thumbnail. This is exactly the harness used to verify the catalog locally, so
the cost is near zero.

**Rule of thumb for which routes earn a baseline:**

| Route shape | Baseline worth it? |
|---|---|
| Chrome-heavy, little live data (`login`, admin shells) | Yes, as-is |
| Data-driven lists (`courses-catalog`, `blog-index`, `enrolled-courses`) | Only with a stubbed payload |
| Anything already needing raised tolerance | Treat the tolerance as the bug |

**Lesson:** if a check needs its threshold loosened to stay green, that is the
check telling you it is measuring the wrong thing. Loosening buys quiet; it does
not buy signal.

## Environment honesty

Authenticated specs cannot run in a sandbox with no route to the backend — they
run logged-out and *skip*, which can be mistaken for passing. Say which specs
actually ran and which did not, rather than implying a full green suite.
