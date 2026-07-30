// ABOUTME: The Coursera catalog used as the SECONDARY course source — it fills the
// ABOUTME: subject areas Insights Collective's own published courses do not cover.
// ABOUTME: Rows live in courseraCatalog.generated.ts, built from a catalog CSV
// ABOUTME: snapshot; this module owns the type and the lookup helpers.

import type { LearningSubject } from './learningSubjects';
import { generatedCourseraCatalog } from './courseraCatalog.generated';

export interface CourseraCourse {
  /** Coursera URL slug. Also this entry's stable id. */
  slug: string;
  /**
   * Canonical course URL, taken from the source data rather than derived.
   *
   * Coursera serves three different path prefixes — /learn/, /specializations/
   * and /professional-certificates/ — and which one a course uses cannot be
   * inferred from its format reliably. An earlier hand-curated version of this
   * file built URLs from a format field and got 11 of 34 wrong.
   */
  url: string;
  title: string;
  /** The organization that authors the course, not "Coursera". */
  partner: string;
  format: 'Course' | 'Specialization' | 'Professional Certificate';
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  /** Coursera's star rating, 0-5. */
  rating: number;
  reviews: number;
  /** Subjects this course teaches, in `LEARNING_SUBJECTS` order. */
  subjects: LearningSubject[];
  /**
   * The subset of `subjects` named in the course TITLE — what the course is
   * actually about, as opposed to what its skill tags happen to mention. Ranking
   * needs this: "Neural Networks and Deep Learning" lists Python programming among
   * its skills and has enormous review counts, so on popularity alone it beat every
   * real software-engineering course for that slot.
   */
  primarySubjects: LearningSubject[];
  /** Coursera's own skill tags, kept for display and for future re-inference. */
  skills: string[];
  description: string;
}

export const courseraCatalog: CourseraCourse[] = generatedCourseraCatalog;

/** Catalog indexed by slug, for O(1) lookup and duplicate detection in tests. */
export const courseraCatalogBySlug: Record<string, CourseraCourse> = Object.fromEntries(
  courseraCatalog.map((course) => [course.slug, course]),
);

/**
 * The course URL. A passthrough now that the source data carries it — kept as a
 * function so callers never rebuild the URL from parts themselves.
 */
export function courseraUrl(course: CourseraCourse): string {
  return course.url;
}

/**
 * Rating weighted by audience size.
 *
 * Rating alone puts a 5.0-from-12-reviews course above a 4.8-from-300,000 one, so
 * damp it by the log of the review count — the standard fix for sparse-rating
 * bias. Mirrors `qualityScore` in scripts/build-coursera-catalog.mjs so the courses
 * the generator chose to keep are ranked the same way when displayed.
 */
function qualityScore(course: CourseraCourse): number {
  return course.rating * Math.log10(10 + course.reviews);
}

/**
 * Ranks courses for one subject: the ones the subject is central to first, then by
 * quality, with slug as a stable tie-break.
 *
 * Centrality has to outrank popularity. A wildly popular course that merely
 * touches a subject is a worse recommendation than a good course built around it,
 * and popularity alone reliably picked the former.
 */
function rankForSubject(subject: LearningSubject) {
  return (a: CourseraCourse, b: CourseraCourse): number => {
    const aPrimary = a.primarySubjects.includes(subject) ? 1 : 0;
    const bPrimary = b.primarySubjects.includes(subject) ? 1 : 0;
    return bPrimary - aPrimary || qualityScore(b) - qualityScore(a) || a.slug.localeCompare(b.slug);
  };
}

export type SubjectIndex = Map<LearningSubject, CourseraCourse[]>;

/**
 * Group a catalog by subject, ranked within each. Exported because the catalog can
 * come from the database at runtime rather than from this bundle.
 */
export function indexCatalogBySubject(catalog: CourseraCourse[]): SubjectIndex {
  const index: SubjectIndex = new Map();
  for (const course of catalog) {
    for (const subject of course.subjects) {
      if (!index.has(subject)) index.set(subject, []);
      index.get(subject)!.push(course);
    }
  }
  for (const [subject, courses] of index) courses.sort(rankForSubject(subject));
  return index;
}

/** Index over the bundled catalog, built once. */
const bundledIndex = indexCatalogBySubject(courseraCatalog);

/**
 * Indexes for database-supplied catalogs, keyed by the array itself. React Query
 * hands back the same array reference until the data changes, so this rebuilds only
 * on an actual refetch rather than on every render.
 */
const indexCache = new WeakMap<CourseraCourse[], SubjectIndex>();

export function subjectIndexFor(catalog?: CourseraCourse[]): SubjectIndex {
  if (!catalog || catalog === courseraCatalog) return bundledIndex;
  let index = indexCache.get(catalog);
  if (!index) {
    index = indexCatalogBySubject(catalog);
    indexCache.set(catalog, index);
  }
  return index;
}

/**
 * Catalog entries that teach `subject`, best-first. See `rankForSubject`.
 *
 * Pass `index` to read from a database-supplied catalog; omit it for the bundled one.
 */
export function courseraCoursesForSubject(
  subject: LearningSubject,
  index: SubjectIndex = bundledIndex,
): CourseraCourse[] {
  return index.get(subject) ?? [];
}
