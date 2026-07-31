# CI triage, and controls that revert instead of reject

From a later session: a PR with five Playwright failures and two flakes, where
the five had **three unrelated root causes** and none of them was the commit CI
had flagged. Every lesson below is tied to something that happened.

---

## 1. Consult the backend logs before theorising about the backend

**What I did.** One failure was a messaging spec. I had recently hardened
`supabase/functions/messages-helper/index.ts` with a caller-identity check
(rejecting requests that claim another user's id). I built a detailed theory
that this guard was returning 401/403, read the guard, read the service layer,
read the archived-conversations handler, and started reasoning about which
branch threw.

**What was actually true.** One `mcp__Supabase__get_logs(service:
"edge-function")` call showed **every** `messages-helper` request during the CI
window returned `200`. The guard was fine. The theory had consumed several
tool calls and produced nothing.

**The compounding cost.** That same log response also contained
`execute-code | 200` and `review-code | 200` — which was the decisive evidence
for a *different* failure (see §2). The information that resolved two of the
three root causes was in a single cheap call I made late instead of first.

**Rule.** When a test failure plausibly implicates a backend you control, pull
its logs **before** reading its source. Status codes are ground truth; control
flow read from source is a hypothesis. This is the same shape as the earlier
session's core lesson, recurring in a new domain.

---

## 2. A test can pass by accident, and unrelated seed data can revoke the accident

**What happened.** Two specs in
`e2e/interview-prep-design/soft-studio-hub.spec.ts` asserted the code-practice
**demo** result card — fixed `Correct`, `3/3`, and a `Demo` provenance chip. A
comment above them read "Logged-out visitors get the simulation".

They ran under the `chromium-member` project, which is **signed in**.

`src/pages/interview-prep/CodePractice.tsx:292` branches:

```tsx
if (user && dbChallenge) { /* real evaluation: execute-code + review-code */ }
// ...
// Demo fallback (logged out, or no challenge rows in the database)
```

Signed in, `user` was truthy — but no `code_challenges` row matched the default
`all` role, so `dbChallenge` was null and the demo branch ran anyway. The tests
passed for a reason that had nothing to do with what they claimed to test.

Later, unrelated code-evaluation work seeded a challenge for role `all`. Both
tests broke instantly, in a file nobody had touched.

**Rule.** When a spec's comment states a precondition ("logged out",
"as an instructor", "with no data"), verify the spec's **project and
storageState actually establish it**. A spec whose stated premise differs from
its runtime context is not passing — it is waiting for unrelated data to change.

**The fix shape.** Don't relabel the assertions to match the new behaviour;
that discards the coverage. Pin the context the assertions describe:

```ts
test.describe('… (logged out — canned simulation)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
```

Use an explicit empty state, not `storageState: undefined` — `undefined` in
`test.use` means "unspecified" and falls back to the project value, silently
leaving the test signed in.

---

## 3. Security controls here revert silently; `res.ok()` is not evidence

**What happened.** Two journey specs graded an assignment over PostgREST and
then asserted the score rendered. Both failed on `Score 90` / `Score 92` — but
passed the preceding `Graded · Attempt 1 of` assertion, and passed
`expect(gradeRes.ok())`.

`public.pin_assignment_grade_columns` (trigger on `assignment_submissions`):

```sql
IF public.is_grading_staff() THEN RETURN NEW; END IF;
NEW.grade := OLD.grade;  NEW.score := OLD.score;
NEW.graded_at := OLD.graded_at;  NEW.grader_comments := OLD.grader_comments;
-- …
RETURN NEW;
```

It **reverts, it does not reject**. A student PATCHing their own submission gets
a `200` and a response body; the grade columns are just silently restored to
their old values. `workflow_state` is not pinned, so `'graded'` stuck — which is
exactly why the UI said "Graded" with no score.

**Two rules from this.**

- After any write guarded by a pin/revert trigger, **assert the persisted
  value**, not the status code. `Prefer: return=representation` already returns
  the row; check it. A 2xx from PostgREST means "the statement ran", not "your
  columns landed".
- A spec that says it acts as staff must **use a staff token**. The comment in
  `assignment-submission-feedback.spec.ts` read "test user has admin +
  instructor roles" — true of the old shared account, false since the account
  split, and never updated. Stale role comments outlive the accounts they
  describe.

**Repo fact, verified against `user_roles`:**

| account | roles |
|---|---|
| `e2e-admin` | student, instructor, admin |
| `e2e-instructor` | student, instructor — and `instructor_id` of the reference course |
| `e2e-member` | student only |
| `e2e-journeys` | student only |

`is_grading_staff()` requires `instructor` or `admin` in `user_roles` (or the
service role). `e2e-member` and `e2e-journeys` cannot grade. Mint a separate
instructor token for the grading step via the password grant; do **not** swap
the browser session, because the spec still needs to assert the *student's*
view.

---

## 4. Re-read the failure list from the log; do not work from memory of it

Several tool calls in, I was reasoning about "the messaging failure" from a
recalled summary. Re-pulling the job log corrected two things at once: the
failing spec was `messaging/messaging-validation.spec.ts` (not `messages.spec.ts`,
which was merely flaky), and the failing assertion was a poll, not a locator.

**Rule.** Before fixing, re-read the authoritative failure list. It is one call,
and a misremembered test name sends the whole investigation to the wrong file.

---

## 5. Write assertions that say what they saw

The messaging failure surfaced as:

```
Error: expect(received).toBe(expected) // Object.is equality | Expected: true
```

The spec polled an anonymous boolean:

```ts
await expect.poll(async () => emptyVisible || rowsCount > 0, { timeout: 10000 })
  .toBe(true);
```

That message cannot distinguish "still on skeletons", "error alert showing",
and "rendered an empty list" — three states with three different fixes. Poll a
**descriptive string** and match it, so the failure names the state:

```ts
const inboxState = async () => { /* → 'error: …' | 'empty' | 'rows' | 'pending' */ };
await expect.poll(inboxState, { timeout: 30_000 }).toMatch(/^(empty|rows)$/);
```

**Rule.** If a polled condition has more than two distinguishable failure
states, poll a string, not a boolean. The cost is three lines; the saving is a
CI cycle spent guessing.

---

## 6. "My change broke it" and "my change exposed it" are different, and neither excuses it

Of the five failures on this PR, the root causes were: a seeded challenge row
from other recent work, a grade-pinning trigger from this branch's security
work behaving exactly as designed, and a data-dependent assertion that had
never been sound. The commit CI flagged as the head SHA caused none of them.

Two things follow, and they do not conflict:

- **Diagnose honestly.** Say which change actually caused what. Reporting "my
  last commit broke five tests" when it broke none is as wrong as the reverse.
- **Fix it anyway.** On your own PR, every red check is yours to drive to green
  regardless of who introduced it. "Pre-existing" is an explanation, not an
  exit.

The one genuine exception is a failure that reproduces on the base branch — say
so once in the thread, then act on the recovery notice.

---

## 7. Don't "fix" a security control to make a test pass

The grade-pinning trigger blocked two specs. Loosening it — adding a bypass,
widening `is_grading_staff()`, dropping the trigger in the test environment —
would have turned five failures into three in about a minute, and silently
removed the control this branch existed to add.

**Rule.** When a control this branch introduced blocks a test, the default is
that the **test** is wrong about who it should be acting as. Change the control
only with a stated reason why the control, not the test, encodes the wrong
policy.
