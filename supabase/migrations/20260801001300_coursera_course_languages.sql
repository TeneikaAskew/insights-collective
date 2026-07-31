-- ABOUTME: Records the language a Coursera course is taught in, so an
-- ABOUTME: English-language platform stops recommending Spanish and Portuguese courses.
--
-- Why this was needed
-- -------------------
-- Nothing filtered by language, and the assumption that non-English courses would be
-- caught by their titles was wrong — the offenders are Latin-script:
--
--   "Introducción a la programación con Python"          live, above the quality bar
--   "Introdução à Ciência da Computação com Python"      live, above the quality bar
--
-- Both were eligible to fill the `python` slot on an English-language career page. A
-- character-class heuristic would have missed both.
--
-- The source is Coursera's `primaryLanguages` — deliberately NOT subtitleLanguages,
-- translatedLanguages or dubbedLanguages. A popular English course lists dozens of
-- those, which describe availability rather than the course, and using them would make
-- everything look multilingual and defeat the filter entirely.
--
-- Empty means UNKNOWN, not "not English"
-- --------------------------------------
-- Every row crawled before this column existed has an empty array. Readers keep those
-- rather than hiding them, so the catalog does not blank out while the backfill runs;
-- `enqueue-refresh` re-crawls the existing rows to fill them in.

alter table public.coursera_courses
  add column if not exists languages text[] not null default '{}';

comment on column public.coursera_courses.languages is
  'ISO codes the course is taught in, from Coursera primaryLanguages. Empty means the page did not say (or the row predates language capture) — readers should treat empty as unknown and keep the row rather than hide it.';

create index if not exists coursera_courses_languages_idx
  on public.coursera_courses using gin (languages);
