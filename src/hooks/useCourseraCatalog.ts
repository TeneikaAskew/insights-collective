// ABOUTME: Reads the Coursera catalog from Postgres for a given set of subjects.
// ABOUTME: This is the ONLY source — there is no bundled fallback any more, so a
// ABOUTME: failed read reports `error` and an empty one reports `isEmpty`, and the
// ABOUTME: consumers render those states instead of quietly showing build-time data.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';
import type { LearningSubject } from '@/data/learningSubjects';
import type { CourseraCourse } from '@/data/courseraCatalog';

const logger = createLogger('useCourseraCatalog');

/**
 * Quality bar, applied server-side.
 *
 * The table holds every course the crawler has seen — around eight thousand — so
 * that thresholds can be tuned without re-crawling. That only works if the read
 * filters, hence these. They match the values the offline generator used.
 */
export const MIN_RATING = 4.3;
export const MIN_REVIEWS = 50;

/**
 * Ceiling on rows fetched per role. A role asks for at most six subjects and shows
 * at most four external courses, so this is generous headroom, not a real limit.
 */
const ROW_LIMIT = 120;

/**
 * Language the platform teaches in. Courses taught in anything else are filtered out
 * server-side — a well-reviewed Spanish Python course is a bad recommendation here
 * however good the course is.
 */
export const PLATFORM_LANGUAGE = 'en';

const COLUMNS =
  'slug, url, title, partner, format, level, rating, reviews, subjects, primary_subjects, skills, description, languages, is_featured';

interface CourseraCourseRow {
  slug: string;
  url: string;
  title: string;
  partner: string;
  format: string;
  level: string;
  rating: number | null;
  reviews: number | null;
  subjects: string[] | null;
  primary_subjects: string[] | null;
  skills: string[] | null;
  description: string | null;
  languages: string[] | null;
  is_featured: boolean | null;
}

function toCourse(row: CourseraCourseRow): CourseraCourse {
  return {
    slug: row.slug,
    url: row.url,
    title: row.title,
    partner: row.partner,
    format: row.format as CourseraCourse['format'],
    level: row.level as CourseraCourse['level'],
    rating: row.rating ?? 0,
    reviews: row.reviews ?? 0,
    subjects: (row.subjects ?? []) as LearningSubject[],
    primarySubjects: (row.primary_subjects ?? []) as LearningSubject[],
    skills: row.skills ?? [],
    description: row.description ?? '',
    languages: row.languages ?? [],
    isFeatured: row.is_featured ?? false,
  };
}

export interface UseCourseraCatalogResult {
  /**
   * Rows from the database, or undefined when there are none to show — because
   * the query is still running, failed, or came back empty. `error` and `isEmpty`
   * say WHICH, and the UI is expected to render them differently.
   */
  catalog: CourseraCourse[] | undefined;
  loading: boolean;
  /**
   * The read failed. Previously this was folded together with "no rows" into a
   * single `usedFallback` flag that no component ever read, and the bundled
   * catalog rendered either way — so an outage and a healthy result looked
   * identical on screen.
   */
  error: Error | null;
  /** The read SUCCEEDED and returned nothing. A real answer, not a failure. */
  isEmpty: boolean;
  /**
   * Re-run the query. Plumbed through because an error state the user cannot act
   * on is only half the fix — a review finding on the CareerPathway work earlier
   * in this program, which shipped an honest failure message next to a dead UI.
   */
  retry: () => void;
}

/**
 * Coursera courses covering any of `subjects`.
 *
 * Fetches per role rather than pulling the whole catalog: the table is large, and a
 * role only ever needs candidates for the handful of subjects it lists.
 */
export function useCourseraCatalog(subjects: LearningSubject[]): UseCourseraCatalogResult {
  // Sorted so two roles with the same subjects in a different order share a cache
  // entry rather than issuing two identical queries.
  const key = [...subjects].sort();

  const { data, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['coursera-catalog', key],
    enabled: key.length > 0,
    // Upstream refreshes monthly, so anything short of hours is churn.
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('coursera_courses')
        .select(COLUMNS)
        .eq('status', 'active')
        .overlaps('subjects', key)
        .gte('rating', MIN_RATING)
        .gte('reviews', MIN_REVIEWS)
        // English, or not yet known. Empty is unknown rather than non-English: rows
        // crawled before language capture have none, and excluding them would empty
        // the catalog until the backfill completes.
        .or(`languages.cs.{${PLATFORM_LANGUAGE}},languages.eq.{}`)
        .order('rating', { ascending: false })
        .limit(ROW_LIMIT);

      if (error) {
        // Still a warn, not an error: the consumers now render an explicit
        // "couldn't load — retry" state, so this is a reported condition rather
        // than an unhandled one, and the e2e console fixture should not redden a
        // suite for a failure the UI is already showing honestly.
        logger.warn('Coursera catalog read failed:', error);
        throw error;
      }

      return ((rows ?? []) as CourseraCourseRow[]).map(toCourse);
    },
  });

  // An empty result is now reported AS empty rather than swapped for the bundle.
  // "The table has no rows for these subjects" and "the read failed" are different
  // facts and lead to different UI: one is an honest gap, the other is an outage
  // with a retry. Collapsing them was the whole defect.
  const rows = !isError && data && data.length > 0 ? data : undefined;

  return {
    catalog: rows,
    loading: isLoading,
    error: isError ? ((queryError as Error) ?? new Error('Coursera catalog read failed')) : null,
    isEmpty: !isLoading && !isError && (data?.length ?? 0) === 0,
    retry: () => { void refetch(); },
  };
}
