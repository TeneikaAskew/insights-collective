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

**LOCAL-SHIM / UNRUN / integration-blocked.** Nothing in this lane is acceptance. The only browser runs used a loopback shim API (rehearsal); the real stack run has never happened.

- Published as one commit on #145's head `6f61532b` (main `32ccf7df` plus the reviewed catalog commit). The specs import `src/lib/estimatedTime.ts`, which exists only from #145, so this is a stacked draft on #145's branch.
- T-42's 3 files are **not** on this branch. Their owner publishes them as a separate draft. S1 (`sidebar-rail.spec.ts`) asserts the T-42 behaviour and is expected to fail until T-42 is also on the tested ref.
- The rehearsal evidence below was produced on the local branch `local/public-acceptance` (e4c2f1d6), which carried T-42 as a separate commit `8df20645` under the lane. The lane files here equal e4c2f1d6 except the own-config skip described next.
- **Own-config skip.** main's `playwright.config.ts` (`chromium-member`, `testDir: './e2e'`) collects every `e2e/**` directory it does not ignore, with a signed-in session. So `playwright.public-catalog.config.ts` sets `PUBLIC_ACCEPT_OWN_CONFIG=1` before its guards, and each spec file calls `test.skip(!UNDER_OWN_CONFIG, ...)`. Under a foreign config all 11 tests are skipped before any page opens. A `testIgnore` entry in the shared config is the shared owner's separate decision.

## Run order (`run.sh`, authentic tier only; each step fails closed)

1. **Tier.** `PUBLIC_ACCEPT_TIER` must be `authentic`; rehearsal is refused.
2. **Guards** (`guards.mjs`). Targets must be loopback only. The shared guard runs `--mutating` on the API, DB and relay variables. Any `E2E_ISOLATED_TARGET_REF` is refused, the anon key must be present, and an **owned-stack proof is required**.
3. **Served build.** The served entry bundle must reference this stack's API origin, so a build without `VITE_SUPABASE_URL` cannot fall back to the hosted project.
4. **Hermetic served app.** `scripts/served-app/hermetic-dist.mjs verify <product dist> <served dir>` must pass. If it is absent, the run fails closed.
5. **W0, seed, W1.** The seed is INSERT-only, in one transaction, and refuses a stack that already holds course or module rows.
6. **Browser specs.**
7. **W2.** Must equal W1, proving anonymous browsing wrote nothing.
8. **Anonymous RLS probe** (`anon-probe.mjs`) through real PostgREST with the anon key. Reads are unfiltered; write attempts target run-owned ids only.
9. **W3.** Must equal W1; otherwise a write was accepted.

There is no cleanup: the stack is destroyed with the job, and the manifest lists every created id.

**Witness** (`witness.sql`). A read-only transaction recording, for every table in `public`, `auth` and `storage`, its row count and an md5 over all of its rows.

## What this lane needs from the local-stack/PR134 lane (proposed integration, no edits made)

1. **An owned-stack proof producer** in the stack bootstrap. It writes `{version:1, stack_id, db_read, api_read, produced_before_seed:true}` (32 hex characters, mode 0600) and sets `PUBLIC_ACCEPT_STACK_PROOF`.
   - `db_read` must be read from the stack's DB, and `api_read` through that stack's PostgREST with the anon key, before the seed.
   - This is the same gap as the gradebook lane's gate 3. Until it exists, `guards.mjs` refuses with `PUBLIC_CATALOG_E_NO_STACK_PROOF`.
2. **The hermetic served-app contract on the runner's ref.** `scripts/served-app/hermetic-dist.mjs` is f169429, local and unpublished. It must be on the ref, and the runner must:
   - build the app with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set to the owned stack;
   - derive the test-served directory and keep `HERMETIC-PROVENANCE.json`;
   - serve that directory on loopback.

   Evidence from this lane is then labelled "TEST-SERVED MODIFICATION: … NOT production bytes".
