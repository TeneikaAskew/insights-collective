# Anonymous public-catalog acceptance: proposal (prepared, NOT run on any real stack)

**What it is.** A real public-UI acceptance on an owned, disposable, loopback Supabase stack.
- **Scope:** anonymous visitors only. No login and no Edge functions.
- **Covers:** the public catalog, `?category=`, Estimated time, course detail, the home page's featured courses, and the T-42 collapsed-rail names.
- **Viewports:** desktop 1440×900, tablet 834×1112 and mobile 390×844, plus a keyboard path.

**Status.** Nothing here has run against GoTrue, PostgREST or a real `supabase start` database. Nothing was dispatched. This file is published only as part of a draft PR. The tiers that did run, all local, are listed in the evidence matrix.

## Owned paths (confirmed free by the local-stack/PR134 lane, 22:17Z)

- `e2e/public-catalog/**`
- `scripts/public-catalog-fixture/**`
- `playwright.public-catalog.config.ts`

No file in `scripts/local-stack`, `scripts/e2e`, `e2e/support`, the workflows or the migrations was edited. `scripts/e2e/assert-safe-target.mjs` (the shared target guard) is imported as-is.

## Base and labels

**LOCAL-SHIM (historical) / UNRUN / integration-blocked / BLOCKED (no proof producer).** Nothing in this lane is acceptance. The only browser runs ever made used a loopback shim API under a rehearsal tier that no longer exists; the real stack run has never happened.

- One branch, `claude/public-catalog-acceptance-proposal`, stacked on #145 (`6f61532b`): the specs need #145's catalog behaviour. T-42's files are not here; their owner publishes them (#151). S1 asserts T-42 and is expected to fail until T-42 is on the tested ref.
- **Runner composition (agreed with the PR134 runner owner, 23:47Z).** The browser boundary imports helpers that live on #152, so the runner ref must be an explicit composition of the #145, #142, #152 and #150 heads, each named by SHA. Nothing is dispatched until that composed ref is approved.
- **Own-config skip.** main's `playwright.config.ts` (`chromium-member`, `testDir: './e2e'`) collects every `e2e/**` directory. `playwright.public-catalog.config.ts` sets `PUBLIC_ACCEPT_OWN_CONFIG=1`, and each spec calls `test.skip(!UNDER_OWN_CONFIG, ...)`.

## Run order (`run.sh`; each step fails closed with a fixed code and prints no raw output)

1. **Inputs.** `PUBLIC_ACCEPT_OUT` must not exist; `PUBLIC_ACCEPT_RUN_ID` is 32 hex; `PUBLIC_ACCEPT_TIER` is unset or `authentic`; `PUBLIC_ACCEPT_LIST_ONLY` must be unset.
2. **Helper pins** (`helper-pins.mjs`). The 4 imported helpers must exist and match their git blob ids (below). Absence or drift refuses.
3. **Guards** (`guards.mjs`): loopback app and API origins; the shared guard (`assert-safe-target.mjs`, mutating); no `E2E_ISOLATED_TARGET_REF`; anon key; canonical DSN plus private passfile (`pgconn.mjs`); the proof consumer (`proof.mjs`).
4. **Shared PRE contract** (`pre-contract.mjs`). This lane consumes the shared owner's reviewed owned-stack PRE contract and writes none of its own. The contract is the T09 one, which keeps pg_net and intercepts its queue: `scripts/local-stack/t09/egress-guard.sql` 4775946e, `egress-sentinels.sql` 5693cf5e, `egress-verify.sql` 17a9c24f and `stack-checks.sh` 9657af04. Those files are on c64a8fc (#140) and f2112ce, not on main.
   - Its scope is the DB's pg_net path only. It is "intercepted, not verified" and does not control runner or container egress.
   - The pin table now holds the 4 full T09 PRE blobs read from composed job #157 f0fbd1e7, whose call order T source-qualified at 04:24Z. On a ref without those exact files every run refuses (HELPER_ABSENT or HELPER_DRIFT). Before that the table was EMPTY and refused with `PUBLIC_CATALOG_E_BLOCKED_NO_PRE_CONTRACT`.
   - pg_net is never refused or uninstalled here.
   - `pre-stack.sql` is a read-only **diagnostic inventory** (extension versions, user-trigger count) written to evidence. It gates nothing: a prosrc pattern is not a transitive no-egress proof.
5. **Served-asset provenance** (`served-build-check.mjs` + `served-provenance.mjs`).
   - **Every** file in `HERMETIC-PROVENANCE.json` is fetched from the served origin and must hash to its pin. That covers lazy JS/CSS chunks and imported assets, not only what index.html names.
   - `/` must hash to `served_index_sha256`, and every index reference must be same-origin and pinned.
   - The entry bundle must name this stack's API origin.
   - The check cannot enumerate extra paths a server might answer. So the specs also bind **every response the browser actually receives** from the app origin: a pinned file must match its hash, and `/` or an SPA route must match the served index. Anything else is UNBOUND and fails the test.
   - The local avatar copy stays BLOCKED (missing).
