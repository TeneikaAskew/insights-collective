# Design, refactor and deletion

How the query-audit session decided what to build, what to narrow and what to
remove. `07-proposed-claude-md-additions.md` carries the distilled rules; this is
the reasoning behind them.

## Before deleting, find what replaced it — and what did not

The `course/management/*` cluster was 16 files; 15 were reachable only from each
other, and `/courses/:courseId/management` already redirected to
`/courses/:courseId/builder`. A clear case for deletion.

Except the user asked the right question: *"course settings is still needed —
will courses have a settings option?"* Checking properly turned up two things:

- The old settings form **never worked.** Its write was commented out and
  replaced with a `setTimeout` and a success toast. The `course_settings` table
  it claimed to write to did not exist.
- Its **delete-course action did work**, and nothing had replaced it. Until this
  change there was no way to delete a course anywhere in the live app.

So the deletion was right *and* incomplete. "Unreferenced" answers whether code
**runs**; it does not answer whether the **capability** still exists somewhere.

**Checklist before deleting a cluster:**

1. What routes reach it? (`scripts/audit/route-reachability.mjs`)
2. What replaced it, and does the replacement cover every action — not just the
   main one?
3. Which of its actions actually worked? A dead file can still hold the only
   working implementation of something.

## Build on the pattern that is already there

The builder already had two views that merge into the `courses.settings` jsonb
column and call `onSave({ settings })` — `CourseCertificatesView` and
`CourseDesignView`. The new Settings view follows that exactly: no new table, no
new save path, no new state convention.

The test that matters is "merges into existing settings rather than replacing
them", because they share one jsonb column and a careless spread would silently
wipe the certificate config.

Find the existing pattern before inventing one. Two ways to persist settings in
one feature is a defect waiting to happen.

## Ship less, honestly, rather than more, falsely

The old settings form offered six toggles. The replacement offers one, plus
delete. That is deliberate — only two had a real consumer:

- **Discussions** — real, because the same change wired `InlineDiscussionWidget`
  into `LessonViewer` and made it read the setting.
- **Delete course** — real, and restores something that had been lost.
- Auto-enrollment, feedback requests, enrollment notifications, slug — no
  consumer. Shipping them would recreate exactly the lying form we deleted.

A switch that changes nothing is worse than a missing switch, because it looks
like a promise. Where something genuinely is not wired up yet, label it — there
is good precedent in `CourseCertificatesView.tsx`, a permanent notice saying the
values save but nothing consumes them.

## Default new flags to the existing behaviour

`settings.discussions.enabled === undefined` means **on**, so a course created
before the setting existed keeps its discussions. The check is `enabled !== false`,
not `enabled === true` — the difference is whether every existing course
silently loses a feature on deploy.

## Derive rules instead of enumerating them

The e2e suite blocks third-party hosts so a CDN outage cannot decide whether it
passes. The first version listed the hosts to suppress: `cdn.gpteng.co`, then
Google Fonts, then `i.pravatar.cc`, then `images.unsplash.com` — each discovered
by another red run.

The stable version derives the suppression from the block: *allowed* hosts are
loopback, the Supabase host, and the two CDNs the app's own CSP names; anything
else was blocked by us, so its resource error is ours. Being the exact
complement of the policy, it cannot drift.

Enumerated lists go stale the moment someone adds a font.

## Put the pass/fail rule where it can be tested

The predicate deciding which Supabase issues fail a test started inside the
Playwright fixture, where vitest cannot reach it. It moved to
`src/integrations/supabase/issue-triage.ts` and got 15 tests.

The negative cases carry the weight: a predicate that also flags `PGRST116` or a
403 is blanket suppression's mirror image and would be switched off within a
week. **A rule that nothing can test is how the last set of suppression rules
drifted into hiding real defects.**

## Narrow a security rule; do not remove it

Two guards blocked legitimate local setups:

- `url.startsWith('https://')` on the Supabase URL
- `connect-src 'self' wss: https:` in the CSP

Both broke `supabase start` (which serves `http://127.0.0.1:54321` and is
documented in `CLAUDE.md`) and the e2e relay.

The fix was not `http:` wholesale. It was: allow plain HTTP **only** for
loopback, and add **only** the configured origin to `connect-src`, and only when
that origin is loopback. A deployed build points at https and neither change
adds anything.

Then test the rejections, not just the acceptances — `http://localhost.evil.com`
and `http://127.0.0.1.evil.com` must still fail, which is why the check parses
the URL and compares `hostname` exactly instead of matching substrings.

## Make the breaking change loud, then make it easy

Landing a lint rule against 159 existing violations is a choice between three
bad options and one good one:

- fail lint everywhere → the rule is reverted within a day
- exclude the directory → the debt is hidden and never shrinks
- fix all 159 first → the rule never lands

What worked: land the rule, and give each existing instance a one-time
`eslint-disable` with a `TODO(count-guard)`. New violations are blocked
immediately and the backlog is a single greppable number:

```bash
grep -rn "TODO(count-guard)" e2e/ | wc -l
```
