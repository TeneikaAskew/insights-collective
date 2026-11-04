# Disposable local database for RLS, trigger and seed rehearsals

Everything here runs against a plain PostgreSQL on loopback. Every script refuses a connection
string that is not `127.0.0.1`, `localhost` or a `/tmp` socket, so none of it can reach a Supabase
project. No file in this folder contains credentials or user data.

Why a snapshot and not a migration replay: the base tables (`courses`, `profiles`, `blog_posts`,
…) predate the first file in `supabase/migrations/`, so `replay-migrations.sh` applies only 28 of
233 files. The snapshot path reproduces the live schema exactly.

## Build

1. Start a local cluster (PostgreSQL 16 was used):
   `initdb -D /tmp/pgdata` then `pg_ctl -D /tmp/pgdata -o "-p 54329 -c listen_addresses=127.0.0.1" start`.
2. Produce a schema snapshot directory with five files, `01_types_tables.sql`, `02_constraints_indexes_views.sql`,
   `03_functions.sql`, `04_rls_policies.sql`, `05_triggers_grants.sql`, from **read-only catalog
   queries** against the project (`pg_type`, `pg_attribute`, `pg_constraint`, `pg_indexes`,
   `pg_get_functiondef`, `pg_policies`, `pg_get_triggerdef`, `role_table_grants`). Keep the
   snapshot outside the repository and scan it for secret-shaped strings before use.
3. Write `identities.tsv` into the snapshot directory by running the same query as
   `scripts/local-db/identities.sql` against the live catalog (read-only): one line per function,
   policy, trigger, RLS flag, table grant and function grant with the md5 of its definition. The
   build verifies every object against it; counts alone cannot catch a same-count wrong definition.
3b. Write `manifest.env` into the snapshot directory with the live counts the replay must reproduce
   (`TABLES`, `VIEWS`, `MATVIEWS`, `FUNCTION_NAMES`, `POLICIES`, `TRIGGERS`, `RLS_TABLES`, `ENUMS`), and
   `VIEWS_BROKEN_LIVE=<name,...>` for any view the live catalog cannot evaluate (today: `quiz_analytics`,
   which raises 42P17 infinite recursion on read).
4. `createdb ic_snapshot` then `scripts/local-db/build-from-snapshot.sh postgresql://postgres@127.0.0.1:54329/ic_snapshot <snapshot dir>`.
   The build **fails** on any non-idempotency DDL error and on any manifest mismatch; a partial or
   tampered snapshot cannot pass as complete.

## Use

- `scripts/local-db/run-sql-tests.sh <loopback url> [test.sql ...]` runs every `tests/*.sql` (or the named
  ones); each prints `PASS`/`FAIL` lines and exits non-zero on failure. Tests impersonate users the way
  PostgREST does (`set_config('request.jwt.claims', …)` plus `set role …`) and roll back.
  - `01_cross_course_rls.sql`: 3 learner-data tables × 9 actors (course owner, co-instructor via
    `course_assignments`, instructor enrolled as a learner, unrelated instructor, two students, admin,
    anon). 51/54 on the live-equivalent schema, 54/54 with `20261101000000` applied.
  - `02_assessed_progression_guard.sql`: which assessment states may reach a done state and when the
    certificate trigger fires. Started-only quizzes are tested separately from submitted work; the
    checks tagged `[policy gap T-09]` and `[inconsistency T-10]` assert current behaviour on purpose.
  - `03_start_quiz_attempt_authz.sql`: who may start a quiz attempt. 6/10 on the live-equivalent
    schema, 10/10 with `20261101000100` applied.
  - `04_quiz_completion_integrity.sql` (T-09): drives `start_quiz_attempt` as the learner, learner-side writes,
    and `finalize_quiz_submission` as service_role, then progression and certificate. A started attempt (with or
    without autosaved answers) and a learner self-flip to `complete` must not count. 8/17 on the live-equivalent
    schema, 17/17 with `20261101000200` applied. `[decision]` checks assert current behaviour that depends on the
    unmade minimum-submission vs passing-grade policy.
  - `05_identity_retarget.sql` (T-09 follow-on): completion evidence stays bound to its identity. A done
    progression row moved onto a never-attempted quiz, or a finalized attempt moved from quiz A to quiz B, must not
    count; genuinely finalized zero-score attempts still do. Live-equivalent 5/11; with `20261101000300` 11/11.
  - With `20261101000000`, `000100` and `000200` all applied: 01 54/54, 02 16/16, 03 10/10, 04 17/17. 02's started-only
    checks now assert the required refusal (14/16 on the live-equivalent schema).
  - Added for the November release, written but NOT yet executed (no counts recorded until a run on the isolated
    database): 03 gains an assigned co-instructor (published and unpublished, allowed) and an instructor enrolled
    only in another course (refused); 05 gains X1 to X6, moving a finalized attempt or done row onto a quiz in an
    unenrolled course or a hidden quiz of an enrolled course; 08 gains T0 to T8, a learner who lost access to the
    old target (unenrolled, or item unpublished) can neither edit the row nor move it onto a target they can still
    reach; `07_narrow_reads.sql` is new, the behavioural test of `20261102000000` (career quiz attempts by owner and
    anonymous session, feedback by owner or admin, blog settings by admin or instructor, with insert/write controls).
