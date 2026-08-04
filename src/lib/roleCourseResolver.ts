// ABOUTME: Picks the courses to recommend for a career role. Courses published on
// ABOUTME: Insights Collective are always primary; Coursera fills only the subject
// ABOUTME: areas the platform has nothing for. Pure functions, no data fetching —
// ABOUTME: `useRoleCourses` supplies the published-course list.

import {
  courseraCoursesForSubject,
  courseraUrl,
  subjectIndexFor,
  type CourseraCourse,
} from '@/data/courseraCatalog';
import { BUSINESS_SUBJECTS, inferSubjects, type LearningSubject } from '@/data/learningSubjects';
import { subjectsForRole } from '@/data/roleLearningPaths';
import type { PublishedCourse } from '@/hooks/usePublishedCourses';

export interface ResolvedCourse {
  /** Which shelf this came from. Drives routing and the "on Coursera" badge. */
  source: 'platform' | 'coursera';
  /**
   * Platform course UUID, or Coursera course URL.
   *
   * The URL rather than the slug, because slugs are not unique across Coursera's
   * path prefixes — using one as a React key produced duplicates.
   */
  id: string;
  title: string;
  description: string;
  /** Internal route for platform courses, absolute URL for Coursera. */
  href: string;
  external: boolean;
  level: string | null;
  /** "Insights Collective" or the Coursera partner, e.g. "IBM". */
  provider: string;
  /** Subjects from the role's path that this course covers. */
  matchedSubjects: LearningSubject[];
  /**
   * Star rating and review count, for Coursera courses only — the platform does
   * not collect course ratings yet, so platform rows leave these null rather than
   * showing a fabricated score.
   */
  rating: number | null;
  reviews: number | null;
}

export interface ResolvedRoleCourses {
  /** Courses hosted on this platform, best match first. Always shown first. */
  platform: ResolvedCourse[];
  /** Coursera courses covering subjects `platform` left uncovered. */
  coursera: ResolvedCourse[];
  /** Subjects the role needs that no platform course covers. */
  uncoveredSubjects: LearningSubject[];
  /**
   * True when the platform has nothing for this role at all, so every
   * recommendation is external. The UI words the section differently.
   */
  platformIsEmpty: boolean;
}

export interface ResolveOptions {
  /** Cap on platform courses shown. Default 6. */
  platformLimit?: number;
  /** Cap on Coursera courses shown. Default 4. */
  courseraLimit?: number;
  /**
   * Coursera catalog to draw from. Postgres is the only source — `useCourseraCatalog`
   * passes the rows it fetched.
   *
   * Omitting it yields NO Coursera courses. It used to mean "use the copy bundled
   * with the app", which made forgetting to pass a catalog indistinguishable from
   * passing a good one. Loading and failure are both `undefined` here on purpose:
   * this function is pure and cannot tell them apart, so the hook exposes
   * `{ error, isEmpty, isLoading }` and the UI does the telling.
   */
  catalog?: CourseraCourse[];
}

/**
 * Field weights for subject inference.
 *
 * `category` and `tags` are the fields an instructor fills in deliberately to
 * classify a course, so a subject found there is strong evidence. A subject found
 * only in prose is weak — a description mentioning "we'll touch on SQL" should
 * not make a course rank as an SQL course.
 */
const CATEGORY_WEIGHT = 3;
const TAG_WEIGHT = 3;
const PROSE_WEIGHT = 1;

/**
 * Prose-only matches needed to qualify a course on their own.
 *
 * One is not enough: "we briefly mention SQL" in a communication course would
 * otherwise rank it as an SQL course for a SQL developer. Two independent
 * subjects appearing in the same description is no longer a passing mention.
 */
const MIN_PROSE_ONLY_MATCHES = 2;

interface ScoredPlatformCourse {
  course: PublishedCourse;
  score: number;
  matchedSubjects: LearningSubject[];
  /**
   * True when the instructor classified this course into one of the role's
   * subjects via `category` or `tags`, rather than merely mentioning it.
   */
  hasDeliberateMatch: boolean;
  proseOnlyMatches: number;
}

/**
 * How well a published course serves a role, plus which of the role's subjects it
 * covers. A subject's contribution is its priority in the role's path (earlier =
 * heavier) times the weight of the field it was found in.
 */
export function scorePlatformCourse(
  course: PublishedCourse,
  roleSubjects: LearningSubject[],
): ScoredPlatformCourse {
  const fromCategory = new Set(inferSubjects(course.category));
  const fromTags = new Set(inferSubjects(course.tags?.join(' ')));
  const fromProse = new Set(inferSubjects(course.title, course.description));

  let score = 0;
  let hasDeliberateMatch = false;
  let proseOnlyMatches = 0;
  const matchedSubjects: LearningSubject[] = [];

  roleSubjects.forEach((subject, index) => {
    // Earlier subjects in the role's path matter more. A five-subject path
    // weights its first subject 5x and its last 1x.
    const priority = roleSubjects.length - index;

    const inCategory = fromCategory.has(subject);
    const inTags = fromTags.has(subject);
    const inProse = fromProse.has(subject);

    let fieldWeight = 0;
    if (inCategory) fieldWeight += CATEGORY_WEIGHT;
    if (inTags) fieldWeight += TAG_WEIGHT;
    if (inProse) fieldWeight += PROSE_WEIGHT;

    if (fieldWeight > 0) {
      score += priority * fieldWeight;
      matchedSubjects.push(subject);

      if (inCategory || inTags) hasDeliberateMatch = true;
      else proseOnlyMatches += 1;
    }
  });

  return { course, score, matchedSubjects, hasDeliberateMatch, proseOnlyMatches };
}

