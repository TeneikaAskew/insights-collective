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
   * The Coursera read failed. Render it — do not swallow it. The predecessor of
   * this field was `usedBundledCatalog`, described as "useful for admin
   * diagnostics; not shown to learners, since the recommendations are equivalent
   * either way". They were not equivalent: one set was live, the other was frozen
   * at build time. And no component ever read the flag, so nobody found out.
   */
  courseraError: Error | null;
  /** The Coursera read succeeded and covered none of this role's subjects. */
  courseraEmpty: boolean;
  /** Re-run the Coursera read. */
  retryCoursera: () => void;
}

/**
 * Recommended courses for `role`.
 *
 * While the reads are in flight the Coursera list is EMPTY and `loading` is true;
 * consumers show a skeleton. It used to be the bundled catalog, which narrowed to
 * real data on arrival — a deliberate choice to avoid a section popping in, but
 * one that also made a failed read indistinguishable from a slow one, because the
 * placeholder and the failure state were the same list of real-looking courses.
 * Showing a skeleton costs a moment of blank space and buys an honest failure.
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
  const {
    catalog,
    loading: catalogLoading,
    error: courseraError,
    isEmpty: courseraEmpty,
    retry: retryCoursera,
  } = useCourseraCatalog(subjects);

  const platformLimit = options?.platformLimit;
  const courseraLimit = options?.courseraLimit;

  const resolved = useMemo(
    () => resolveRoleCourses(role, courses, { platformLimit, courseraLimit, catalog }),
    [role.id, role.category, courses, platformLimit, courseraLimit, catalog],
  );

  return {
    ...resolved,
    loading: platformLoading || catalogLoading,
    courseraError,
    courseraEmpty,
    retryCoursera,
  };
}
