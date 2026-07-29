// ABOUTME: Course recommendations for a career role — platform courses first,
// ABOUTME: Coursera filling whatever subjects they leave uncovered. Wraps the
// ABOUTME: published-course read and the pure resolver so components take one hook.

import { useMemo } from 'react';
import { usePublishedCourses } from './usePublishedCourses';
import {
  resolveRoleCourses,
  type ResolveOptions,
  type ResolvedRoleCourses,
} from '@/lib/roleCourseResolver';

export interface UseRoleCoursesResult extends ResolvedRoleCourses {
  loading: boolean;
}

/**
 * Recommended courses for `role`.
 *
 * While the platform read is in flight the result is the pure-Coursera fallback,
 * which then narrows once real courses arrive. That ordering is deliberate: a
 * brief external-only list beats an empty section that pops in, and it is also
 * exactly what the caller gets if the query fails outright.
 */
export function useRoleCourses(
  role: { id: string; category?: string },
  options?: ResolveOptions,
): UseRoleCoursesResult {
  const { courses, loading } = usePublishedCourses();

  const platformLimit = options?.platformLimit;
  const courseraLimit = options?.courseraLimit;

  const resolved = useMemo(
    () => resolveRoleCourses(role, courses, { platformLimit, courseraLimit }),
    [role.id, role.category, courses, platformLimit, courseraLimit],
  );

  return { ...resolved, loading };
}