6. **Hermetic verify**: `scripts/served-app/hermetic-dist.mjs verify` (f169429 contract). Absent today, so the run stops here even if a producer existed.
7. **W0** must be pristine (`public.courses|0|empty`, `public.modules|0|empty`), then the INSERT-only **seed**, then **W1**.
8. **Browser specs**, raw output private; only `playwright-summary.txt` (project, location, title, status) reaches evidence.
9. **W2.** A W2 failure or any W2 ≠ W1 **stops the run before any write probe**.
10. **Anon probe** (`anon-probe.mjs` + `probe-classify.mjs`), then **W3** (must equal W1; supporting evidence only).

**Output contract.**
- `$PUBLIC_ACCEPT_OUT/evidence/` is the only directory a runner may upload. Its files are allowlisted: `STEPS.txt` (step names and fixed codes), `pre-stack.txt`, `W0..W3.txt` (table name, row count, md5 per table), `MANIFEST.json`, `playwright.exit`, `playwright-summary.txt`, `anon-probe.exit` and `anon-probe-summary.txt`.
- Private staging is `mktemp -d`, mode 0700 under `umask 077`, and holds raw psql, Playwright and probe output. It is never printed or uploaded, and a `trap` removes it on every exit.
- No traces, videos or screenshots are recorded. Probe records never include a response body, a header or a non-fixture id.
- psql runs under `env -i` with only `PATH` and `PGPASSFILE` set, `-w`, and the canonical password-free DSN `postgresql://user@loopback:port/db` in argv. Ambient `PG*` variables are refused.
- There is no DB cleanup, and no DELETE, TRUNCATE or DROP outside the rolled-back anon probe. Whole-stack disposal belongs solely to the runner job.

## What this lane needs from the local-stack/PR134 lane (proposed integration, no shared file edited)

1. **A trusted pre-seed owned-stack proof producer.** It must read `stack_id` from the stack's DB and through its PostgREST before anything is written. It writes `{version:2, stack_id, db_read, api_read, run_id, produced_before_seed:true, producer}` to a regular, single-link, owner-only 0600 file.
   - The consumer reads it through `private-file.mjs`, the c74986bc opened-handle pattern. The open uses `O_RDONLY|O_NOFOLLOW|O_NONBLOCK|O_NOCTTY`, so a FIFO cannot stall it.
   - The checks are decided on that descriptor: regular file, one link, this uid, mode exactly 0600, then a bounded read of at most 4 KiB.
   - Then come the run binding and the DB/API pairing.
   - The passfile uses the same reader.
   - A correct shape alone is NOT ownership. `TRUSTED_PRODUCERS` holds only `scripts/public-catalog-fixture/pairing-producer.mjs` at blob b8a555ba9f15eee1b17f477ba8c477a6434fa4ec; any other producer refuses with `PUBLIC_CATALOG_E_BLOCKED_NO_PRODUCER`, and a producer file whose bytes differ refuses with `PUBLIC_CATALOG_E_PRODUCER_PIN`. Pins are source qualification, not run approval.
2. **The hermetic served-app contract (f169429) on the composed ref.** Build against the owned stack, derive the served directory with `HERMETIC-PROVENANCE.json` and serve it on loopback. Evidence is labelled "TEST-SERVED MODIFICATION: NOT production bytes".
3. **Local avatar data for `/`.** CommunityShowcase hotlinks `i.pravatar.cc`, so A10 cannot pass. The fix is either a product change or a provenance-recorded test-served substitution, and either one needs its own review. This lane does not choose it and keeps no exception.
4. **A runner job** on the composed ref. It stands up a fresh stack, passes the PG15 parity gate, exports `PUBLIC_ACCEPT_*` (including `RUN_ID`, `DB_PASSFILE`, `PRODUCT_DIST` and `SERVED_DIR`), runs `run.sh` and uploads only `$PUBLIC_ACCEPT_OUT/evidence`. It needs its own stack and its own run approval.

## Browser boundary (imported, pinned, not weakened)

