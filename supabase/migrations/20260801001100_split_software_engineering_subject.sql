-- ABOUTME: Splits the `software-engineering` subject into `software-engineering` and
-- ABOUTME: `web-development`, and reclassifies existing catalog rows against the new
-- ABOUTME: keyword table without re-crawling.
--
-- Why
-- ---
-- `software-engineering` was too coarse. Its keyword list carried "javascript",
-- "react", "frontend" and "full stack" alongside "devops" and "api", so a web course
-- could win the slot for any role that listed the subject. Checking what the app would
-- actually render surfaced the result: both an MLOps Engineer and a Cloud Security
-- Engineer were being recommended "HTML, CSS, and Javascript for Web Developers".
--
-- Splitting the vocabulary is the fix. Browser and full-stack keywords move to
-- `web-development`, which only genuinely web-facing roles list — full-stack developer,
-- and the data visualization specialist, whose toolset includes D3.js. Every other
-- engineering role keeps `software-engineering`, which now means DevOps, APIs, testing
-- and language fundamentals.
--
-- src/data/subjectKeywords.json stays canonical; this mirrors it into the table the
-- Edge Function reads.

-- Shared helper so the pattern is built the same way everywhere. Only '.' and '+'
-- occur as regex metacharacters in the keyword table (node.js, c++); escaping those
-- two avoids depending on bracket-expression escaping rules.
create or replace function public.coursera_kw_pattern(p_keyword text)
returns text language sql immutable as $$
  select '(^|[^a-z0-9])' || replace(replace(p_keyword, '.', '\.'), '+', '\+') || '([^a-z0-9]|$)';
$$;

comment on function public.coursera_kw_pattern(text) is
  'Word-boundary, case-insensitive regex for a subject keyword. Mirrors inferSubjects() in src/data/learningSubjects.ts.';

-- ── Re-seed the two affected subjects ───────────────────────────────────────
delete from public.coursera_subject_keywords
  where subject in ('software-engineering', 'web-development');

insert into public.coursera_subject_keywords (subject, keyword)
select s.subject, trim(k) from (values
  ('software-engineering', 'software engineering|software development|software design|software architecture|programming|object oriented|design patterns|data structures|debugging|api|apis|rest api|microservices|backend|back-end|server-side|ci/cd|devops|unit testing|test automation|git|version control|java|c++|scala|golang'),
  ('web-development', 'web development|web developer|web design|web application|web applications|html|css|javascript|typescript|react|angular|vue|node.js|nodejs|frontend|front-end|full stack|full-stack|responsive design|user interface|django|flask|express|bootstrap|jquery')
) as s(subject, kws), unnest(string_to_array(s.kws, '|')) as k
on conflict do nothing;

-- ── Reclassify affected rows ────────────────────────────────────────────────
--
-- Only these two subjects changed, so only their membership is recomputed and every
-- other subject on a row is left untouched. Recomputing all 26 subjects across the
-- whole catalog exceeded the statement timeout; this touches ~1,500 rows.
--
-- Idempotent: re-running recomputes the same membership from the same keywords.
with cand as (
  select c.slug, c.subjects, c.primary_subjects, c.title,
         c.title || ' , ' || array_to_string(c.skills, ' , ') as haystack
  from public.coursera_courses c
  where 'software-engineering' = any(c.subjects)
     or 'web-development' = any(c.subjects)
     or exists (
       select 1 from public.coursera_subject_keywords k
       where k.subject = 'web-development'
         and (c.title || ' , ' || array_to_string(c.skills, ' , '))
             ~* public.coursera_kw_pattern(k.keyword)
     )
),
flags as (
  select cand.*,
    (select coalesce(array_agg(distinct k.subject), '{}')
       from public.coursera_subject_keywords k
      where k.subject in ('software-engineering', 'web-development')
        and cand.haystack ~* public.coursera_kw_pattern(k.keyword)) as new_full,
    (select coalesce(array_agg(distinct k.subject), '{}')
       from public.coursera_subject_keywords k
      where k.subject in ('software-engineering', 'web-development')
        and cand.title ~* public.coursera_kw_pattern(k.keyword)) as new_title
  from cand
)
update public.coursera_courses c
set subjects = (
      select coalesce(array_agg(distinct s order by s), '{}')
      from unnest(array_remove(array_remove(f.subjects, 'software-engineering'), 'web-development')
                  || f.new_full) s),
    primary_subjects = (
      select coalesce(array_agg(distinct s order by s), '{}')
      from unnest(array_remove(array_remove(f.primary_subjects, 'software-engineering'), 'web-development')
                  || f.new_title) s)
from flags f
where c.slug = f.slug;

-- Least privilege, matching the other coursera_* helpers. This is an internal regex
-- builder used by maintenance SQL; a browser session has no reason to call it, and it
-- was the only one of the four left executable by anon and authenticated.
revoke all on function public.coursera_kw_pattern(text) from public, anon, authenticated;
