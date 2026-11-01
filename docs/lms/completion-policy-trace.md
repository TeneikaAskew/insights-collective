# Completion and certificate policy: what the handoff requires versus what the owner must decide

Tracker items T-09 (started-only quiz counts as done) and T-10 (inconsistent "done" vocabulary) traced
to the three handoff documents. Line numbers refer to the files in the verified archive
(SHA-256 of the archive `888b67b5…885e02`).

## Clear requirements (no owner decision needed)

| Requirement | Source | Current state (tier) |
|---|---|---|
| Assessed items must not complete through Next or scrolling; only "real configured completion requirements" complete them | Archive A2 line 60; Master WP-03 §2 line 182; Acceptance C line 415 | Met for assignments and for quizzes with no submission (local-db test 02: refused) |
| An assignment completes only with a legitimate submitted or graded submission; `submitted_at IS NOT NULL` alone may be insufficient for withdrawn/draft/invalid submissions | Master WP-03 §2 line 182, §4 line 184 | Draft (unsubmitted) rows are refused; withdrawn/invalid states are not modelled yet |
| UI, API, database and certificate must use **the same** completion definition | Master WP-03 §3 line 183 ("Ensure the same definition on UI, API, DB and certificate") | **Not met (T-10)**: certificate trigger counts `read`,`completed`; guard and `progressionStates.ts` also count `graded`. Local-db test 02 shows no certificate when an item is `graded` |
| New invalid assessed completion cannot be created through UI **or** API | Master WP-03 acceptance line 190 | Met for assignments; **not met for quizzes via `start_quiz_attempt`** (T-31) where any signed-in account could create the qualifying row (fix drafted, local only) |
| Historical rows and certificates are preserved; no automatic deletion or revocation; reconciliation only after approval | Start Here lines 14, 30; Master §9 line 540 | Honoured: nothing changed; counts reported read-only |

## Unresolved owner choices (do not invent)

| Choice | Where the documents leave it open | Options the documents name | Why it matters |
|---|---|---|---|
| Does a **started-only** quiz attempt (`pending_review`, no answers, no score) count as "legitimate"? | Master WP-03 §2 line 182 says "quiz requires a legitimate completed/pending-review attempt **according to quiz policy**"; §4 line 184 says "Examine quiz `pending_review` and completed states"; §9 line 543 names the default "Submitted quiz/assignment as minimum; passing score and grading threshold must be explicitly decided" | (a) started attempt suffices (today's behaviour), (b) a scored/`complete` attempt is required, (c) a passing score is required | Local-db test 02 proves today a started-only quiz yields a certificate. Changing it alters who earns certificates going forward |
| Should a passing score or grade threshold gate completion? | Master §9 line 543 ("must be explicitly decided") | threshold per quiz/assignment, or none | Affects certificate eligibility and gradebook semantics |
| Which vocabulary is canonical: `read`/`completed` only, or also `graded`? | Master WP-03 §3 line 183 requires one definition but names none | pick one set for trigger, guard, `progressionStates.ts`, reports | Determines whether the certificate trigger or the client helpers are the one to change |
| How are the 16 assignment and 7 quiz historical rows and the 2 affected certificates handled? | Start Here line 30; Master WP-03 §6-7 lines 186-187; §9 line 540 | audit-only; mark "requires review"; case-by-case invalidation after approval | Student achievement records; explicit approval required |

## What this branch does and does not do

- Tests the current behaviour and labels the policy-dependent checks `[policy gap T-09]` and
  `[inconsistency T-10]` so the suite documents the gap without pretending a decision was made.
- Drafts (not applies) the two authorization migrations that are required regardless of the policy choice.
- Changes no student record, certificate, grade or attempt.