- `scripts/local-db/local-preseed.sql` supplies the rows `e2e/fixtures/seed.sql` assumes already
  exist in production (reference course, modules, the three `e2e-*` accounts) so the seed can be
  rehearsed offline: `psql <url> -f scripts/local-db/local-preseed.sql` then
  `psql <url> -v ON_ERROR_STOP=1 -v e2e_password=local-only -f e2e/fixtures/seed.sql`.
- To try a drafted migration: apply it to the local database with `psql -f`, rerun the tests, and
  keep a second database built without it as the baseline.

## Safety and negative tests

- `assert-local-dsn.mjs` is the single libpq DSN validator for the repository: the E2E guard imports
  `evaluateLibpqDsn` from it for `SUPABASE_DB_URL` (with isolated-project support), and the local tools
  use `assertLocalDsn` (loopback only). Its semantics were checked against libpq's own
  `PQconninfoParse` (ctypes, no connection) by `tests/dsn-differential.py`: `'#'` is data to libpq, not
  a fragment; userinfo splits at the first `'@'`; percent-decoding applies everywhere; query
  `host`/`hostaddr`/`port` override the authority; in keyword form a backslash escapes the next character
  even unquoted, so `password=x\ host=localhost` hides the real host. All of those are refused outright;
  the keyword form accepts only plain `key=value` tokens with a safe value charset.
- `tests/build-negative.sh` is itself an entrypoint (it creates and drops databases) and validates its
  `PGBASE` and strips the libpq environment before its first `psql`; `tests/guard-negative.sh` drives it
  with remote and override inputs too.
- `tests/guard-negative.sh` ends with genuine positive controls: valid loopback and declared-isolated
  targets must reach the fake `psql`, so an always-refusing guard cannot look green.

- Every entrypoint runs `assert-local-dsn.mjs` before `psql`: one loopback endpoint only; multihost,
  `hostaddr`, query/keyword host overrides, `service=`, `options=`, percent-encoding and libpq
  environment overrides are refused, and `psql` runs with `PGHOST`/`PGHOSTADDR`/`PGSERVICE`/`PGPORT`
  removed. `tests/guard-negative.sh` proves refusal happens before any `psql` process (fake `psql` on
  `PATH` records invocations); `tests/build-negative.sh` proves the build rejects a same-count
  wrong-identity snapshot, an injected DDL failure, a tampered manifest and a missing identities file,
  and that the live-broken view omission is reported explicitly.

## Limits

This is not a Supabase stack: no PostgREST, no GoTrue, no storage API, no realtime, no Edge
Functions. It validates SQL-level behaviour (policies, triggers, functions, seeds). Browser E2E
still needs an API in front of a database, which this folder does not provide.
