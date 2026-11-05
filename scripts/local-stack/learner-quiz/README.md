# Learner-quiz mode of the shared isolated runner (owner delta)

**Status: NOT RUN. Not dispatched.** This directory and the `learner-quiz` job in `.github/workflows/e2e.yml` are the shared-runner
owner's integration of three separately reviewed sources. Nothing here is acceptance of any feature.

| Source | Identity | Owner | Role here |
|---|---|---|---|
| #141 quiz player | `eba62b0` (tree `90f2cb5f`) | quiz thread | product code under test |
| Quiz fixture | `3a6ffaa` (tree `5f3facd2`), qualified 17:27Z | quiz thread | preflight, fixture, spec (14 cases), config |
| T09 runtime harness | `c64a8fc` (with #136 `9cd162f`) | shared-runner owner | stack, guards, pinned NEW migrations |
| Hermetic served app | `f169429` (tree `94ba0c19`) | shared-runner owner | TEST-SERVED copy of the build |
| This delta | see the composition receipt | shared-runner owner | `learner-quiz` job, function subset, edge check |

## Order of the job

1. Static selftests, all with no stack: functions subset, edge check (MOCKED docker), timer oracle, stack-net (FAKE), edge-deps,
   closure-install, and owned-proc (local processes, MOCKED ss).
2. **Prep (`lq_prep`), before any stack exists:**
   - `functions-subset.sh` reduces the disposable workdir to score-quiz, byte-identical (TEST-SERVED FUNCTION SUBSET), with
     `verify_jwt = true`.
   - `closure-install.sh` verifies the reviewed, integrity-pinned dependency closure, copies it, verifies the copy, and sets
     `import_map` for score-quiz in the workdir config. A missing, tampered or unclosed closure fails here, before boot.
3. **Owned network** `ic-t09-new-net-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT` with owner `…-lq`.
   - This is the exact name the unchanged `stack-net.mjs` accepts. An `ic-lq-net-…` name would be refused before Docker.
   - It is shared with the t09-runtime NEW stack, so the two jobs are mutually exclusive by their dispatch `if:`.
   - `checkLearnerQuizJob.test.ts` asserts every stack-net call, start and edge check uses this name, and that the guard pattern
     is unchanged.
4. `supabase start`. The only start-line difference from T09 is that edge-runtime is not excluded.
5. Endpoint export, target guards, then net verify, listeners, ports and mail.
6. **Edge check 1 of 3:** `edge-runtime-check.sh` at initial start, before bootstrap. It checks exactly one runtime, on the owned
   network only, with no published port and SUPABASE_URL set to the in-network gateway.
7. STAGE PRE, bootstrap, identities, then the seven pinned migrations (NEW).
8. `functions serve`, launched through `owned-proc.mjs start`, which records pid and kernel start time at launch.
9. **Edge check 2 of 3:** after the serve recreation and BEFORE readiness.
   - It polls `edge-runtime-check.sh` (docker inspection only, no request to any function).
   - Check 1 recorded the start-generation container ID. This check accepts only a DIFFERENT container that passes, seen with
     the same ID on two consecutive polls, bounded at 90 s, and records that ID as the serve generation. The original container
     may still be visible on early polls.
   - If serve never replaces the container, the step fails closed. That is a finding.
   - Then it runs net verify and ports.
10. Readiness: score-quiz OPTIONS gives `200 ok`. This is the first request that boots a worker.
11. **Edge check 3 of 3:** after readiness, it requires the SAME serve-generation container ID (`--expect-id`), so a later
    replacement fails. Then, it runs `edge-runtime-check.sh`, net verify, listeners and ports. It also greps the
    runtime log for a remote module download. That grep is a detector only.
12. Build, `check-local-target`, the hermetic selftest, the TEST-SERVED copy, and the preview through `owned-proc.mjs start`.
13. Fixture preflight, `fixture.sh`, then Playwright. The exit status is preserved.
14. Cleanup always runs:
    - `owned-proc.mjs stop … 8080` signals ONLY the recorded process groups. It skips a reused pid. It then requires no listener
      on 8080 and fails on any inspection error.
    - Then `stop --no-backup`, owned-network removal and the leftovers check.
    - Then `stage-evidence` with the explicit receipt list.

## Decision E1 (revised 18:03Z): pinned dependency closure, cache-only, fail-closed

Root selected an integrity-pinned full dependency closure in the test-served function copy, with no fetch at runtime.

**What is built (source and fakes only):**
- `edge-deps.mjs verify <closure> <reviewed PINS.sha256 sha256> <entry URLs…>` checks all of the following:
  - PINS.sha256 matches the reviewed hash, which is pinned in the workflow;
  - the file set is exactly the pinned set: no missing, extra, symlinked or special file;
  - every hash matches;
  - both entry URLs are exact import-map keys;
  - every import-map target stays inside the closure;
  - every static, side-effect and dynamic import in every pinned module resolves to a pinned file.

  A bare, `npm:`, `jsr:`, `node:`, `data:`, root-relative or unmapped URL is refused, and so is a non-literal dynamic import.
- `closure-install.sh` runs that check twice, on the source and on the installed copy. It sets `import_map` in the WORKDIR config
  only. It asserts that `score-quiz/index.ts`, `_shared/utils.ts` and `deno.json` stay byte-identical to the repository. That is
  the function code provenance: the function bytes never change, and only module resolution is redirected.
- The job keeps `LQ_CLOSURE_PINS_SHA256: ''` and `LQ_CLOSURE_DIR` pointing at a directory that does not exist, so **the job
  refuses at prep today** (closure-install exit 31). That is intended: no run until a reviewed closure exists.

**Blocker record (no secrets):**
- Acquisition was attempted once from this environment and refused by the agent proxy (`connect_rejected`):
  - `https://deno.land/std@0.168.0/http/server.ts` (deno.land:443)
  - `https://esm.sh/@supabase/supabase-js@2.39.7` (esm.sh:443)
- Acquisition stopped. There was no retry and no alternate route.
- **Action needed:** produce the closure where egress to those hosts is permitted. It must contain both entry modules and every
  transitive module, with an `import_map.json` and `PINS.sha256`. Review it, commit it under `supabase/functions-closure/score-quiz/`,
  and set the reviewed PINS hash in the job. Root, or an environment root designates, owns that step.

**Open gate E1-R (UNVERIFIED, not assumed):**
- It is not verified that the Edge runtime image pinned by Supabase CLI 2.109.1 honours a per-function `import_map` from config.
- It is not verified that the runtime refuses to fetch a specifier the map does not cover.
- Deno CLI flags such as `--cached-only` or `--no-remote` are NOT assumed to transfer to the Supabase Edge runtime.
- No image or CLI binary is available here, so neither point can be checked. The first real run must establish both. The log grep
  in step 11 is a detector, not proof. A remote download in the log fails the job.

**Withdrawn claim:** the earlier text said the worker first boots before any fixture data exists, and called a run "no foreign
send" for the app data. That inference is withdrawn. Boot order says nothing about what the runtime fetches or sends. Nothing here
claims an absence of foreign traffic from the runtime.

## Known limits of a green run

- It proves nothing about production, the Lovable editor preview, or the published revision.
- The **T-62 failed-start journey is not in the 14 cases.**
  - The quiz thread owns that follow-up (coordinator-scoped direction 17:51Z under the standing user delivery authority).
  - The follow-up will cover a real authorization-denied start; zero attempt, answer, progression and certificate changes; an
    unchanged percentage; Retry; honest controls; Continue after failure; and an allowed-RPC success control.
  - Until that delta is reviewed and added, this mode cannot close T-62.
- `stack-checks.sh mail` ends with T09 fixed text saying edge functions are not served. A NOTE line written before it in
  `mail.txt` marks that clause as not applying here. The T09 file is not edited.
- The container allowlist in `edge-runtime-check.sh` (db, kong, auth, rest, realtime, storage, inbucket or mailpit, pg_meta) is
  from source reading of the T09 start line, not from a measured run. If the first run shows a different set, that is a finding
  to review, not a reason to widen it silently.
- The CLI's handling of the reduced `[functions.*]` config is not exercised here, because there is no Docker or CLI binary in
  this container. A start failure there is a finding.

## Local checks run for this delta (no stack)

| Check | Tier | Result |
|---|---|---|
| `tests/edge-runtime-check-selftest.sh` | MOCKED docker | 8/8 |
| `tests/functions-subset-selftest.sh` | LOCAL (throwaway workdirs) | 7/7 |
| `tests/edge-deps-selftest.sh` | LOCAL, synthetic closures (no downloaded bytes) | 14/14 |
| `tests/closure-install-selftest.sh` | LOCAL, synthetic closure, throwaway workdirs | 7/7 |
| `tests/owned-proc-selftest.sh` | LOCAL processes, MOCKED ss | 9/9 |
| `src/test/ci/*.test.ts` (incl. `checkLearnerQuizJob.test.ts`) | static | 134/134 |
| `check-isolated-workflow.mjs` on the edited file | static | ok |

## Pending composition item

When 407f944 (T-62 fixture) is composed, add `QLC_EVIDENCE_DIR/checks/revoke-access.txt` to the copy step and to the required,
scanned `stage-evidence` list (root, 18:15Z). It is not added before then, because the file does not exist in this job yet.
