// ABOUTME: Matches free-text skill names ("SQL", "Data Visualization") to Coursera
// ABOUTME: courses. Skills are not roles — they arrive from LLM pathway reports,
// ABOUTME: portfolio gap analyses and quiz tracks — so each skill is classified
// ABOUTME: into the shared subject vocabulary, then ranked courses are distributed
// ABOUTME: across skills without repeating a course. Pure functions, no fetching.

import {
  courseraCoursesForSubject,
  subjectIndexFor,
  type CourseraCourse,
} from '@/data/courseraCatalog';
import { inferSubjects, type LearningSubject } from '@/data/learningSubjects';
import type { ResolvedCourse } from '@/lib/roleCourseResolver';

/**
 * A skill-matched course. Same shape the role resolver produces, plus the
 * Coursera format ("Course" / "Specialization" / "Professional Certificate")
 * because skill surfaces show it in the meta line. `ResolvedCourse` itself is
 * left untouched — it is shared with the merged role work.
 */
export interface SkillCourse extends ResolvedCourse {
  format: CourseraCourse['format'];
}

export interface ResolveSkillOptions {
  /**
   * Catalog to draw from. Injected for the same reason `resolveRoleCourses`
   * takes one: the rows come from Postgres via `useCourseraCatalog`. Omitting it
   * yields NO courses — it no longer falls back to a bundled copy.
   */
  catalog?: CourseraCourse[];
  /** Cap on courses per skill. Default 3. */
  perSkillLimit?: number;
}

/**
 * Each skill's subjects, inferred from its name.
 *
 * A skill that mentions nothing in the vocabulary ("Stakeholder Management")
 * maps to an empty list — the caller renders its existing fallback content for
 * that skill rather than a wrong course.
 */
export function subjectsForSkills(skills: string[]): Map<string, LearningSubject[]> {
  const map = new Map<string, LearningSubject[]>();
  for (const skill of skills) {
    if (!map.has(skill)) map.set(skill, inferSubjects(skill));
  }
  return map;
}

/** The union of every skill's subjects, in stable vocabulary order. */
export function subjectsForSkillSet(skills: string[]): LearningSubject[] {
  const seen = new Set<LearningSubject>();
  for (const subjects of subjectsForSkills(skills).values()) {
    for (const subject of subjects) seen.add(subject);
  }
  return [...seen];
}

/**
 * Convert a catalog row into the shared resolved shape. Public because the
 * role resolver keeps its own converter private, and surfaces built on this
 * module need the same conversion for ad-hoc course lists (e.g. quiz tracks).
 */
export function resolvedFromCoursera(
  course: CourseraCourse,
  matchedSubjects: LearningSubject[],
): SkillCourse {
  return {
    source: 'coursera',
    id: course.url,
    title: course.title,
    description: course.description,
    href: course.url,
    external: true,
    level: course.level,
    provider: course.partner,
    matchedSubjects,
    rating: course.rating,
    reviews: course.reviews,
    format: course.format,
  };
}

/**
 * Ranked candidates for one skill: its subjects' course lists concatenated in
 * inference order, de-duplicated by url. Subject ranking (featured, primary
 * subject, quality) is already baked into the per-subject lists.
 */
function candidatesForSkill(
  subjects: LearningSubject[],
  index: ReturnType<typeof subjectIndexFor>,
): CourseraCourse[] {
  const seen = new Set<string>();
  const out: CourseraCourse[] = [];
  for (const subject of subjects) {
    for (const course of courseraCoursesForSubject(subject, index)) {
      if (seen.has(course.url)) continue;
      seen.add(course.url);
      out.push(course);
    }
  }
  return out;
}

/**
 * Courses for each skill, up to `perSkillLimit`, spreading the catalog across
 * skills rather than letting the first skill take every good course.
 *
 * Distribution is round-robin: in each round every skill claims its next
 * best not-yet-claimed course, so two skills that share a subject split its
 * top courses instead of duplicating them. A skill whose candidates were all
 * claimed by others falls back to reusing them — an empty list is reserved
 * for skills the catalog genuinely has nothing for.
 */
export function resolveSkillCourses(
  skills: string[],
  options: ResolveSkillOptions = {},
): Map<string, SkillCourse[]> {
  const { catalog, perSkillLimit = 3 } = options;
  const index = subjectIndexFor(catalog);
  const subjectsBySkill = subjectsForSkills(skills);

  const orderedSkills = [...subjectsBySkill.keys()];
  const candidates = new Map<string, CourseraCourse[]>(
    orderedSkills.map((skill) => [
      skill,
      candidatesForSkill(subjectsBySkill.get(skill) ?? [], index),
    ]),
  );

  const picks = new Map<string, CourseraCourse[]>(orderedSkills.map((skill) => [skill, []]));
  const claimed = new Set<string>();

  for (let round = 0; round < perSkillLimit; round++) {
    for (const skill of orderedSkills) {
      const mine = picks.get(skill)!;
      if (mine.length > round) continue;
      const next = candidates.get(skill)!.find((course) => !claimed.has(course.url));
      if (!next) continue;
      claimed.add(next.url);
      mine.push(next);
    }
  }

  // Reuse pass: a skill starved by claims still shows its own best matches.
  for (const skill of orderedSkills) {
    const mine = picks.get(skill)!;
    if (mine.length > 0) continue;
    picks.set(skill, candidates.get(skill)!.slice(0, perSkillLimit));
  }

  const resolved = new Map<string, SkillCourse[]>();
  for (const skill of orderedSkills) {
    const subjects = subjectsBySkill.get(skill) ?? [];
    resolved.set(
      skill,
      picks
        .get(skill)!
        .map((course) =>
          resolvedFromCoursera(
            course,
            course.subjects.filter((subject) => subjects.includes(subject)),
          ),
        ),
    );
  }
  return resolved;
}
