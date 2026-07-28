// ABOUTME: Lightweight read of published courses for public-facing surfaces
// ABOUTME: (site search and the landing page's Featured Courses). Deliberately
// ABOUTME: does NOT fetch enrollment counts or the viewer's roles — see below.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('usePublishedCourses');

export interface PublishedCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string | null;
  image_url: string | null;
  thumbnail: string | null;
  estimated_hours: number | null;
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
 *
 * The landing page's Featured Courses section wanted the same thing, for a
 * sharper reason: `Index` redirects every authenticated user to `/dashboard`,
 * so the landing page is only ever rendered for signed-out visitors — and
 * `useCoursesManagement` returns early with an empty list and a CRITICAL log
 * line when there is no user. That section rendered for nobody.
 */
export function usePublishedCourses() {
  const [courses, setCourses] = useState<PublishedCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, description, category, level, image_url, thumbnail, estimated_hours')
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
