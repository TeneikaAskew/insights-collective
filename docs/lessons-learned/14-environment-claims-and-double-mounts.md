# Environment claims, race-shaped flakes, and the double-mounted DOM

Fourth session (PRs #43, #45, #48, and the career-spec fix). The through-line
is the same as file 00 — assertions made without the ten-second check — but
each entry here has a new shape worth naming on its own.

## "It's the environment" is a claim, and claims get verified

The `page-visibility` flake fix stalled for a full round of reporting on three
stated blockers, all delivered as fact. The user pushed back — *is this the
environment, or unwillingness?* — and under actual testing, two of the three
dissolved:

| claim | reality |
|---|---|
| "Playwright browsers can't be installed (image has 1194, repo wants 1217)" | `npx playwright install chromium chromium-headless-shell` downloaded 112 MiB through the proxy without complaint. Only the **postinstall** is disabled (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`); the explicit install was never attempted. |
| "The E2E suite can't run without Supabase (global-setup mints role sessions)" | True for the *signed-in projects*, irrelevant for the test in question, which stubs its data and needs no auth. A ten-line scratch config with no `globalSetup` ran it: 6/6, then 8/8 under `--repeat-each`. |
| "The sandbox can't reach Supabase" | curl through the proxy reached it fine (HTTP 401 — a real response from the gateway). Only *browser* HTTPS stalls, and only that narrower claim survives. |

A fourth false belief compounded it: "the E2E credentials are in `.env`" — the
check was `grep '^E2E_ADMIN_PASSWORD='`, which matches the **key**. Every value
was empty; the file is a template. Presence of a key is not presence of a value.

**The rule:** before writing "the environment cannot do X," run the command
that would do X. If it fails, the error message is the report. If it succeeds,
the blocker was never real. The cost asymmetry is the same as file 00: the
check is seconds, the false claim survives until someone challenges it.

## A flake is a race with an address — find which side the test sits on

`navigation/page-visibility.spec.ts` → "auth surfaces are never gated" failed
on PR #43, then recovered-on-retry on #45. Two fixes were shipped before the
real one:

1. A vacuous `waitForPageLoad` (returned on a blank page; real defect, 63 spec
   files affected — but not this flake's cause).
2. Re-running the job (proves intermittency, fixes nothing).

The actual mechanism: the test ran under `chromium-member` — **signed in** —
and asserted the login *form* is visible, while `Login.tsx` navigates
authenticated users off `/login` the moment `isAuthenticated` resolves. The
test passed only when it outran the session restore. Fixing the helper to wait
*longer* handed the restore more time to win — it tilted the race toward
failure while looking like a robustness improvement.

The fix removes the race instead of betting on it: sign the test out. And the
right way to sign out is `test.use({ storageState: { cookies: [], origins: [] } })`,
not `browser.newContext()` — the console-error fixture instruments only the
injected `page`, so a hand-built context silently escapes it (Codex caught
this; the first version of the fix had exactly that hole).

**The rule:** when a test flakes, name the two racers before touching anything.
If the test asserts state A while its harness guarantees state B, no amount of
waiting, retrying, or helper-hardening fixes it — the test is in the wrong
project. Corollary: *failed → passes-on-retry* is not *fixed*; it is the same
race with better odds.

## Hidden is not unmounted: responsive components double-mount

Four career specs failed deterministically in CI, all one mechanism.
`RoleTable` mounts **both** of its presentations at every width — mobile cards
(`sm:hidden`) and desktop table (`hidden sm:block`) — and CSS picks one. The
DOM always contains two copies of every row, title, wage band, and attribution
line. Consequences, each observed in a real failure:

- `getByText(...).first()` resolved to the *hidden* mobile copy (DOM-first) and
  `toBeVisible` reported `hidden`.
- `getByTestId(...).evaluateAll(...)` counted 18 where 9 were on screen —
  `evaluateAll` and `count()` do not filter hidden elements.
- `getByText(title, { exact: true })` resolved to 2 elements and died on a
  strict-mode violation before visibility was ever evaluated.
- A comment in the component asserted "exactly one presentation is mounted at a
  time," and the specs were written against the comment instead of the DOM.

Fixes: `:visible` in selector strings, `.filter({ visible: true })` on
`getByText`, and the comment corrected to say what the code does.

One failure was different in kind: the By Category view showed 37 cards, not
33, because 4 of the 33 roles carry two categories and the view lists a role
under **each** track it belongs to. The spec pinned `TOTAL_ROLES` for a view
whose unit is category *memberships*, not roles. Counting assertions must name
the unit they count.

**The rule:** in a responsive component, assume both presentations are in the
DOM until proven otherwise — read the JSX, not the comment. Every Playwright
read against such DOM needs a visibility filter, and `evaluateAll`/`count()`
need it most because they never auto-filter.

## Stacked PRs skip the workflows that matter

`e2e.yml` and `test.yml` trigger on `pull_request` against
`branches: [main, develop]`. A PR whose base is another feature branch runs
neither. #42 merged with its brand-new e2e specs having **never executed** —
they met the suite for the first time on the post-merge main push, and all
four failed. `main` went red three separate times in one day, twice from this
mechanism.

**The rule:** a stacked PR's green checks describe a subset of CI. Before
merging one, either retarget it to `main` first or state explicitly which
workflows have not run. Structurally: a `merge_group` trigger or an unfiltered
`pull_request` trigger closes the hole for good.

## CI tests the merge, not your branch

PR #45's unit tests failed on a spec this branch never touched. GitHub runs
checks against the **merge of head into base**, so when `main` is red, every
open PR inherits the failure — and the local suite (1,161 tests) quietly
disagrees with CI's count (1,173) because the merge brings files the branch
does not have. Attribution procedure, used three times this session:

```bash
git checkout origin/main
npx vitest run <failing spec>     # fails here too → main-origin, not yours
git log --oneline <fork>..origin/main   # what arrived since you branched
```

Plus the workflow-runs API: `main`'s own push runs went green → red at a
specific merge, which names the culprit commit without argument.

**The rule:** before owning a CI failure, reproduce it on `origin/main` alone.
If it reproduces, report the blocker with the culprit commit and do not fix it
inside an unrelated PR — a real decision buried in an unrelated diff is how
guards get silently rewritten.

## A migration on main is not a migration applied

`d269468` shipped five self-hosted course covers *and* the migration pointing
courses at them. The files reached the repo; the database was never touched —
production kept hotlinking Unsplash, which was the very bug the commit claimed
to fix. Found only because the user asked "why haven't we downloaded those
images?" and the answer was checked against the live DB instead of the repo:

```sql
select count(*) filter (where image_url like '/course-art/%')      as self_hosted,   -- 0
       count(*) filter (where image_url like 'https://images.unsplash.com%') as hotlinked  -- 5
```

Same class as the coursera ledger drift (file 03) and the deployed-function
drift (PR #43): **the repo describes intent; only the live system describes
state.** When debugging anything data-shaped, query the live table before
reading another line of code.
