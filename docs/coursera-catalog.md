# Coursera fallback catalog

Career role pages recommend courses from two sources. Courses published on Insights
Collective are always primary. Coursera fills only the subject areas our own
courses do not cover yet — so as the platform's catalog grows, the external
recommendations retreat on their own.

This document covers where the Coursera data comes from and how to refresh it.
For how recommendations are chosen, see `src/lib/roleCourseResolver.ts`.

## Where the catalog lives

In Postgres — `public.coursera_courses` — refreshed by the `coursera-refresh` Edge
Function on a monthly schedule. `src/data/courseraCatalog.generated.ts` still exists,
but only as the seed for that table and as a client-side fallback.

```
                    ┌─ cron: 1st of month ──► enqueue-discover ─┐
                    │                                            ▼
coursera.org ◄──────┴─ cron: every 5 min ──► process ──► coursera_crawl_queue
   (public                                      │
    pages)                                      ▼
                                        coursera_courses ──► useCourseraCatalog
                                                                     │
                                        courseraCatalog.generated.ts ┘ (fallback)
```

### Why a table and not the generated file

The generated file works, but it ties every data refresh to a code deploy, and it
cannot be curated: hiding a course you disagree with means a commit. As a table it is
refreshable on a schedule and editable by an admin — `status`, `curator_note` and
`is_featured` exist for exactly that, and the refresh upsert deliberately omits them
so an admin's decision survives the next crawl.

Keeping the whole crawled corpus (thousands of rows) rather than a pre-filtered 170
also means the quality bar becomes a *query* parameter. `MIN_RATING` and
`MIN_REVIEWS` in `useCourseraCatalog` can be tuned without re-crawling anything.

The bundled file remains as the fallback because a database problem should degrade
the section, not empty it. `useCourseraCatalog` returns `undefined` — which the
resolver reads as "use the bundled catalog" — when the query errors, when the table
does not exist yet, or when it returns no rows for a role's subjects.

### Why an Edge Function and not a GitHub Action

A GitHub Action would need a Supabase **service-role key** in repository secrets. That
key bypasses RLS on every table in the project, so a workflow that only needs to
write one reference table would hold total database authority, and the credential
would live outside Supabase. The Edge Function already has that key in its own
environment; nothing has to be copied anywhere.

An Action is still fine for *running the local scripts* — a bulk backfill, or
regenerating the committed seed — because those produce a CSV and a file diff rather
than touching the database.

### Why batched, and why that is not optional

Edge Functions are wall-clock limited (150s on the current plan). Measured locally:

| Work | Duration |
|---|---|
| Refresh the ~170 known courses | ~3 minutes |
| Full discovery sweep (8,386 pages) | ~2.5 hours |

Both are far past the ceiling, and that is *with* deliberate rate limiting that
should not be removed — this is someone else's website. So one invocation cannot be
one crawl. `coursera_crawl_queue` holds the work list, `process` drains 40 URLs per
call, and cron ticks until the queue is empty. At that rate a full monthly sweep
finishes in roughly 18 hours.

The drain job is a no-op when the queue is empty: `coursera_kick_refresh()` counts
pending rows in SQL and returns without making an HTTP call. That is what makes a
5-minute schedule reasonable instead of 288 wasted invocations a day.

## Deployment status — live

Everything below is applied and running on the project. No manual step is outstanding.

| Piece | State |
|---|---|
| Schema, RLS, indexes | applied |
| `coursera_verify_refresh_secret` auth RPC | applied |
| Vault secrets (`coursera_refresh_url`, `coursera_refresh_secret`) | set |
| Keyword table | 264 rows, 25 subjects |
| `coursera-refresh` Edge Function | deployed, v1, `verify_jwt: false` |
| `coursera_call_refresh` / `coursera_kick_refresh` | applied |
| Cron: `coursera-discover-monthly` (`0 3 1 * *`) | active |
| Cron: `coursera-drain-queue` (`*/5 * * * *`) | active |
| Crawl queue | seeded with 8,387 candidates, draining |

Measured in production: a 20-page batch completed in **7.7 seconds**, so the 40-page
cron batch runs at roughly 15s against a 150s ceiling. The queue drains in about 17
hours.

### The secret is only in Vault

It was generated inside the database with `gen_random_bytes(32)` and never left it.
There is no copy in a function environment variable, in CI, or anywhere on disk.
`coursera_verify_refresh_secret` takes a candidate and returns a boolean, so even the
Edge Function cannot read it back — it can only ask whether a presented value matches.

To rotate, generate a new value and `vault.update_secret` it. Nothing needs
redeploying, because both the caller and the verifier read Vault at call time.

### One caveat: the deployed function is comment-stripped

The first deploy attempt failed with a gateway 502 on a ~30KB payload. The retry
succeeded with the same code minus its comment blocks. The deployed bundle is
therefore functionally identical to `supabase/functions/coursera-refresh/` but not
textually identical. To restore parity whenever a CLI token is available:

```bash
supabase functions deploy coursera-refresh
```

Nothing depends on this; it only matters if you diff the dashboard against the repo.

