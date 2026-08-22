-- Make re-importing an X archive idempotent on public.resources.
--
-- public.tweets already has UNIQUE (tweet_id), so the Edge Function's upsert can
-- name it as a conflict target and re-running the scrape is free. public.resources
-- has no such constraint — only PRIMARY KEY (id) on a generated uuid — so an
-- archive import there has no key to conflict on. PostgREST would insert, and the
-- second import of an overlapping export would duplicate every tweet it had
-- already loaded. The Top Tweets tab sorts by engagement and would then show the
-- same tweet several times over, which is the sort of thing nobody notices until
-- the table is already dirty.
--
-- Safe to add as-is: at the time of writing the 4,666 tweet-bearing rows in
-- resources hold 0 duplicate tweet_ids, so the index builds without a cleanup pass.
--
-- Partial, on tweet_id IS NOT NULL, because resources is a mixed table — most rows
-- are ordinary career resources with no tweet_id at all, and a plain unique index
-- would be fine for those (NULLs never conflict in Postgres) but the partial form
-- states the intent and keeps the index to the ~4.6k rows that need it rather than
-- the whole table.
CREATE UNIQUE INDEX IF NOT EXISTS resources_tweet_id_unique
  ON public.resources (tweet_id)
  WHERE tweet_id IS NOT NULL;

COMMENT ON INDEX public.resources_tweet_id_unique IS
  'Conflict target for X archive imports (scripts/import-x-archive.ts). Partial: resources also holds non-tweet rows.';
