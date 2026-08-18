# Getting tweets into the site

Two sections of the site render tweets, from two different tables. This document
covers what feeds each of them, why the automatic pipeline stopped, and how to
refresh both from an X data-archive export without an API key.

## The two sections

```
                                             ┌─► public.tweets ──────► /teneika-tweets
X archive export                             │   (tweet_id, content,   "Teneika's Tweets"
  data/tweets.js  ──► import:x-archive ──────┤    tweeted_at, counts)   archive page
  data/tweets-part1.js                       │
  ...                                        └─► public.resources ───► Resources ▸ Top Tweets
                                                 (tweet_id, full_text,  sorted by engagement
                                                  source, created_at)

X API v2 ──► scrape-teneika-tweets ──────────────► public.tweets
 (needs a paid credential; no schedule; last produced rows 2025-06-13)
```

| Section | Route | Table | Read by |
| --- | --- | --- | --- |
| Teneika's Tweets | `/teneika-tweets` | `public.tweets` | `src/pages/TeneikaTweets.tsx` |
| Top Tweets tab | `/resources` | `public.resources` (rows with a `tweet_id`) | `src/hooks/useAllTweetsData.ts` |

The two tables do not overlap and neither is derived from the other. `resources`
holds the older bulk import (through Oct 2024); `tweets` holds what the API
scraper collected (May–Jun 2025).

## Why the automatic pipeline is not running

`supabase/functions/scrape-teneika-tweets` is deployed and correct — it calls
`GET /2/users/{id}/tweets` with `since_id`, upserts on `tweet_id`, and advances
`scrape_metadata.last_scraped_tweet_id`. Two things stop it:

1. **Nothing schedules it.** The live `cron.job` table has no entry for it. The
   function logs to a job named `daily-tweet-scraper` that has never existed, so
   the "automatic" part was written but never wired. Today it only runs when
   someone clicks **Refresh Tweets** on the page.
2. **The credential no longer reads.** Rows stop at 2025-06-13, which is when X's
   free tier stopped serving timeline reads.

Restarting it needs a paid X API credential. Reading your *own* timeline is billed
as an "owned read" ($0.001/post at the time of writing) rather than the general
read rate, so the cost is small — but it is not zero, and it is a separate
decision from the archive route below.

The resume pointer is still in the database, so if the credential is ever
restored the scraper picks up exactly where it stopped rather than re-fetching
everything.

## Refreshing both sections from an archive

### 1. Request the archive

**x.com → Settings → Your account → Download an archive of your data.** X emails a
zip within a few hours to a couple of days. Unzip it anywhere.

### 2. Apply the migration once

`20260818000000_resources_tweet_id_unique` adds the unique index the import needs
as a conflict target on `public.resources`. Without it, a second import would
duplicate every tweet it had already loaded rather than updating it.

Apply it through the `db-migrate.yml` workflow — never the Supabase MCP. See
`docs/lessons-learned/03-database-and-migrations.md` for why.

### 3. Run the import

```bash
export SUPABASE_URL=https://<project-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service role key>

npm run import:x-archive -- ~/Downloads/twitter-archive --dry-run   # inspect first
npm run import:x-archive -- ~/Downloads/twitter-archive
```

Point it at the unzipped archive root or its `data/` directory; it finds
`tweets.js` and every `tweets-part*.js` beside it. Both writes upsert on
`tweet_id`, so **re-running is safe** — importing a newer archive over an older one
updates the existing rows and adds only what is new.

| Flag | Effect |
| --- | --- |
| `--dry-run` | Parse and report, write nothing. Needs no credentials. |
| `--limit N` | Import only the first N tweets. |
| `--only tweets` / `--only resources` | Write just one of the two tables. |
| `--skip-retweets` | Drop `RT @...` entries. |
| `--skip-replies` | Drop replies. |
| `--created-by <uuid>` | Owner for new `resources` rows. |

Retweets and replies are imported by default, because both tables already contain
them — 1,522 retweets in `resources`, 41 in `tweets`. Skipping them would make an
imported archive inconsistent with the rows already there.

## Things the archive route cannot do

- **No reply or quote counts.** The export does not carry them, so imported rows
  in `public.tweets` show `reply_count = 0` and `quote_count = 0`. Likes and
  retweets are real. If the API scraper ever runs again it will overwrite these
  with true values, since it upserts on the same key.
- **Engagement is frozen at export time.** Counts are whatever they were the day
  X built the zip. Re-import a fresh archive to update them.
- **It is manual.** This is the trade for needing no API credential. "Anytime I
  tweet, it appears" requires either the API route above or re-exporting.
- **No classification labels.** Existing `resources` rows carry `category` and
  `resource_type` from a classifier that is not part of this repo; imported rows
  leave them null. This does not affect the Top Tweets tab, which does not filter
  on them.

## The rebrand trap

`classifyResourceSource` in `src/pages/Resources.tsx` decides whether a
`resources` row is a tweet, and a row that fails it is fetched and then silently
dropped before Top Tweets renders.

It used to test `source.includes('twitter')`. `resources.source` holds the raw
client anchor from the export, and after the rebrand that reads:

```html
<a href="https://mobile.x.com" rel="nofollow">X for Android</a>
```

No "twitter" anywhere. Every tweet posted after the rename would have imported
into the table and never appeared in the tab. The classifier now also reads the
host out of the anchor's `href` — host-matched, not substring-matched, so
`x.com.evil.net` and `box.com` do not qualify. `adaptResourceToTweet` had the same
blind spot in its status-URL fallback and got the same fix.

This is why `toResourceRow` keeps the `source` anchor verbatim instead of
flattening it to a readable label: the href in it is load-bearing.

## Where the code lives

| Path | Role |
| --- | --- |
| `src/utils/xArchive.ts` | Parsing and row mapping — pure, unit-tested |
| `scripts/import-x-archive.ts` | CLI wrapper (file discovery, upserts) |
| `src/utils/__tests__/xArchive.test.ts` | Mapping tests |
| `src/pages/__tests__/Resources.classify.test.ts` | Classifier regression tests |
| `supabase/migrations/20260818000000_resources_tweet_id_unique.sql` | Conflict target |