3. **Deterministic local avatar data for `/`.** `src/components/home/CommunityShowcase.tsx` hotlinks three `https://i.pravatar.cc/150?img=…` images.
   - Under the authentic tier every foreign attempt fails, so **A10 (home page) cannot pass** until those images are served from the app origin, either by a product change or by an exact, provenance-recorded test-served substitution.
   - Which of the two is the owner's call. This lane does not choose it and does not loosen the guard.
4. **A runner job.** It should:
   - stand up a fresh stack (`workdir.sh`, `supabase start`, `bootstrap.sh`, `verify-identities.sh`);
   - pass the PG15 parity gate;
   - export `PUBLIC_ACCEPT_{BASE_URL,API_URL,DB_URL,ANON_KEY,STACK_PROOF,PRODUCT_DIST,SERVED_DIR,OUT}`;
   - run `scripts/public-catalog-fixture/run.sh`;
   - upload `$PUBLIC_ACCEPT_OUT`.

   It needs its own stack, never the gradebook lane's, and its own bounded-run approval.

## Foreign-origin policy (not weakened)

Every off-origin request is aborted before it is sent; that is prevention only. In the **authentic** tier (the default, and the only tier `run.sh` accepts) **any** foreign attempt fails the test, including `cdn.gpteng.co` and `i.pravatar.cc`. The browser is also pinned to a dead loopback proxy. Only `PUBLIC_ACCEPT_TIER=rehearsal`, used with the loopback shim, reports those two known product attempts as annotations instead of failing. A rehearsal result is never acceptance.

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
| E1 | Guards: 10 refusals, 1 positive; generated seed; INSERT-only; read-only witness; anon-only rollback probes; spec and config shapes; tier rules | `tests/selftest.mjs`, no stack | 26/26 PASS | no (static) |
| E2 | Seed applies on the sanitized snapshot; reseed refused (`PUBLIC_CATALOG_E_NOT_PRISTINE`); witness stable twice | PG16 + `bootstrap.sh` on the SIMULATED managed layout | PASS. The first seed attempt FAILED on the live CHECK for `estimated_hours = 0`, so the fixture was changed to NULL. | no (not PG15, not `supabase start`) |
| E3 | Anon reads, actual policies, no client filter (`rls-anon-read.sql`) | same PG16 snapshot, `set role anon` | anon sees courses 1–5 and 7 (the contradictory row); NOT 6 (private); sees module 101 only, NOT 102 or 103 | no (not PostgREST) |
| E4 | Anon writes on run-owned ids (`rls-anon-write.sql`) | same | insert refused 42501 (courses, modules); update/delete 0 rows ×4; witness unchanged | no |
| E5 | Browser, NEW (this branch), rehearsal tier, loopback shim API | vite preview + `tests/rehearsal-api.mjs` | run3: 31 passed, 2 skipped (S1 is desktop-only) | **no: shim, emulated policy** |
| E6 | Browser, NEW, **authentic tier on the shim** (negative control for the foreign guard) | same | run4: 31 failed, every one on "no foreign request attempt": gptengineer.js in 31 tests, i.pravatar.cc in 9. 2 skipped. | no; it shows that the authentic tier fails on known foreign attempts |
| E7 | Browser, OLD (main 32ccf7df: no #145, no T-42), rehearsal tier | same | run2: 6 passed, 25 failed or timed out, 2 skipped (see the OLD table) | no |
| E8 | vitest full; `tsc -b`; eslint on the owned paths and AppSidebar; `check:migrations` | local | 195 files, 1995/1995 passed; all exit 0. eslint has 0 errors and 1 warning (a rules-of-hooks false positive on Playwright's fixture `use`). | no |
| — | Real PostgREST, GoTrue, `supabase start` PG15, the hermetic served app, the owned-stack proof, the real anon probe, the authentic browser run | **UNRUN** | — | this is the acceptance |

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