The specs extend `e2e/lesson-editor/egress-test.ts` (from #152). Imported as-is, never copied:

| Helper | git blob | From |
|---|---|---|
| `e2e/support/chromium-executable.ts` | ce26c40e | main 32ccf7df (shared) |
| `e2e/lesson-editor/egress-test.ts` | edd43ce4 | #152 c74986bc |
| `e2e/lesson-editor/egress-boundary.ts` | 7b0474fe | #152 c74986bc |
| `e2e/lesson-editor/egress-proxy.ts` | 8934885b | #152 c74986bc |

If #152's helpers change in review they are re-pinned, never forked.

**Layers.**
- The resolver rule is `MAP * 127.0.0.1:1, EXCLUDE localhost, EXCLUDE 127.0.0.1`.
- An allowlist proxy forces loopback through it (`<-loopback>`), so other loopback ports, redirect hops and WebSocket tunnels are refused.
- A context route and WebSocket filter aborts non-allowlisted origins.
- Redirect, service-worker and unparseable-URL observation fails the test.

The allowlist is exactly two origins: `PUBLIC_ACCEPT_BASE_URL` and `PUBLIC_ACCEPT_API_URL`, mapped onto `LE_APP_ORIGIN` and `LE_API_ORIGIN`. `LE_ALLOWED_ORIGINS` and `LE_EGRESS_CONTROL` are refused. **Any foreign attempt fails the test, including `cdn.gpteng.co` and `i.pravatar.cc`. There is no tolerated-third-party list and no rehearsal tier.**

The previous design pinned the browser to a dead proxy that bypassed all of loopback, plus a page route. Review found that insufficient, and it is gone. `PUBLIC_ACCEPT_LIST_ONLY=1` is honoured only together with `--list`.

## Independent UI oracles

The specs compare against literal strings and never import `src/lib/estimatedTime.ts`:
- **A2:** 2.5 hours, 12 hours, 1 hour, nothing for NULL, Under 0.1 hours and 4 hours, each read from the exact "Estimated time:" value node. The legacy-duration negative applies only where it discriminates. The flags course stores duration 4 and estimated_hours 4, so "4 hour" sits inside the correct "4 hours" and is not asserted absent. No fixture data was rewritten.
- **A7:** an unrelated `pca_keep=1` sentinel must survive Clear category.
- **A8:** the public module is present and the unpublished one absent.
- **A9:** compares ids only, so no body is printed.
- **A10:** the exact featured set is `PCA Analytics Course`, `PCA BI Course` and `PCA Leading Space Course`, in order, with their literal values.

## Fixture (`fixtures.mjs`, generating `seed.sql`; synthetic and run-owned, ids `7e57ca7a-0000-4000-8000-…`)

| Row | Stored flags | Expected for an anonymous visitor | Why it is in the fixture |
|---|---|---|---|
| PCA Analytics Course | published=true, status=published, 2.5 h, duration 99 | listed; "2.5 hours" | estimated time, not the legacy duration |
| PCA BI Course | true / published, 12 h | listed | group "Analytics & BI" (2 names) |
| PCA Leading Space Course | true / published, 1 h, category `' All categories'` | listed | equals the sentinel up to whitespace |
| PCA Newline Name Course | true / published, NULL estimate, category `'Data\nScience'` | listed, no Estimated time | normalization, and a missing estimate (the live CHECK `estimated_hours > 0` rejects 0) |
| PCA Unicode Course | true / published, 0.04 h, `Données & IA` | listed; "Under 0.1 hours" | Unicode slug and format edge |
| PCA Published-Flag Draft-Status Course | **published=true, legacy status=draft** | see the canonical row below | the intended contradictory-field fixture |
| PCA Private Draft Course | **published=false**, status=draft | **not visible** (UI or REST) | the private negative, distinct from the row above |
| 3 modules | published module in a public course; unpublished module in a public course; published module in the private course | only the first is visible | module policy negatives |

**Canonical-field comparison for the contradictory row.**
- **Canonical requirement.** The published boolean is canonical. The anon policies `"Anyone can view published courses"` (`published = true OR auth.uid() = instructor_id`) and `courses_public_read_published` (`published = true`) do not consult `status`. The page's query is `.eq('published', true)`.
- **Observed** (DB tier, below). anon CAN read it.
- **Verdict.** This is consistent with the canonical rule and is **not a leak** under the current approved policy. It would be one only if the approved policy required both `published=true` AND `status='published'`, and no such requirement is recorded. The `published=false` private row is the actual negative, and anon could NOT read it.

## Evidence matrix (what ran, at which tier)

| # | Check | Tier that ran | Result | Acceptance? |
|---|---|---|---|---|
| E1 | Static selftest (guards, proof consumer, DSN, helper pins, run order, no cleanup SQL, spec/config shapes) plus the probe classifier fake controls | `tests/selftest.mjs`, `tests/probe-classifier-controls.mjs`, no stack | at the successor head: see the successor receipts (raw output kept). Earlier counts 26/26 (e4c2f1d) and 28/28 (405850e) were reported without the raw aggregate in the export | no (static) |
| E2 | Seed applies on the sanitized snapshot; reseed refused (`PUBLIC_CATALOG_E_NOT_PRISTINE`). **Erratum:** not "witness stable twice": witness-B equals the pre-seed witness exactly (courses 0, modules 0), and witness-A equals the after-write witness (courses 7, modules 3). A and B are not equal | PG16 + `bootstrap.sh` on the SIMULATED managed layout | PASS. The first seed attempt FAILED on the live CHECK for `estimated_hours = 0`, so the fixture was changed to NULL. | no (not PG15, not `supabase start`) |
| E3 | Anon reads, actual policies, no client filter (`rls-anon-read.sql`) | same PG16 snapshot, `set role anon` | anon sees courses 1–5 and 7 (the contradictory row); NOT 6 (private); sees module 101 only, NOT 102 or 103 | no (not PostgREST) |
| E4 | Anon writes on run-owned ids (`rls-anon-write.sql`) | same | insert refused 42501 (courses, modules); update/delete 0 rows ×4; witness unchanged | no |
| E5 | Browser, NEW (e4c2f1d bytes), the since-removed rehearsal tier, loopback shim API | vite preview + `tests/rehearsal-api.mjs` | run3: 31 passed, 2 skipped (S1 is desktop-only) | **no: shim, emulated policy** |
| E6 | Browser, NEW, **authentic tier on the shim** (negative control for the foreign guard) | same | run4: 31 failed, every one on "no foreign request attempt": gptengineer.js in 31 tests, i.pravatar.cc in 9. 2 skipped. | no; it shows that the authentic tier fails on known foreign attempts |
| E7 | Browser, OLD (main 32ccf7df: no #145, no T-42), rehearsal tier | same | run2: 6 passed, 25 failed or timed out, 2 skipped (see the OLD table) | no |
| E8 | vitest full; `tsc -b`; eslint on the owned paths and AppSidebar; `check:migrations` | local | 195 files, 1995/1995 passed; all exit 0 (as reported for e4c2f1d; the raw vitest aggregate was not in that export, so this is not independently inspectable). eslint has 0 errors and 1 warning (a rules-of-hooks false positive on Playwright's fixture `use`). | no |
| — | Real PostgREST, GoTrue, `supabase start` PG15, the hermetic served app, the owned-stack proof, the real anon probe, the authentic browser run | **UNRUN** | — | this is the acceptance |

**Scope of E5 to E7.** All browser results are on the e4c2f1d spec bytes: the formatter oracle, the lane's own route abort with a loopback-bypassing dead proxy, and the rehearsal tier. The successor specs (literal oracles, the pinned egress boundary, one tier) have **not run in any tier**, local or real.

**OLD rehearsal (E7), classified by the first reached assertion** (desktop; tablet and mobile match except S1, which is desktop-only):

| Spec | OLD result | Class |
|---|---|---|
| A1 GET → render (cards equal the served rows equal the published fixtures) | pass | invariant |
| A9 private course hidden by direct URL | pass | invariant (emulated policy; E3 is the policy tier) |
| A2 Estimated time | fail: the card reads "…Analytics & BI 99 Beginner…", the legacy duration, with no Estimated time | causal |
| A8 detail Estimated time | fail: no "Estimated time: 2.5 hours" | causal |
| A10 home Estimated time | fail: "12.0 hours" where "12 hours" is expected | causal (format) |
| A7 unknown `?category=` notice | fail: no status notice | causal |
| S1 T-42 rail names | fail: the first link's computed name is "" where "Insights Collective" is expected | causal (T-42) |
| A3–A5 menu names, keyboard, whitespace option | timed out: no combobox has the accessible name "Category" in OLD | **selector-absent, NOT causal** for the category-name contract (that is proven at the unit tier in #145) |
| A6 `?category=analytics` group | fail: same selector-absent | selector-absent, not causal |

## Rehearsal provenance and limits

- **Run 1** (NEW, rehearsal) is **UNVERIFIABLE notes only**. Its log and output were overwritten by a later run. From notes: 31 failed and 2 skipped, the first failure being the gptengineer.js attempt. It is not a counted receipt.
- **Retained runs:**
  - DBG: desktop, earlier spec bytes, not retained; 9 passed, 2 failed.
  - Run 2: NEW and OLD; harness identities in `IDENTITIES-run2.txt`.
  - Run 3 and run 4: identities in `IDENTITIES-run3.txt`. They differ from run 2 only in `support.ts`, the tier logic.
  - The OLD arm was not re-run on run-3 bytes. Under the rehearsal tier, run 2's `support.ts` behaves the same except for the label of tolerated attempts.
- **The rehearsal API emulates the anon read policies by hand.** That emulation proves nothing about RLS; E3 and E4 (snapshot) and the real `anon-probe.mjs` (unrun) do.
- **Seeding published fixtures does NOT prove the instructor Publish workflow.**
- **Not covered:** screen readers, the live taxonomy, authenticated views, and an unknown category combined with level or time filters.
