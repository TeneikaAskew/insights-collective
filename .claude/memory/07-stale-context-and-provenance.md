# Stale context, and claims about what exists

Written after a landing-page and BLS-wage-data session. The recurring failure was
not carelessness — every claim below was made carefully, from evidence. The
evidence was just drawn from the wrong copy of the repository.

Four incidents. The user caught three of them.

---

## 1. Audited the whole codebase against a branch 767 commits behind

**What I claimed.** Asked which pages had been converted to the new "Soft Studio"
design language, I ran a marker audit and reported: one page converted, 79 not,
"effectively all of them" outstanding. I produced counts, a ranked table of the
worst offenders, and a rollout plan built on that picture.

**What was true.** Two things at once:

- Ten pages already had **approved design artifacts** — Resume Analysis,
  Interview Prep, JD Analysis, STAR Practice, Mock Interviews, Code Practice,
  Career Pathway, Admin Dashboard, Manage Users, Manage Courses, Manage Forms.
  They were designed; only Landing had been implemented. I had measured *code*
  and answered a question about *design*.
- `origin/main` had **18 files already converted in code**. My branch predated
  all of it.

**How it was caught.** The user, twice: *"I know the home page, the admin pages,
the resume page, the career agent and pathways page were all updated"*, then
*"maybe you dont see them because you aren't on the fresh origin/main"*.

**What I had not done.** `git fetch`. A single fetch showed the branch was 767
commits behind, with two feature branches I had never seen.

---

## 2. Built a second implementation of a design system that already existed

**What I did.** Added a `studio-*` Tailwind colour scale to `tailwind.config.ts`
and a `.soft-studio { --studio-* }` block with `.studio-card`, `.studio-wash`,
`.studio-accent` utilities to `src/index.css`.

**What already existed on `origin/main`.** The same design language, implemented
better: `.soft-studio` overriding the **shadcn CSS variables** (`--primary`,
`--background`, `--muted`…) so every existing component re-skins inside the
wrapper, plus `ss-card`, `ss-card-warm`, `ss-chip`, `ss-tile`, `ss-serif`,
`ss-wash` utilities, an `AdminSoftStudio` wrapper component, and a dev preview
page with fixtures.

Same palette. Same fonts. Two incompatible implementations. Merging as-is would
put both in the repo permanently.

**The tell I ignored.** I had proposed "retheme the shadcn tokens" as a *future*
step in my own plan. That is exactly what main had already done. When your
proposed solution is the obvious one, check whether someone already built it.

---

## 3. A migration number that would have silently done nothing

**What I did.** Created `supabase/migrations/20260729000000_bls_wage_reference.sql`.

**What was true.** `origin/main` already had
`20260729000000_drop_stale_permissive_policies.sql`, and it was already applied
on the remote database. The remote had migrations up to `20260801001200`.

Supabase tracks applied migrations by **version string**. `supabase db push`
would have seen `20260729000000` in `supabase_migrations.schema_migrations`,
considered it done, and moved on. No tables, no error, no output distinguishable
from success. The failure would have surfaced later as "the feature renders
nothing in production".

**How it was caught.** Before pushing, querying the remote:

```sql
select table_name from information_schema.tables
 where table_schema='public' and table_name in ('bls_occupations','career_roles');
-- []                                    <- tables absent
select version from supabase_migrations.schema_migrations
 where version='20260729000000';
-- [{"version":"20260729000000"}]        <- but the version is recorded
```

Tables absent *and* version recorded is the signature of a collision. Renamed to
`20260802000000`, past the remote high-water mark.

**Rule.** Before numbering a migration, read the remote's maximum applied version
and check your candidate is not taken. Timestamp-based names collide whenever two
branches are developed in parallel.

---

## 4. Deleted files as dead, verified against the stale tree

**What I did.** Two deletions, justified the same way.

The unrouted pages — `ForumList`, `ForumDetail`, `ThreadDetail`,
`AdminCourseEdit`, `CourseManagement`, all of `src/components/forum/`,
`src/tester.tsx` — each verified as unreachable: lazy imported in `App.tsx` but
never rendered by any `<Route>`.

And seven home components — `AnalyticsDashboard`, `CommunityShowcase`,
`ExploreTools`, `FeaturesSection`, `InteractiveShowcase`,
`LearningProgressChart`, `PersonalizedPathway` — dropped because the rebuilt
landing page no longer rendered them.

**What was true.** The two halves came out differently, and I reported both as
the good case.

The unrouted pages really were delete/delete — `git cat-file -e origin/main:<path>`
fails for all seven, so main had removed them independently. That resolves
cleanly.

The home components did not. **All seven are still on `origin/main`, and main's
own `Index.tsx` imports and renders every one of them** — main converted that
landing page to Soft Studio on 2026-07-28, three days before my rebuild. So the
merge is modify/delete against live code:

```
$ git show origin/main:src/pages/Index.tsx | grep -c "components/home/ExploreTools"
1
$ git cat-file -e origin/main:src/components/home/ExploreTools.tsx && echo present
present
```

**What I had written here first.** That "main had deleted them too" and "the
overlap was delete/delete" — for all twelve. I had measured the forum files and
generalised to the home components without checking them, in a file whose entire
subject is generalising from the wrong corpus.

**Why the evidence was never sufficient.** "The new landing page does not render
this" is a fact about *my* landing page. Whether a component is dead depends on
which `Index.tsx` ships, and that was an open question — two landing pages
existed, on two refs, neither obviously the winner. Deleting on that basis
prejudges a design decision as a dead-code cleanup.

Note the near-miss inside the near-miss: `CourseManagement` *appears* routed on
main (`grep` finds it twice in `App.tsx`). It is not — those hits are
`CourseManagementDashboard`, a different component. A substring grep is not a
reachability check.

**Rule.** Verify each deletion against the ref you will merge into, one file at a
time — `git cat-file -e origin/main:<path>` costs nothing and does not
generalise. And when a file is only dead because of a change you made, that is
not dead code; it is a consequence of your change, and it stands or falls with
it.

---

## The pattern

All four are the same error: **I verified against the repository I had, and
reported conclusions about the repository that exists.** In every case the
checking method was fine. The corpus was wrong.

This is more dangerous than not checking at all, because the output carries the
confidence of measurement — counts, tables, file paths — and invites the reader
to trust it.

## Rules

- **`git fetch` before any claim about what exists.** Then say which ref the
  finding describes: "on this branch" or "on `origin/main`". A count with no ref
  attached is not a fact.
- **Check how far behind you are before auditing anything.**
  `git rev-list --left-right --count origin/main...HEAD`. Beyond a few dozen
  commits, treat every "X does not exist" as unverified.
- **Before inventing a convention, search other refs for it.**
  `git grep -l <pattern> origin/main -- src` costs nothing.
- **Before numbering a migration, read the remote's applied versions.** Absent
  tables plus a recorded version means a collision, not a failed migration.
- **Reachability is per-tree.** State the tree. Prefer a rendered-element check
  over a substring grep — `element={<X` beats `grep X`.
- **When the user says something exists that you reported missing, believe them
  first and re-derive.** Both times here, they were right and I was measuring the
  wrong thing. The cheap move is to ask *which* copy each of us is looking at.
