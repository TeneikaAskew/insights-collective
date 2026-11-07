# Preparation 1: release identity verification (read-only), results and procedure

Proposal to the PR134 coordinator (owner of schema, db-migrate and the shared runner). Nothing here was changed; every statement below is a read taken from this session between 17:14 and 17:25 UTC on 2026-11-04.

## A. Frontend: what is actually served

| Check | Result |
|---|---|
| `GET https://insightscollective.org/` | 200, 6,900 bytes; `data-commit-sha="82a971962d7525d5e0c7b56801578b765650699a"`, `data-artifact-id=6460eba6ff6858fa4d27870a54bf4da863dabecb6d48eb18ed18067cf4b257c0` (kind `dwl_content_hash`) |
| Chunk graph walked from the index (`/assets/*.js` referenced by the index, then every chunk name found inside fetched chunks, to a fixed point) | 55 eager chunks referenced by the index; 362 JavaScript files in total after four rounds (213, 93, 2, 0 new); 17 MB; sorted-name sha256 of the set begins `535fa4a2e0f773e0` |
| Merged #163 roster/Reports strings ("Learners with an enrollment in this course.", "No submission from the learner.", "Submitted, no score yet.") | each present in exactly one served chunk, `CourseBuilder-DK4Zhlqy.js`, which also carries the `view=students` marker |
| Unmerged #147 unique string ("Try a different title or category.") | absent from all 362 chunks (the similar "No courses match your filters" found in `AdminCourses-3CwZ2HLc.js` is `main`'s AdminCourses text, not #147) |
| Production project ref inside the bundle | present in one chunk, as expected for the production build |

What this establishes: the served bundle **contains** merged #163 code and **lacks** unmerged #147 code, consistent with the index marker claiming `main` 82a97196. What it does not establish: byte identity with a build of that tree. A reproducible comparison needs the same build environment (Lovable's `VITE_*` values and installer), which this session does not have; the chunk-name set and the `data-artifact-id` content hash should be recorded in the tracker as the served fingerprint for this observation time, and the coordinator should ask Lovable History for the Publish record that produced it.

## B. Database: effective state of every object the November migrations touch

Read with one `pg_policies` / `pg_proc` / `pg_trigger` / `schema_migrations` query (names, commands, md5 prefixes of predicates and bodies, and pattern checks; no row data).

