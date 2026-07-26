# Security changes — end-to-end review (PR #22)

This document accounts for every change on `claude/security-findings-validation-sry5mr`,
what each one does, and — honestly — why several controls are touched by more than
one migration. It exists because the migration set grew confusing during review.

## 1. Why there appear to be "repeat" migrations

Three separate reasons, only one of which is normal:

1. **Parallel work with `main`.** The three `20260728*` quiz migrations were
   *reconstructed from the live database* (they were Lovable hot-fixes never
   committed). While that was happening, `main` independently merged **#20**
   (server-side quiz scoring + hide answer key) and **#21** (delete QuizTaker +
   restore FK) — the same work, done properly through review. So those three
   migrations are now **redundant duplicates** of merged `main` work.

2. **"Never edit an applied migration" + iterative review.** Each Codex review
   round found a bug in an earlier migration. Correct discipline says the fix is
   a *new* migration, not an edit to the applied one. Over three rounds this
   layered fixes onto the same control (e.g. the calendar-feed token was created
   in `000100`, then its grant corrected in `000300`).

3. **Two genuine mistakes.** The same column-vs-table `REVOKE` error was made
   twice — on `profiles.roles` and on `calendar_feed_token`. A column-level
   `REVOKE` cannot subtract a privilege from a table-level grant, so each needed
   a follow-up migration to actually close it. That part is real rework.

**The fix for the confusion:** none of the `20260729*` migrations are merged yet,
so they can be **consolidated** into a clean set where each control is done once.
See §6.

## 2. The migrations, in three buckets

### Bucket A — ledger backfills (not security changes)
These reproduce migrations already applied to prod so a fresh `db push` matches
the hosted project. They were part of the ledger-repair, not new controls.

| File | What it records |
|------|-----------------|
| `20250524130501_create_project_images_bucket` | The project-images bucket (created out-of-band 2025-05-24) |
| `20260413002243_make_course_buckets_private_and_fix_roles` | Buckets made private + user_roles policy fix |
| `20260413112248_create_notifications_and_progress_snapshots` | notifications / progress_snapshots tables |
| `20260725100011_rls_repair_progressions...` | Progression RLS repair |
| `20260725100152_index_hot_course_fks...` | Hot-path FK indexes |
| `20260725100445_pin_search_path_on_flagged_functions` | search_path pins |
| `20260725101444_create_submission_attachments` | submission_attachments table |
| `20260725222301_pin_grade_columns_fix_columns` | Grade-pinning trigger fn |

### Bucket B — quiz reconstruction (REDUNDANT with main #20/#21)
| File | Superseded by |
|------|---------------|
| `20260728000000_hide_quiz_answer_key` | main #20 |
| `20260728001000_scope_quiz_key_access` | main #20 |
| `20260728002000_restore_quiz_submissions_fk` | main #21 |

These should be dropped in favor of main's reviewed versions.

### Bucket C — unique security work (the real value of this PR)
| File | Control | Touched again in |
|------|---------|------------------|
| `20260729000000_drop_stale_permissive_policies` | RLS cleanup across messages, courses, storage, quiz_questions, events, notifications, availability_slots, assistant_*, profiles.roles, security_events, course_announcements | profiles.roles → `000200` |
| `20260729000100_calendar_feed_tokens` | Per-enrollment calendar token + enrollments staff policy | token grant → `000300` |
| `20260729000200_guard_profiles_roles_on_insert` | Fixes the no-op REVOKE from `000000`: trigger now pins roles on INSERT | — |
| `20260729000300_harden_quiz_taking_and_calendar_token` | Fixes reveal-on-retake + legacy options in the taking RPC; attaches grading trigger; fixes calendar token table grant | — |
| `20260729000400_quiz_grading_and_submission_hardening` | Student upload policy; reveal-gates answer rows; atomic finalize RPC | — |

## 3. Control-by-control (what is actually enforced now, on prod)

- **messages** — self-referential INSERT policies (`cp.conversation_id =
  cp.conversation_id`) that let any user post into any conversation were dropped;
  replaced with a participant check. (`000000`)
- **courses** — `USING (true)` world-read of unpublished courses dropped. (`000000`)
- **storage (course buckets)** — public-role read + auth-only upload policies
  dropped; scoped read/write by course; **student submissions** get their own
  `submissions/<course>/<user>/` path + policy. (`000000`, `000400`)