### Verifying by hand

```sql
-- Whole path: pg_net -> function -> Vault auth -> counts. No side effects.
select public.coursera_call_refresh('status');
-- pg_net is async; the reply lands here a moment later.
select id, status_code, content from net._http_response order by id desc limit 1;
```

Actions are `status`, `enqueue-refresh`, `enqueue-discover` and `process`. Crawl
progress is also visible to admins via `public.coursera_crawl_progress`.

### Bulk loading the whole corpus

The seed is 179 curated courses. The full crawl holds far more — 7,419 rows survive
normalization from an 8,381-page sweep — and getting there through cron takes about
18 hours. `load:coursera` does it in minutes instead, which is what you want for the
initial load:

```bash
npm run fetch:coursera -- --discover --all --out coursera-live.csv   # ~2.5 hours
export SUPABASE_URL=https://<project-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service role key>
npm run load:coursera -- coursera-live.csv          # add --dry-run to inspect first
```

This is the one place a service-role key is needed, it is read from the environment
rather than an argument (so it stays out of shell history), and it is a one-off you
run rather than a stored credential. The recurring refresh needs none of that, which
is the argument for keeping it in the Edge Function.

The loader upserts on `slug` and omits `status`, `curator_note` and `is_featured`, so
re-running it never overwrites curation. Interrupting it is safe — rerun and it
resumes by upserting the same rows.

After a bulk load, refresh the committed seed so the fallback matches:

```bash
npm run build:coursera -- coursera-live.csv
npm run emit:coursera-seed -- supabase/migrations/<timestamp>_coursera_catalog_seed.sql
```

## Where the data comes from

`src/data/courseraCatalog.generated.ts` is a **generated file** — do not edit it by
hand. Two scripts feed it, and either can be the source:

```
fetch:coursera  ─┐
                 ├─►  CSV  ─►  build:coursera  ─►  courseraCatalog.generated.ts
dataset export  ─┘                                          │
                                                    verify:coursera
```

**`npm run fetch:coursera` is the preferred source.** It reads Coursera's public
course pages directly, so the data is current. There is no API to call — Coursera
retired its free public catalog API (`api.coursera.org/api/courses.v1`) and the
affiliate API needs partner credentials — but the course pages themselves carry a
complete state blob, which is what the fetcher parses.

A downloaded dataset export works too, and is how the catalog was first built. Use
it if the fetcher ever breaks.

### What the fetcher is allowed to do

`robots.txt` disallows `/api/`, `/search`, and `/lecture/` (the last specifically
for AI crawlers). It permits `/learn/`, `/specializations/` and
`/professional-certificates/`, and advertises sitemaps for discovery. The fetcher
stays inside that: it reads only those three path prefixes plus the sitemaps, and
never calls an internal API endpoint.

It is also deliberately polite — 4 requests in flight, a pause between batches, a
self-identifying user agent, exponential backoff on 429s and 5xxs, and a 7-day
on-disk cache in `.cache/coursera/` so repeat runs re-fetch nothing.

### Fetcher modes

| Mode | What it does |
|---|---|
| `--refresh` (default) | Re-fetches the slugs already in the catalog. ~177 pages. Use this routinely to keep ratings, review counts and skill tags current, and to find retired courses. |
| `--discover` | Pulls the sitemaps (24,000+ URLs), keeps the ones whose slug matches a subject keyword (~8,400), and samples across them. Use this to pick up courses published since the last run. |

Other flags: `--limit N` (discovery sample size, default 400), `--out path.csv`,
`--no-cache`.

Discovery samples with a fixed stride rather than taking the first N — the URL list
is sorted by slug, so slicing would fetch nothing but courses starting with "a".
The stride is deterministic, so raising `--limit` still hits the cache for pages
already fetched.

### What the fetcher gets that a dataset export does not

Measured against the November 2024 export over the same 177 courses:

| | 2024 export | Live fetch |
|---|---|---|
| Skill tags | 926 | 2,845 |
| Review counts | stale (one course: 3,420) | current (same course: 35,895) |
| Learner review text | none | 128 of 177 courses |
| Estimated hours | none | 124 of 177 courses |

More skill tags directly improves subject classification, since that is what
subjects are inferred from.

## Current snapshot

