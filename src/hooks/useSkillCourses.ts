// ABOUTME: Coursera course recommendations keyed by free-text skill name.
// ABOUTME: Wraps the subject inference, the database-backed catalog read (with
// ABOUTME: its bundled fallback) and the pure skill resolver so components take
// ABOUTME: one hook: useSkillCourses(missingSkills) -> Map<skill, courses>.

import { useMemo } from 'react';
import { useCourseraCatalog } from './useCourseraCatalog';
import {
  resolveSkillCourses,
  subjectsForSkillSet,
  type SkillCourse,
} from '@/lib/skillCourseResolver';

export interface UseSkillCoursesResult {
  /** Up to `perSkillLimit` courses per skill; empty array = no match for that skill. */
  coursesBySkill: Map<string, SkillCourse[]>;
  loading: boolean;
  /** The Coursera read failed — every skill's list is empty for that reason, not for lack of matches. */
  error: Error | null;
  /** Re-run the read. */
  retry: () => void;
}

export function useSkillCourses(
  skills: string[],
  options?: { perSkillLimit?: number },
): UseSkillCoursesResult {
  // Skills arrive from render-time arrays (LLM report rows, quiz data), so key
  // the memos on content, not identity.
  const skillsKey = skills.join('\u0000');

  // Originals kept alongside the trimmed values: the resolver works on trimmed
  // names, but callers look the result up with the exact strings they passed
  // in — an LLM skill like " SQL " must still find its match.
  const skillNames = useMemo(
    () => {
      const originals = skills.filter((s) => s.trim());
      return { originals, trimmed: originals.map((s) => s.trim()) };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [skillsKey],
  );

  const subjects = useMemo(
    () => subjectsForSkillSet(skillNames.trimmed),
    [skillNames],
  );

  const { catalog, loading, error, retry } = useCourseraCatalog(subjects);

  const perSkillLimit = options?.perSkillLimit;
  const coursesBySkill = useMemo(() => {
    const resolved = resolveSkillCourses(skillNames.trimmed, { catalog, perSkillLimit });
    const bySkill = new Map<string, SkillCourse[]>();
    for (const original of skillNames.originals) {
      bySkill.set(original, resolved.get(original.trim()) ?? []);
    }
    return bySkill;
  }, [skillNames, catalog, perSkillLimit]);

  return { coursesBySkill, loading, error, retry };
}