- **quiz_questions** — FOR-ALL student write policy dropped; answer key withheld.
  (`000000`; core hide is main #20)
- **profiles.roles** — still load-bearing for ~19 policies. INSERT can no longer
  set roles (trigger pins to default); UPDATE already guarded. (`000000` no-op →
  fixed in `000200`)
- **calendar_feed_token** — per-enrollment bearer token; not readable by
  `authenticated` (table SELECT revoked, non-secret columns re-granted); owners
  read via SECURITY DEFINER RPC. (`000100` created → grant fixed in `000300`)
- **quiz reveal** — correct answers withheld until no attempt remains; response
  and answer-row reads both gated. (`000300`, `000400`)
- **quiz attempt limits** — enforced atomically under an advisory lock in
  `finalize_quiz_submission()`. (`000400`)
- **events / notifications / availability_slots / assistant_*** — always-true and
  header-spoofable grants removed. (`000000`)

## 4. Edge functions (20, unique to this PR)

Added `_shared/auth.ts` (`requireUser`/`requireAdmin`/`requireStaff`/
`requireCourseManager`) and applied real auth to 20 functions that previously
relied on `verify_jwt` alone (which the public anon key satisfies) or nothing.
`resume-analyzer`, `evaluate-star-response`, `generate-study-guide` re-check
ownership; `scrape-job-description` validates the URL. All deployed and
byte-verified; `course-calendar-feed` intentionally stays `verify_jwt=false`
(token-gated). This work does **not** overlap main.

## 5. Migration-ledger repair (unique to this PR)

Reconciled 46 timestamp-drifted files, a version collision, 7 uncommitted
migrations, and an unversioned bucket migration so repo (155) = prod ledger
(155). Independent of the security controls.

## 6. Recommended consolidation

Because the `20260729*` set is unmerged, collapse it to a minimal, correct set:

1. **Drop Bucket B** (`20260728*`) — take main's #20/#21.
2. **One RLS-hardening migration** — `drop_stale_permissive_policies` **with**
   the `profiles.roles` INSERT trigger folded in (no separate `000200`).
3. **One calendar-feed-token migration** — with the table-grant done correctly
   from the start (no separate `000300` grant fix).
4. **Quiz hardening** — keep only what main #20 does *not* already do; fold the
   reveal/options/atomic/upload fixes into a single migration, or drop entirely
   if #20 covers them.
5. **Re-align prod ledger** to the consolidated versions (the applied end-state
   is identical; only the recorded version numbers change).

Net effect: each control appears **once**, done correctly, with no follow-up
patch migrations — which is the state this should have been in.

## 7. Consolidation outcome (done)

Executed against current `main`:

- **Dropped as redundant** (main #20/#21 own them): the three `20260728*` quiz
  migrations, my `score-quiz`, and the quiz UI/service files — resolved to
  main's version.
- **Consolidated** the layered `20260729*` set from five migrations to three:
  - `000000` — RLS/storage hardening; its `quiz_questions` section removed (main
    #20 owns it), the student-submission upload policies folded in.
  - `000100` — calendar-feed tokens, with the table-grant done correctly in one
    place (the `000300` fix folded in).
  - `000200` — profiles.roles INSERT guard (unchanged).
  - `000300` and `000400` deleted.
- **Kept intact**: the 19 edge-function hardenings (not `score-quiz`), the
  signed-URL work, blog RPC, ledger repair.

Verified on the merged tree: tsc clean, 887/887 tests, production build passes.

### Deferred to a focused follow-up (against main's #20 quiz code)
These are genuine and are **already applied on the hosted project**, but they
modify main's quiz functions, so they belong in their own reviewed change rather
than re-entangling this PR:

- `score-quiz`: re-check `can_access_quiz()` before grading (answer-oracle for
  inaccessible quizzes).
- `get_quiz_questions_for_taking`: withhold answers until attempts are exhausted;
  legacy `options`-format fallback.
- Atomic attempt-limit finalization (`finalize_quiz_submission` advisory lock).
- Reveal-gate per-question results (score-quiz response + `quiz_submission_answers`
  row visibility).

### Prod ledger note
Because these were applied to prod during review, the hosted project is *ahead*
of this consolidated branch on the deferred quiz-grading items (prod is more
hardened, not less). The kept migrations (`000000`/`000100`/`000200`) are already
recorded on prod, so merging changes nothing there; a fresh build from the repo
reproduces the kept controls correctly.