| Repo intent (unapplied file) | Live effective state (17:20 UTC) | Verdict |
|---|---|---|
| `20261101000000` scope instructor reads to own courses | "Instructors can view course progressions", "Instructors can view quiz submissions", "Instructors can view quiz submission answers" all still contain the global `get_user_roles` instructor clause | **Not effective** |
| `20261101000100` `start_quiz_attempt` requires `can_access_quiz`; revoke anon | body has no `can_access_quiz` reference; EXECUTE still granted to `anon`, `authenticated`, `service_role` | **Not effective** |
| `20261101000200` only a complete attempt counts; `pin_quiz_submission_score` redefined | `enforce_assessed_progression` body still references `pending_review` (the 20261031 guard); `pin_quiz_submission_score` body also references `pending_review` | **Not effective** |
| `20261101000300` `pin_quiz_submission_identity` trigger | trigger and function absent on `quiz_submissions` | **Not effective** |
| `20261101000400` `pin_assignment_submission_identity` trigger | trigger and function absent on `assignment_submissions` | **Not effective** |
| `20261101000500` restrictive "target must be accessible" policies; certificate evidence | no policy with that name on either table; `auto_issue_certificate_on_progression` body does not reference `is_final_assignment_submission` | **Not effective** |
| `20261101000600` `is_final_assignment_submission`, redefined guard, issuer, grade pin | function `is_final_assignment_submission` absent; guard and issuer bodies unchanged (md5 `a61f74d1`, `1bc85528`) | **Not effective** |
| `20261102000000` narrow reads (#159) | `blog_settings` still has "Anyone can view blog settings"; `user_feedback` "Users can view feedback" has the same predicate md5 (`b326b506`) as that unconditional policy; `career_quiz_attempts` policies carry the old names | **Not effective** |
| Ledger | last two rows `20261031120009`, `20261031120030`; nothing later | consistent with the above |

Both directions therefore agree: the live backend is at the recorded 20261031 state. The ledger is not an orphan-apply case here.

Live grants also confirmed, for the acceptance negatives: reorder RPC grants recorded for T-55 / C9 (fix in draft #202, not applied); `check_course_completion` is SECURITY DEFINER with EXECUTE for PUBLIC and `anon` (T-23); `course_roster_stats` is executable by `anon` although its migration grants only `authenticated` (minor drift, record only); `enforce_assessed_progression` EXECUTE is `postgres` and `service_role` only (matches `20261031120030`); every trigger on the three tables is enabled (`O`).

## C. What the two comparisons do and do not establish (scope, timestamps, unresolved differences)

| Comparison | Scope | Time (UTC) | Establishes | Does not establish |
|---|---|---|---|---|
| Index marker | one HTML attribute pair on `/` | 14:50:18 and 17:14 | the served index claims commit 82a97196 and content hash 6460eba6... | which build produced it; whether every chunk belongs to that build |
| Chunk-graph string presence/absence | 362 JavaScript files reachable from the index by static chunk references; five literal strings (three #163, one #147-unique, one `main` AdminCourses control) | 17:14 to 17:22 | the served JavaScript contains #163's roster/Reports strings and does not contain #147's unique string; i.e. the served UI is at least post-#163 (`d48be7a5` or later) and pre-#147 | byte identity with a build of 82a97196; presence of #171 (docs only) or of any other merged change not probed; CSS/asset identity; dynamically named chunks not reachable by the static walk; Edge Function versions; the Lovable Publish record |
| Catalog read | policy names, commands, predicate md5 prefixes and three body-pattern checks for the objects the eight November files touch; function ACLs; trigger list; ledger tail | 17:20 | none of the eight files is effective by any of its distinguishing markers; the ledger is consistent | that no other unrecorded change exists on those objects (md5 prefixes were not compared to the 2026-10-31 snapshot's identities); row-level data state |

Unresolved differences to carry in the tracker: (1) bundle byte identity (needs the producing build or Lovable History); (2) a comparison of the live md5 prefixes against `scripts/local-stack/schema/identities*.tsv` to confirm the 20261031 baseline exactly; (3) Edge Function deployed versions; (4) the time gap between the frontend observations (14:50 to 17:22) and the catalog read (17:20) is small but the two are not a single atomic snapshot.

Within that scope, the evidence is consistent with a served UI that includes merged LMS code (#163) running against a backend whose November contract is not in force: the live inline quiz player is the pre-#141 direct-insert path (C7); instructor reads are globally scoped (T-05); a started-only quiz still satisfies the completion guard (T-09); the #159 narrow reads are not in force. This is a scoped observation, not a full deployment claim. No data correction follows from it; it is the baseline the apply plan must start from.

## D. Procedure to repeat before and after any apply (for the coordinator's apply plan)

1. Run the same read-only query (object list: the three instructor SELECT policies, the two "target must be accessible" policy pairs, `start_quiz_attempt`, `enforce_assessed_progression`, `pin_quiz_submission_score`, `pin_quiz_submission_identity`, `pin_assignment_submission_identity`, `is_final_assignment_submission`, `auto_issue_certificate_on_progression`, `pin_assignment_grade_columns`, the three #159 policies, plus the four `proacl` rows) and store the md5 prefixes with the time.
2. Record the pre-apply row counts per affected table (read-only) as the compatibility baseline.
3. Apply one file per `db-migrate.yml` dispatch on the ref that carries the file, `confirm: apply`, with `verify_table`; never `apply_migration`, never `ALL`/`RECONCILE`.
4. Re-run step 1; every verdict above must flip to "effective", and the ledger must hold exactly the filename versions.
5. Record the served fingerprint (index marker, artifact id, chunk-set hash) at the same time, so the tracker has a paired frontend/backend identity line.

Open for the coordinator: `db-migrate.yml` has no `permissions:` block and no `environment:` protection (plan C12); the completion contract decision (plan section 9 item 1) precedes `20261101000200`.
