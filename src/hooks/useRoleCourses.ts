// ABOUTME: Course recommendations for a career role — platform courses first,
// ABOUTME: Coursera filling whatever subjects they leave uncovered. Wraps the
// ABOUTME: published-course read, the database-backed Coursera catalog, and the pure
// ABOUTME: resolver so components take one hook.

import { useMemo } from 'react';
import { usePublishedCourses } from './usePublishedCourses';
import { useCourseraCatalog } from './useCourseraCatalog';
import { subjectsForRole } from '@/data/roleLearningPaths';
import {
  resolveRoleCourses,
  type ResolveOptions,
  type ResolvedRoleCourses,
} from '@/lib/roleCourseResolver';

export interface UseRoleCoursesResult extends ResolvedRoleCourses {
  loading: boolean;
  /**
   * True when the Coursera list came from the copy bundled with the app rather than
   * from the database. Useful for admin diagnostics; not shown to learners, since
   * the recommendations are equivalent either way.
   */
  usedBundledCatalog: boolean;
}

/**
 * Recommended courses for `role`.
 *
 * While the reads are in flight the result is the bundled-catalog fallback, which
 * then narrows once real data arrives. That ordering is deliberate: a brief list
 * beats an empty section that pops in, and it is also exactly what the caller gets
 * if either query fails outright.
 */
export function useRoleCourses(
  role: { id: string; category?: string },
  options?: ResolveOptions,
): UseRoleCoursesResult {
  const { courses, loading: platformLoading } = usePublishedCourses();

  // The role's subjects decide which slice of the catalog to fetch, so they are
  // computed here rather than inside the resolver.
  const subjects = useMemo(
    () => subjectsForRole(role.id, role.category),
    [role.id, role.category],
  );
  const { catalog, loading: catalogLoading, usedFallback } = useCourseraCatalog(subjects);

  const platformLimit = options?.platformLimit;
  const courseraLimit = options?.courseraLimit;

  const resolved = useMemo(
    () => resolveRoleCourses(role, courses, { platformLimit, courseraLimit, catalog }),
    [role.id, role.category, courses, platformLimit, courseraLimit, catalog],
  );

  return {
    ...resolved,
    loading: platformLoading || catalogLoading,
    usedBundledCatalog: usedFallback,
  };
}
