# Verification discipline — where reasoning got skipped

Five incidents from one session. Four are mistakes; the fifth is the
counter-example showing what the correct process produces.

---

## 1. Claimed a fixture fixed a test without checking the render condition

**What I did.** `grading-workflow-flow` failed with "Seed gap: no gradable
assignments". I added a published assignment and a submission to
`e2e/fixtures/seed.sql`, then wrote in the PR description that this fixed the
test.

**What was actually true.** `src/pages/InstructorAssignments.tsx:163` renders
the "Grade submissions" **link** only when `content_item_id` is set:

```tsx
{r.content_item_id ? (
  <Link to={`/courses/${courseId}/assignments/${r.content_item_id}/grade`}>
    Grade submissions
  </Link>
) : (
  <Button size="sm" variant="outline" disabled>No submissions target</Button>
)}
```

My assignment left `content_item_id` null, so the page rendered the **disabled
button**. The spec looks for `getByRole('link', …)`. It would have failed
exactly as before. An automated reviewer caught it, not me.

**The skipped step.** I never opened the component. I reasoned "the dashboard
says no assignments, so seed an assignment" and stopped there.

**The rule.** When a fixture exists to make a UI element appear, read the
component's conditional for that element and confirm the fixture satisfies
every branch condition. The seed is only correct if it satisfies the render
condition, not merely the table's NOT NULL constraints.

---

## 2. Replaced a broken assertion with a differently-broken one

**What I did.** `notifications-flow` asserted that after deleting a
notification, no card matched its `title::message` fingerprint. That could never
pass — the member had 34 notifications with identical text, so deleting one left
33 matches. I replaced it with a count: assert the matching count drops by one.

**What was actually true.** The count is equally unsound. The suite runs fully
parallel, other journeys write notifications for the same member, the page
subscribes to realtime inserts, and its query is capped at 200 rows. Any of
those can move the count independently of the delete. The reviewer flagged it;
they were right.

**The skipped step.** I diagnosed why the old assertion was wrong (text is not
unique) but did not run the *new* assertion against the same list of failure
modes. I fixed the symptom I had just discovered rather than the class.

**The rule.** When replacing an assertion that failed for a soundness reason,
enumerate the failure modes and check the replacement against all of them, not
just the one that prompted the change. For identity, use a primary key — here,
capturing the row id from the `DELETE …?id=eq.<uuid>` request and querying that
id directly.

---

## 3. "Fixed" a secret-scanner finding without knowing the scanner's scope

**What I did.** TruffleHog flagged an unverified Postgres result. The finding
was a fabricated connection string I had put in a workflow comment as an
example. I deleted the line and pushed a new commit.

**What was actually true.** The scan is over a **commit range**:

```
scanning repo {"base": "65b5e99…", "head": "3924976…"}
```

The string still existed in the earlier commit's diff, so the finding persisted.
Removing a secret in a later commit never clears a range scan — which is correct
behaviour for real leaks, and something I should have known before "fixing" it.
The real fix was rewriting history so the line never existed.

**The skipped step.** I did not read the tool's output carefully enough to
notice `base`/`head` before acting on it. The information was in the log I had
already fetched.

**The rule.** Before fixing a tool's finding, establish what the tool examined.
For anything scanning git, determine whether it looks at the working tree, the
diff, or the commit range — the correct remediation differs completely.

---

## 4. Asserted third-party UI navigation from memory

**What I did.** Told the user to get their connection string from "Supabase
dashboard → Project Settings → Database → Connection string → URI". Twice.

**What was actually true.** That path did not exist in their dashboard. The UI
had changed. My correction attempt was also a guess.

**The skipped step.** I stated a navigation path as fact when I had no current
source for it, in a repo where I had a docs-search tool available the whole
time.

**The rule.** Do not assert third-party UI navigation from memory — vendor UIs
change faster than training data. Give the artefact the user needs (the
constructed string, the exact value) rather than directions to find it, or
verify against current docs first. When a UI path must be given, say plainly
that it may have moved.

---

## 5. The counter-example: investigating before acting

**What I did.** Asked whether 34 duplicate notifications were a product bug.
Before touching anything, I ran two queries: one grouping duplicates by day, one
splitting duplicate counts by cohort.

**What they showed.**

- `rows` equalled `distinct_seconds` in every bucket — 30 rows across 30
  different seconds, i.e. separate events, not one fan-out emitting 30 copies.
- Real users: 13 users, 263 notifications, **worst duplicate group = 1**.
  E2E accounts: 2 users, 54 notifications, worst group = 34.

**The outcome.** Definitively not a product bug — accumulation from repeated E2E
runs against a shared database. That justified *not* deleting production rows,
*not* "fixing" a non-existent fan-out bug, and *not* breaking the spec that
requires the member to have notifications.

**The rule.** Two cheap queries turned an ambiguous "should we fix this?" into a
decision with evidence. When the question is "is this broken?", find the
comparison that would distinguish broken from working — here, do unaffected
users show the same symptom? — before proposing any change.

---

## The pattern across all five

The failures share one shape: **I had access to the ground truth and did not
look at it.** The component was readable. The scanner's scope was in a log I had
already downloaded. The docs tool was available. In every case the check was
cheaper than the rework it would have prevented.

The successes share the opposite shape: query the database, read the component,
execute the script, compare against a control group.

**Heuristic:** before claiming "this fixes X", name the specific observation
that would prove it, and make that observation. If the claim cannot be tied to
an observation available now, say so explicitly ("I could not verify Y because
Z") rather than asserting it and letting a reviewer discover the gap.