| | |
|---|---|
| Source | [`azrai99/coursera-course-dataset`](https://huggingface.co/datasets/azrai99/coursera-course-dataset) on Hugging Face (`coursera_course_2024.csv`) |
| Dataset license | Apache 2.0 |
| Snapshot date | November 2024 |
| Rows in | 6,645 |
| Courses kept | 177 |
| Link check | 177/177 reachable (verified July 2026), after denylisting 2 retired slugs |

The first link check found 2 dead out of 144 — roughly a 1.4% rot rate over 20
months. Both were courses Coursera retired outright; no live course had moved. So
snapshot age costs coverage, not correctness, and the denylist absorbs it.

### Alternatives considered

| Dataset | Verdict |
|---|---|
| [Kaggle: Coursera Courses and Skills 2025](https://www.kaggle.com/datasets/yosefxx590/coursera-courses-and-skills-dataset-2025) (Mar 2025) | Four months fresher, but **has no URL column**. Without URLs the app cannot link anywhere, and slugs cannot be guessed — see below. |
| [`sg247/coursera-course-data`](https://huggingface.co/datasets/sg247/coursera-course-data) | 623 rows, title and skills only, no URLs, no stated license. |

Nothing newer than March 2025 was available. If a fresher export appears, prefer
whichever one still carries URLs; use the Kaggle set only to cross-check titles.

### Why URLs must come from the data

Coursera serves courses from three different path prefixes:

```
https://www.coursera.org/learn/<slug>                      # single courses
https://www.coursera.org/specializations/<slug>            # specializations
https://www.coursera.org/professional-certificates/<slug>  # professional certificates
```

Which prefix a course uses cannot be reliably derived from its format. An earlier
hand-written version of this catalog built URLs from a `format` field and mapped
professional certificates to `/specializations/` — 11 of 34 entries 404'd.
`CourseraCourse.url` is therefore stored verbatim, and a test asserts every row's
URL matches the prefix its format implies.

## Refreshing the catalog

Routine refresh — keeps existing picks current and finds retired courses:

```bash
npm run fetch:coursera -- --refresh --out coursera-live.csv
npm run build:coursera -- coursera-live.csv
npm run verify:coursera
npm run test -- --run src/lib/__tests__/roleCourseResolver.test.ts
```

Wider sweep — also picks up courses published since the last run:

```bash
npm run fetch:coursera -- --discover --limit 1500 --out coursera-live.csv
npm run build:coursera -- coursera-live.csv
npm run verify:coursera
```

If `verify:coursera` reports dead links, add those slugs to
`scripts/coursera-denylist.json` with a reason and re-run `build:coursera` so they
stop coming back.

Both `fetch:coursera` and a dataset export produce the same columns, which is what
lets them be interchangeable: `title`, `Organization`, `Skills`, `Description`,
`Level`, `URL`, `rating`, `num_reviews`, `enrolled`. The fetcher adds
`estimated_hours` and `top_reviews`; the generator ignores columns it does not read.

### Automating it

The scripts are plain Node with no interactive steps, so anything that can run a
command can run them — a GitHub Action on a monthly schedule is the obvious home.
Have it run the refresh sequence and open a PR when
`src/data/courseraCatalog.generated.ts` changes; the drift, integrity and link
tests are what make that PR safe to review quickly. Nothing here needs Claude in
the loop to work, though `npm run fetch:coursera -- --refresh` is a reasonable
thing to ask Claude Code to run and summarize.

### Selection rules

Set at the top of `scripts/build-coursera-catalog.mjs`:

- Rating ≥ 4.3 from ≥ 50 reviews. The review floor stops a lone 5.0 from winning.
- Top 8 per subject, ranked by rating weighted by `log10` of the review count.
- Courses whose subject is named in the **title** rank above ones that only mention
  it in their skill tags. Without this, "Neural Networks and Deep Learning" — whose
  skills list Python programming, with enormous review counts — beat every real
  software-engineering course for that slot.

### Subjects

Subjects come from `src/data/subjectKeywords.json`, which is read by **both**
`src/data/learningSubjects.ts` (runtime) and the generator (a plain Node script
that cannot import TypeScript). Editing keywords therefore changes both at once.

`roleCourseResolver.test.ts` re-derives every generated row's subjects with
`inferSubjects()` and fails if they disagree, so the two implementations cannot
drift apart silently.

Catalog subjects are inferred from **title and Coursera's skill tags only, never the
description**. Descriptions are marketing prose that name-drop everything adjacent;
including them classified an Academic English writing course as `research` and AWS
Fundamentals as `data-analysis`.

## Known limitations

- **Non-English courses are in the corpus.** 128 of the 8,381 crawled courses have
  non-Latin titles, and nothing filters by language. In practice the quality bar keeps
  them out — zero of the 179 selected courses have a non-Latin title — but a
  well-reviewed Chinese or Japanese course could surface for a subject. Course pages
  expose `primaryLanguages` in their state blob if a hard filter is ever wanted; it is
  not currently extracted.
- **About 11% of crawled pages ship no partner node** (907 of 8,381), and those rows
  are dropped rather than defaulted. That is the intended trade — attribution is not
  something a course directory may invent — but it does mean the corpus is not the
  whole catalog.
- **`software-engineering` is a coarse subject.** It cannot distinguish "learn to
  program" from "learn full-stack", so a broad intro course can win the slot for a
  full-stack role. Splitting the subject would fix it if that matters.
- **The crawl queue has no lease.** `process` claims rows by selecting them, so two
  overlapping invocations could fetch the same page twice. Harmless at a 5-minute
  cadence with a batch that finishes in well under a minute; it would need a real
  `claimed_at` lease before the schedule got aggressive.
- **Attribution.** Course titles, partner names, levels and ratings are Coursera's.
  The generated file is a filtered index kept only so the app can link out. Worth
  checking whether Coursera's affiliate program is a better fit before promoting
  these links heavily — it would also let the links earn revenue.
