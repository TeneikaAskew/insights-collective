# Verification discipline — the root cause behind most of it

Five separate failures in this session share one shape: **an assumption about
how a tool, file, or artifact behaves, asserted without checking.** Each was
cheap to prevent and expensive to discover.

## The five

### 1. A CLI flag that takes an optional argument

Shipped to CI:

```
npx playwright test --project=visual --update-snapshots e2e/visual
```

The flag is declared `-u, --update-snapshots [mode]` with
`choices: [all, changed, missing, none]`. Commander consumed `e2e/visual` as
the *mode*, failed the choices check, and exited in about one second having run
nothing. Cost: a full CI round-trip.

**The check that would have caught it** — under ten seconds:

```bash
grep -rn "update-snapshots" node_modules/playwright/lib/program.js
```

And afterwards, the fix was proven against the real CLI using a throwaway
config so the test could not touch `globalSetup`'s live-database sweeps:

```bash
npx playwright test --config=/tmp/pw.config.cjs --project=visual \
  --update-snapshots e2e/visual   # error: argument 'e2e/visual' is invalid
npx playwright test --config=/tmp/pw.config.cjs --project=visual \
  e2e/visual --update-snapshots=changed   # parses
```

### 2. A file lifecycle assumed rather than read

A guard verified that `.playwright-sessions/*.json` contained real tokens
before committing regenerated screenshots. It ran as a **separate workflow
step**, after `playwright test` had exited — and `globalTeardown` deletes that
directory at the end of every CI run:

```
[global-teardown] Cleaned up .playwright-sessions/
15 passed (26.7s)
```

So the guard reported "No admin session" for sessions that had authenticated
perfectly. It could not distinguish *never existed* from *already deleted* — a
false negative that blocked a legitimate commit.

**Lesson:** before asserting on a file, read what else in the system writes or
deletes it, and when. A guard that cannot distinguish two states it is meant to
separate is not doing its job, however good its intent.

### 3. An artifact interpreted without checking its properties

Looked at a regenerated screenshot, saw an "All Articles" heading with a footer
directly beneath it, and concluded the section was rendering empty — a bug.

It was not. Thirteen of fifteen baselines are exactly `1280x800`; `landing`,
the one page with no app shell, is `1280x8852`. The app-shell pages pin document
height to the viewport and scroll an inner container, so `fullPage: true`
captures a single viewport. The articles were below the internal fold.

**The check** — one command, before drawing any conclusion:

```bash
python3 -c "import struct;d=open('x.png','rb').read(33);print(struct.unpack('>II',d[16:24]))"
```

The correction was stated plainly rather than quietly dropped.

### 4. A locator assumed to match one element

```ts
await expect(page.getByText(/Nothing to preview yet|Untitled Post/)).toBeVisible();
```

On a brand-new post **both** strings render — the placeholder heading (title
empty) and the empty-content notice (content empty). Two nodes, strict-mode
violation, failure that reads like "element absent" when the element was
present twice.

Asserting them separately is both correct and a stronger test: it proves each
renders, rather than one-or-the-other.

### 5. A count query assumed to be complete

Client-side tallies over `select()` are silently truncated at the PostgREST
`max-rows` cap (1000 by default). Past that, forms report zero submissions and
courses report empty rosters — wrong numbers presented as real ones, with
nothing to signal the truncation. Fixed by aggregating server-side in an RPC.

## The pattern

| Assumption made | Cost | Preventive check |
|---|---|---|
| CLI flag arity | 1 CI round-trip | `grep` the CLI definition |
| File still exists at step N | 1 CI round-trip + a blocked commit | read the teardown |
| Screenshot is full-page | a wrong bug report, publicly stated | read PNG header |
| Regex locator matches once | 1 CI round-trip | reason about both branches |
| `select()` returns everything | wrong numbers shipped | know the row cap |

## The rule

**Build the smallest local reproduction of the mechanism before depending on
it.** Not "read the docs" — actually run it, isolated, with a throwaway
config/fixture so the check itself cannot cause side effects.

Concrete harnesses used successfully in this session:

- a throwaway `playwright.config.cjs` with no `globalSetup`, to test CLI parsing
  without touching the live database
- extracting a workflow step's `run:` block out of the YAML and executing it
  against a **synthetic** `test-results.json`, verifying nested-suite walking
  and ANSI stripping before pushing
- running a bash guard against both a valid and a deliberately-empty fixture to
  prove it passes *and* refuses

Each took under a minute. Each replaced a 13-minute CI round-trip.
