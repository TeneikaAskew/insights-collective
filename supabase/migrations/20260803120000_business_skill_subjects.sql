-- Business & professional subjects: communication, leadership,
-- stakeholder-management, project-management, negotiation.
--
-- Every soft skill previously funneled into the single broad
-- 'business-strategy' subject, so skills like "Executive Communication" or
-- "Stakeholder Management" could never match a course even though the catalog
-- holds ~480 active courses on these topics (~130 passing the quality bar).
-- This migration mirrors the frontend vocabulary change in
-- src/data/subjectKeywords.json: the keyword table gets the new groups (with
-- stakeholder / leadership / negotiation / project management MOVED out of
-- business-strategy), and the stored classification on coursera_courses is
-- recomputed for the new subjects, and stale business-strategy tags are
-- removed from rows that no longer match any remaining business-strategy
-- keyword — leaving them would keep e.g. a project-management certificate
-- ranked as a CENTRAL business-strategy course (primary_subjects drives
-- rankForSubject), outranking genuine strategy courses.

-- ── Keyword table ────────────────────────────────────────────────────────────

delete from public.coursera_subject_keywords
where (subject, keyword) in (
  ('business-strategy', 'stakeholder'),
  ('business-strategy', 'leadership'),
  ('business-strategy', 'negotiation'),
  ('business-strategy', 'project management')
);

insert into public.coursera_subject_keywords (subject, keyword) values
  ('communication', 'communication'),
  ('communication', 'public speaking'),
  ('communication', 'presentation skills'),
  ('communication', 'presentations'),
  ('communication', 'business writing'),
  ('communication', 'storytelling'),
  ('communication', 'technical writing'),
  ('communication', 'interpersonal skills'),
  ('leadership', 'leadership'),
  ('leadership', 'people management'),
  ('leadership', 'team management'),
  ('leadership', 'managing teams'),
  ('leadership', 'emotional intelligence'),
  ('leadership', 'coaching'),
  ('leadership', 'mentoring'),
  ('leadership', 'executive presence'),
  ('stakeholder-management', 'stakeholder'),
  ('project-management', 'project management'),
  ('project-management', 'agile'),
  ('project-management', 'scrum'),
  ('project-management', 'kanban'),
  ('project-management', 'project planning'),
  ('project-management', 'program management'),
  ('project-management', 'pmp'),
  ('negotiation', 'negotiation'),
  ('negotiation', 'negotiating'),
  ('negotiation', 'conflict resolution'),
  ('negotiation', 'persuasion')
on conflict (subject, keyword) do nothing;

-- ── Recompute stored classification for the new subjects ─────────────────────
-- Mirrors the build pipeline: subjects match on title + skill tags with word
-- boundaries; primary_subjects match on the title alone. Keywords contain no
-- regex metacharacters, so they embed directly in the pattern.

do $$
declare
  s text;
begin
  foreach s in array array[
    'communication', 'leadership', 'stakeholder-management',
    'project-management', 'negotiation'
  ] loop
    update public.coursera_courses c
    set subjects = c.subjects || array[s]
    where not (s = any(c.subjects))
      and exists (
        select 1 from public.coursera_subject_keywords k
        where k.subject = s
          and (c.title || ' ' || array_to_string(c.skills, ' '))
                ~* ('\m' || k.keyword || '\M')
      );

    update public.coursera_courses c
    set primary_subjects = c.primary_subjects || array[s]
    where not (s = any(c.primary_subjects))
      and exists (
        select 1 from public.coursera_subject_keywords k
        where k.subject = s
          and c.title ~* ('\m' || k.keyword || '\M')
      );
  end loop;
end $$;

-- ── Drop stale business-strategy tags ────────────────────────────────────────
-- The moved keywords no longer belong to business-strategy, so rows that were
-- classified into it only via those keywords must lose the tag — kept, they
-- would still rank as central business-strategy courses.

update public.coursera_courses c
set subjects = array_remove(c.subjects, 'business-strategy')
where 'business-strategy' = any(c.subjects)
  and not exists (
    select 1 from public.coursera_subject_keywords k
    where k.subject = 'business-strategy'
      and (c.title || ' ' || array_to_string(c.skills, ' '))
            ~* ('\m' || k.keyword || '\M')
  );

update public.coursera_courses c
set primary_subjects = array_remove(c.primary_subjects, 'business-strategy')
where 'business-strategy' = any(c.primary_subjects)
  and not exists (
    select 1 from public.coursera_subject_keywords k
    where k.subject = 'business-strategy'
      and c.title ~* ('\m' || k.keyword || '\M')
  );
