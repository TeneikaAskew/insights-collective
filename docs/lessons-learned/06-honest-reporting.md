# Honest reporting

## Separate proven from probable, every time

With 29 failures to attribute, the split was:

- **Proven mine** — 11 `PGRST202` errors traced to specific unapplied
  migrations, each function confirmed absent by querying `pg_proc`
- **Proven not mine** — 9 visual baselines reproduced on `main`'s own run with
  none of the branch's code
- **Probable, not proven** — 7 member/journey specs in areas the diff never
  touches

The third category was reported with its evidence *and* its limitation: `main`
could not enumerate its own failures until it inherited the reporter fix, so the
claim rested on the diff's file list, not a comparison. Saying "strong
circumstantial evidence, not proof" costs one sentence and is the difference
between a report someone can rely on and one they have to re-verify.

## State limits of the environment rather than implying coverage

Recurring examples:

- authenticated E2E specs cannot run in a sandbox with no route to the backend —
  they run logged-out and skip, which is *not* passing
- CI artifacts were not downloadable (direct GitHub API returns 403 here), so
  regenerating baselines from uploaded `-actual.png` files was impossible — said
  plainly rather than quietly working around it
- outbound 5432 is blocked, so a connection test would be a false negative

Each of these could have been left implicit. Each would have let a reader assume
more verification than actually happened.

## Correct errors plainly and move on

Two corrections in this session:

1. Asserted a blog section was rendering empty, based on a screenshot, without
   checking image dimensions. It was a viewport-height capture of an
   inner-scrolling page. Corrected in one paragraph with the evidence
   (`1280x800` vs `landing` at `1280x8852`), then carried on.
2. Initially framed the "23 failures, only 10 identifiable" as an API limitation.
   It was a repo bug. Corrected by opening with "that turned out to be a bug,
   not a limitation".

Neither needed an apology or a post-mortem — just the correction, the evidence,
and the next step.

## Never present a fabricated number as real

Held throughout:

- a failed count renders `—`, never `0`
- hardcoded analytics deltas were removed rather than kept as placeholders
- when a stats query fails, the map is left empty so every row shows `—` rather
  than a misleading `0%`

The same principle drove refusing to commit baselines captured from logged-out
pages: a screenshot of a broken page, labelled "expected", is a fabricated
number in image form.

## Report the consequence, not just the fact

"Migrations `20260731000000`–`20260731000700` must be applied on deploy" was
technically accurate and repeated across several updates — and it read as
boilerplate, so it was treated as boilerplate, including by me.

The version that actually landed:

> Merging this PR without applying the migrations ships an admin section whose
> Users, Courses and Forms pages cannot load their data, and leaves the
> `blog_posts` RLS hole open.

Same fact. The difference is that the second one is impossible to skim past.

**Lesson:** if something is a blocker, describe what breaks. A fact stated
without its consequence gets filed as a footnote.

## Verify claims from bots and agents before acting

Automated review comments and agent reports were treated as *leads*, not
findings. Both Codex P1s were checked against the live schema before being
acted on — and both were real, which is exactly why the check was worth doing:
it converted "a bot says so" into "the `CHECK` constraint is
`status = ANY (ARRAY['draft','published','archived'])`, so scheduled posts can
never save".