/**
 * Whether a scored course is related enough to the role to recommend.
 *
 * Classification the instructor made on purpose (`category`, `tags`) is trusted
 * outright. Description text alone has to clear a higher bar — see
 * `MIN_PROSE_ONLY_MATCHES`.
 */
function isRelevant(scored: ScoredPlatformCourse): boolean {
  return scored.hasDeliberateMatch || scored.proseOnlyMatches >= MIN_PROSE_ONLY_MATCHES;
}

function toResolvedPlatformCourse(scored: ScoredPlatformCourse): ResolvedCourse {
  return {
    source: 'platform',
    id: scored.course.id,
    title: scored.course.title,
    description: scored.course.description,
    href: `/courses/${scored.course.id}`,
    external: false,
    level: scored.course.level,
    provider: 'Insights Collective',
    matchedSubjects: scored.matchedSubjects,
    rating: null,
    reviews: null,
  };
}

function toResolvedCourseraCourse(
  course: CourseraCourse,
  matchedSubjects: LearningSubject[],
): ResolvedCourse {
  return {
    source: 'coursera',
    id: course.url,
    title: course.title,
    description: course.description,
    href: courseraUrl(course),
    external: true,
    level: course.level,
    provider: course.partner,
    matchedSubjects,
    rating: course.rating,
    reviews: course.reviews,
  };
}

/**
 * Course recommendations for a role.
 *
 * The rule this implements, in order:
 *
 *  1. Every published platform course relevant to the role is offered first,
 *     ranked by how central it is to the role.
 *  2. Whatever subjects those courses leave uncovered fall through to Coursera,
 *     one course per gap, taking the highest-priority gaps first.
 *  3. A role with no platform courses at all is therefore an all-Coursera list —
 *     the fallback is a natural consequence of every subject being uncovered, not
 *     a separate branch.
 *
 * Passing an empty `platformCourses` (still loading, or the query failed) is
 * safe: the caller gets the Coursera list rather than an empty section.
 */
export function resolveRoleCourses(
  role: { id: string; category?: string },
  platformCourses: PublishedCourse[],
  options: ResolveOptions = {},
): ResolvedRoleCourses {
  const { platformLimit = 6, courseraLimit = 4, catalog } = options;
  const roleSubjects = subjectsForRole(role.id, role.category);
  const subjectIndex = subjectIndexFor(catalog);

  const scored = platformCourses
    .map((course) => scorePlatformCourse(course, roleSubjects))
    .filter(isRelevant)
    .sort((a, b) => b.score - a.score || a.course.title.localeCompare(b.course.title));

  const platform = scored.slice(0, platformLimit).map(toResolvedPlatformCourse);

  // Only courses actually shown count as covering a subject. A relevant course
  // pushed past `platformLimit` is not something the learner can see.
  const covered = new Set<LearningSubject>(
    platform.flatMap((course) => course.matchedSubjects),
  );
  const uncoveredSubjects = roleSubjects.filter((subject) => !covered.has(subject));

  const coursera: ResolvedCourse[] = [];
  const usedUrls = new Set<string>();

  const pick = (subject: LearningSubject): boolean => {
    const candidate = courseraCoursesForSubject(subject, subjectIndex).find(
      (course) => !usedUrls.has(course.url),
    );
    if (!candidate) return false;

    usedUrls.add(candidate.url);
    coursera.push(
      toResolvedCourseraCourse(
        candidate,
        // Credit the course for every uncovered subject it happens to teach, so
        // the UI can explain a single pick that closes two gaps at once.
        candidate.subjects.filter((s) => uncoveredSubjects.includes(s)),
      ),
    );
    return true;
  };

  // Role paths end with one business subject (communication, leadership, …) at
  // the lowest priority. Priority order alone would starve it: with the limit
  // at four and five-plus technical subjects uncovered, the tail was never
  // reached — exactly in the all-Coursera fallback the tail exists for. So one
  // slot is reserved for it whenever an uncovered business subject exists, and
  // released back to the technical subjects if no business course can fill it.
  const uncoveredTechnical = uncoveredSubjects.filter((s) => !BUSINESS_SUBJECTS.has(s));
  const uncoveredBusiness = uncoveredSubjects.filter((s) => BUSINESS_SUBJECTS.has(s));
  const technicalCap = uncoveredBusiness.length > 0 ? courseraLimit - 1 : courseraLimit;

  const technicalQueue = [...uncoveredTechnical];
  while (coursera.length < technicalCap && technicalQueue.length > 0) {
    pick(technicalQueue.shift()!);
  }
  for (const subject of uncoveredBusiness) {
    if (coursera.length >= courseraLimit) break;
    pick(subject);
  }
  while (coursera.length < courseraLimit && technicalQueue.length > 0) {
    pick(technicalQueue.shift()!);
  }

  return {
    platform,
    coursera,
    uncoveredSubjects,
    platformIsEmpty: platform.length === 0,
  };
}
