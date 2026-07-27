// ABOUTME: Lightweight read of published courses for public-facing surfaces
// ABOUTME: (site search today). Deliberately does NOT fetch enrollment counts
// ABOUTME: or the viewer's roles — see the note below for why that matters.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('usePublishedCourses');

export interface PublishedCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  image_url: string | null;
  thumbnail: string | null;
}

/**
 * Published courses, readable by anyone.
 *
 * This exists because `SiteSearch` — which the Navbar renders on EVERY page —
 * was calling `useCoursesManagement`, the admin course-management hook. That
 * hook is the wrong tool for a search box in three separate ways:
 *
 *  1. It fires three queries per page load: all courses, a cross-course scan of
 *     `enrollments`, and the viewer's `user_roles`. Two of those are pure waste
 *     for a text filter over titles.
 *  2. It then filters the result to `isAdmin ? all : own instructed courses`, so
 *     for an ordinary member `courses` comes back EMPTY — the search box could
 *     never return a course result anyway.
 *  3. The `enrollments` scan is a query members have no business making, and it
 *     logged a `permission denied for table enrollments` console error on any
 *     page load where the request went out before the session attached. That
 *     surfaced as six unrelated interview-prep E2E failures, all of which assert
 *     on console cleanliness rather than on anything the page did wrong.
 *
 * A published-courses read is what the search box actually wanted: it works for
 * anonymous and authenticated visitors alike, needs no role lookup, and touches
 * one table.
 */
export function usePublishedCourses() {
  const [courses, setCourses] = useState<PublishedCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, description, category, image_url, thumbnail')
        .eq('published', true)
        .order('created_at', { ascending: false });

      if (!alive) return;

      if (error) {
        // Search degrading to "no course results" is not worth a toast or a
        // console error on every page — but it must not be silent either.
        logger.warn('Failed to load published courses for search:', error);
        setCourses([]);
        setLoading(false);
        return;
      }

      setCourses((data ?? []) as PublishedCourse[]);
      setLoading(false);
    };

    void load();
    return () => {
      alive = false;
    };
  }, []);

  return { courses, loading };
}
