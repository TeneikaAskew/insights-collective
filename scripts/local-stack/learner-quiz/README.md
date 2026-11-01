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

1. Shared steps unchanged from `t09-runtime`: policy check, owned network, `supabase start`, endpoint export, target guards, ports,
   listeners and mail, STAGE PRE, bootstrap, identities, then the seven pinned migrations (`apply-reviewed.sh NEW`).
2. **Edge delta.** `supabase start` does not exclude `edge-runtime`. This is the only difference in the start line.
   - `functions-subset.sh` reduces the disposable workdir to score-quiz (TEST-SERVED FUNCTION SUBSET, byte-identical), and the
     workdir config to `[functions.score-quiz]` with `verify_jwt = true`.
   - `functions serve` starts, then the bounded score-quiz readiness probe.
   - `edge-runtime-check.sh` checks for exactly one edge-runtime container, on the owned network only, with no published host
     port and with SUPABASE_URL pointing at the in-network gateway. The shared net, listener and port checks are re-run with the
     runtime up.
3. Production build, `check-local-target dist`, and the hermetic selftest on that build. Then `hermetic-dist.mjs make` and
   `verify` produce the TEST-SERVED copy (NOT production bytes), which is checked again and previewed with
   `vite preview --outDir`. The preview must serve that copy byte for byte.
4. The fixture's own `preflight.mjs --dist <served copy>` runs before any fixture write, then `fixture.sh`, then Playwright with
   the quiz config. Its exit status is preserved.
5. Cleanup always runs: background servers, `stop --no-backup`, owned-network removal, leftovers. Then `stage-evidence` with an
   explicit receipt list. Raw start, functions and preview logs and `playwright-output/` are never staged.

## Decision E1: Edge module downloads are declared, not hermetic

When the score-quiz worker boots, the edge runtime downloads `https://deno.land/std@0.168.0/http/server.ts` and
`https://esm.sh/@supabase/supabase-js@2.39.7` (and esm.sh's transitive modules). The repository has no lockfile with integrity
hashes. This job therefore:
- does not pin those bytes;
- does not restrict the runtime's outbound access, because it uses a bridge network and changes no network setting.

`functions-subset.sh` refuses any change to the declared URL set. The worker first boots on the readiness probe, before any
fixture data exists. score-quiz itself sends only to SUPABASE_URL (by source).

Options for the reviewer:
- **(a)** Accept E1 as a labelled infrastructure download for the first run.
- **(b)** Require vendored modules with an integrity lock before any run. That adds bytes that are not in the repository today,
  so it needs its own review.

The recommendation is (a), with the label carried into every receipt. A run under (a) is not "no foreign send" for the runtime.
It is that only for the browser and the app data.

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
| `src/test/ci/*.test.ts` (incl. new `checkLearnerQuizJob.test.ts`) | static | 131/131 |
| `check-isolated-workflow.mjs` on the edited file | static | ok |
