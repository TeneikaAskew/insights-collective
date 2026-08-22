-- Replace the partial unique index on resources.tweet_id with a plain one, so
-- PostgREST's upsert can actually use it.
--
-- 20260818000000 created it as a partial index (WHERE tweet_id IS NOT NULL).
-- That reads well and is wrong. PostgREST turns `on_conflict=tweet_id` into
--
--   ON CONFLICT (tweet_id) DO UPDATE ...
--
-- with no index predicate, and PostgreSQL will not infer a PARTIAL index for a
-- bare conflict target — the statement has to carry a predicate implying the
-- index's. Proven against this database:
--
--   partial index + ON CONFLICT (tweet_id)
--     -> ERROR: there is no unique or exclusion constraint matching the
--               ON CONFLICT specification
--   partial index + ON CONFLICT (tweet_id) WHERE tweet_id IS NOT NULL  -> OK
--   full index    + ON CONFLICT (tweet_id)                             -> OK
--
-- So every archive import would have written public.tweets and then failed on
-- the public.resources half, leaving the two sections inconsistent. Worse, the
-- Edge Function has a branch that reads that exact error and tells the operator
-- to apply migration 20260818000000 — advice that would have been useless,
-- because it was already applied and was itself the cause.
--
-- The partial form bought nothing. Postgres never treats NULLs as conflicting,
-- so a full unique index leaves the non-tweet rows in this mixed table exactly
-- as free as before; the predicate was documentation, and it cost correctness.
--
-- Safe to swap: at the time of writing resources holds 4,666 tweet-bearing rows
-- with 0 duplicate tweet_ids, so the new index builds without a cleanup pass.
DROP INDEX IF EXISTS public.resources_tweet_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS resources_tweet_id_unique
  ON public.resources (tweet_id);

COMMENT ON INDEX public.resources_tweet_id_unique IS
  'Conflict target for X archive imports. Deliberately NOT partial: PostgREST emits a bare ON CONFLICT (tweet_id), which cannot infer a partial index. NULL tweet_ids never conflict, so non-tweet rows are unaffected.';
