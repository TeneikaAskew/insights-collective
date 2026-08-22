# Getting tweets into the site

Two sections of the site render tweets, from two different tables. This document
covers what feeds each of them, why the automatic pipeline stopped, and how to
refresh both from an X data-archive export without an API key.

## The two sections

```
                                             ┌─► public.tweets ──────► /teneika-tweets
twitter-archive.zip                          │   (tweet_id, content,   "Teneika's Tweets"
  data/tweets.js       ──► import:x-archive ─┤    tweeted_at, counts)   archive page
  data/tweets-part1.js     (reads the zip    │
  ...                       in place)        └─► public.resources ───► Resources ▸ Top Tweets
  (DMs, media, contacts:                        (tweet_id, full_text,  sorted by engagement
   never opened)                                 source, created_at)

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
   the "automatic" part was written but never wired.
2. **The credential no longer reads.** Rows stop at 2025-06-13, which is when X's
   free tier stopped serving timeline reads.

The page used to carry a **Refresh Tweets** button that invoked it, plus a
**Scrape Tweets** button in the empty state. Both were removed, because neither
could work for the people who could see them: the function is behind
`requireAdminOrService`, so every signed-out or non-admin click returned 401 and
raised a "Scraping Failed" toast. For an admin it had produced nothing in over a
year, and reads are now billed per post — so the best case was a button that
quietly spent money.

Nothing calls the function now, so it costs nothing while it sits there. It is
still deployed and still correct; restoring a credential and adding the cron is
the route below.

Restarting it needs a paid X API credential. Reading your *own* timeline is billed
as an "owned read" ($0.001/post at the time of writing) rather than the general
read rate, so the cost is small — but it is not zero, and it is a separate
decision from the archive route below.

The resume pointer is still in the database, so if the credential is ever
restored the scraper picks up exactly where it stopped rather than re-fetching
everything.

## Two ways to import

| | Upload dialog | CLI |
| --- | --- | --- |
| Where | The upload icon on `/teneika-tweets`, admin only | Your terminal |
| Needs | An admin login | `SUPABASE_SERVICE_ROLE_KEY` |
| Best for | The normal case | Scripting, `--only`, `--skip-retweets`, large one-offs |

Both read the archive locally and write the same rows to the same two tables.

## The upload dialog (admin only)

An upload icon sits in the page header — the page's only action, now that the
scrape buttons are gone. It renders only when `useAuth().isAdmin` is true — but hiding a button is presentation, not
authorization, so the `import-x-archive` Edge Function re-checks every request
with `requireAdmin`, which reads `user_roles` through `has_admin_access()` rather
than the owner-writable `profiles.roles` column.

Drop in the zip (or a `tweets.js`). The dialog parses it, shows how many tweets it
found, their date range and anything skipped, and waits for you to confirm before
writing anything.

**The file is never uploaded.** The zip is opened in your browser with `jszip`,
and only the mapped tweet rows are posted, in batches of 500. That is what makes
it safe to hand a multi-gigabyte archive to a web page: the direct messages,
contacts and media never leave your machine, and the request bodies stay small.

Batches are not a transaction. If one fails the earlier ones stay written, which
is safe because every write upserts on `tweet_id` — the error says how far it got,
and re-running finishes the job rather than duplicating it.

### Why an Edge Function and not a direct write

The browser cannot write these tables at all, admin or not:

- **`public.tweets`** has RLS on and exactly one policy, for `SELECT`. There is no
  insert or update policy for any role.
- **`public.resources`** allows `INSERT` for `authenticated`, but `UPDATE` requires
  `auth.uid() = created_by OR auth.role() = 'admin'` — and `auth.role()` returns
  the *Postgres* role (`authenticated`, `anon`, `service_role`), never `'admin'`,
  so that branch is dead. An upsert needs the update half.

So the privileged write lives in the function, which holds the service-role client
behind the admin check. Rows are attributed to the importing admin.

## Refreshing both sections from the CLI

### 1. Request the archive

**x.com → Settings → Your account → Download an archive of your data.** X emails a
zip within a few hours to a couple of days.

**Keep the zip as it is.** Do not unzip it, and do not upload it anywhere. The
import runs on your own machine and reads the zip in place.

### 2. The migration (already applied)

`20260818000000_resources_tweet_id_unique` adds the unique index the import needs
as a conflict target on `public.resources`. Without it a second import would
duplicate every tweet it had already loaded rather than updating it.

This was applied on 2026-08-18 via `db-migrate.yml` and is recorded in
`schema_migrations` under version `20260818000000`. Nothing to do — noted here
because a fresh database (a branch, a local stack) needs it before importing.

### 3. Run the import

```bash
export SUPABASE_URL=https://siuqvhscuiycvdrtiqsh.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service role key>

npm run import:x-archive -- ~/Downloads/twitter-archive.zip --dry-run   # inspect first
npm run import:x-archive -- ~/Downloads/twitter-archive.zip
```

`--dry-run` needs no credentials at all — it parses the zip, reports what it found
and the date range, prints one sample row per table, and writes nothing. Run that
first.

Both writes upsert on `tweet_id`, so **re-running is safe** — importing a newer
archive over an older one updates the existing rows and adds only what is new.

### What you can point it at

| Input | Notes |
| --- | --- |
| `twitter-archive.zip` | The zip X emailed you, read in place. No unzipping. |
| `tweets.js` | A single tweet file. Sibling `tweets-part*.js` in the same folder are picked up automatically. |
| A folder | An unzipped archive, or its `data/` directory. |
| Several of the above | e.g. `tweets.js tweets-part1.js`, or two archives at once. Duplicates across them collapse. |

X splits large exports across `tweets.js`, `tweets-part1.js`, `tweets-part2.js`,
and so on. That is why naming a single `tweets.js` sweeps in its siblings: passing
just the first file and quietly importing a fraction of the account's history —
reported as a success — is the worst available outcome. To override the sweep,
list the files you want explicitly; an explicit list is taken as the instruction.

Aiming it at a different `window.YTD` file (`direct-messages.js`, `like.js`) is
caught rather than half-imported: it warns on the filename, and if nothing
tweet-shaped comes out it exits non-zero saying so.

### What the import reads out of the zip

Only `data/tweets.js` and its numbered parts. An X archive also contains your
direct messages, contacts, ad-interest profile, and every image and video you have
posted — usually most of the file's size. None of it is opened, and none of it can
reach the database. That is also why there is no need to unzip: the import pulls a
few megabytes of text out of a file that is often several gigabytes.

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
| `src/utils/xArchive.ts` | Parsing and row mapping — pure, unit-tested, shared by both routes |
| `scripts/import-x-archive.ts` | CLI wrapper (file discovery, upserts) |
| `src/utils/xArchiveUpload.ts` | Browser side: reads the zip in the page, batches to the function |
| `src/components/tweets/TweetArchiveUploadDialog.tsx` | The upload dialog |
| `supabase/functions/import-x-archive/index.ts` | Admin-gated privileged write |
| `src/utils/__tests__/xArchive.test.ts` | Mapping tests |
| `src/utils/__tests__/xArchiveUpload.test.ts` | Zip reading and batching tests |
| `src/pages/__tests__/TeneikaTweets.adminUpload.test.tsx` | Admin-gate tests for the icon |
| `src/pages/__tests__/Resources.classify.test.ts` | Classifier regression tests |
| `supabase/migrations/20260818000000_resources_tweet_id_unique.sql` | Conflict target |
