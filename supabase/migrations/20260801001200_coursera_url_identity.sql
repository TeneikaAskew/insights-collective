-- ABOUTME: Makes `url` the identity of public.coursera_courses instead of `slug`.
-- ABOUTME: Coursera reuses one slug across path prefixes, so slug-as-primary-key made
-- ABOUTME: two different courses collide and silently overwrite each other.
--
-- The bug
-- -------
-- https://www.coursera.org/learn/python           "Programming for Everybody"
-- https://www.coursera.org/specializations/python "Python for Everybody"
--
-- Different courses. Same slug. 56 such pairs in the crawl queue, 112 URLs involved,
-- and 35 already-stored rows were queued to be overwritten by their sibling. With
-- `slug` as the primary key and the upsert conflict target, whichever was crawled
-- second replaced the first — no error, no duplicate, just a row quietly changing
-- into a different course.
--
-- This also defeated the program boost added alongside it: the specialization and its
-- own member course are exactly the pair most likely to share a slug, so preferring
-- programs meant nothing if one had already overwritten the other.
--
-- Why it went unnoticed
-- --------------------
-- Every layer independently assumed slug was unique — the primary key, the Edge
-- Function's `onConflict`, the generator's dedupe (which dropped 33 rows as
-- "duplicates"), and the client's slug-keyed lookup map. Nothing disagreed, so nothing
-- failed. It surfaced only when a course that should have been in the catalog was not.
--
-- Applied in two steps against the live database so the running crawl never broke:
-- the unique index first (both conflict targets valid), then the Edge Function
-- redeployed to upsert on url, then the primary key moved. `slug` stays as an indexed
-- attribute — still useful, no longer load-bearing.

-- Step 1: url unique. Additive, so `onConflict: 'slug'` keeps working meanwhile.
create unique index if not exists coursera_courses_url_key on public.coursera_courses (url);

-- Step 2: repoint the primary key. Safe only once the function upserts on url.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.coursera_courses'::regclass
      and conname = 'coursera_courses_pkey'
      and (select attname from pg_attribute
           where attrelid = conrelid and attnum = conkey[1]) = 'slug'
  ) then
    alter table public.coursera_courses drop constraint coursera_courses_pkey;
    alter table public.coursera_courses add primary key using index coursera_courses_url_key;
  end if;
end $$;

-- Slug is still worth looking up by; it just is not unique.
create index if not exists coursera_courses_slug_idx on public.coursera_courses (slug);

comment on column public.coursera_courses.slug is
  'Coursera URL slug. NOT unique — /learn/<slug> and /specializations/<slug> are different courses that share one. `url` is the identity.';
