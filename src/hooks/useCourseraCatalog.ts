// ABOUTME: Reads the Coursera fallback catalog from Postgres for a given set of
// ABOUTME: subjects, falling back to the copy bundled with the app when the query
// ABOUTME: fails or the table has not been migrated yet. The bundled copy is the
// ABOUTME: same data the seed migration was generated from, so the fallback is a
// ABOUTME: slightly staler catalog rather than an empty section.

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
  'slug, url, title, partner, format, level, rating, reviews, subjects, primary_subjects, skills, description, languages';

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
  };
}

export interface UseCourseraCatalogResult {
  /**
   * Rows from the database, or undefined when unavailable — the resolver treats
   * undefined as "use the bundled catalog", so callers pass this straight through.
   */
  catalog: CourseraCourse[] | undefined;
  loading: boolean;
  /** True when the database copy could not be used and the bundle is in play. */
  usedFallback: boolean;
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

  const { data, isLoading, isError } = useQuery({
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
        // Expected before the migration is applied. A warn rather than an error
        // because the page still works — it just uses the bundled catalog.
        logger.warn('Coursera catalog read failed; using the bundled catalog:', error);
        throw error;
      }

      return ((rows ?? []) as CourseraCourseRow[]).map(toCourse);
    },
  });

  // An empty result is also a fallback case: it means the table exists but has no
  // rows for these subjects (un-seeded, or mid-first-crawl). Showing nothing would
  // be worse than showing the bundled list.
  const usable = !isError && data && data.length > 0 ? data : undefined;

  return {
    catalog: usable,
    loading: isLoading,
    usedFallback: !usable,
  };
}
