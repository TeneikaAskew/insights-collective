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

## Environment honesty

Authenticated specs cannot run in a sandbox with no route to the backend — they
run logged-out and *skip*, which can be mistaken for passing. Say which specs
actually ran and which did not, rather than implying a full green suite.
