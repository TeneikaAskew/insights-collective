// ABOUTME: React Query hook for the publicly visible course catalog.
// ABOUTME: Single source of truth for the anonymous `courses` read used by the landing page and /courses.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Course } from '@/types';
import { createLogger } from '@/utils/logger';

const logger = createLogger('usePublicCourses');

const FALLBACK_THUMBNAIL =
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=70';

/**
 * Shapes a raw `courses` row into the `Course` the UI expects.
 * Extracted verbatim from CourseList so both callers format identically.
 */
function formatCourse(c: any): Course {
  return {
    ...c,
    instructor: {
      id: c.instructor?.id || '',
      name: c.instructor
        ? `${c.instructor?.first_name || ''} ${c.instructor?.last_name || ''}`.trim() || 'Instructor'
        : 'Instructor',
      email: '',
      role: 'instructor',
      avatar: c.instructor?.avatar_url || '',
    },
    enrollmentCount: 0,
    modules: [],
    // No `rating` column exists. CourseList used to hardcode 4.5 here, which the
    // landing page then rendered as a "Top Rated 4.5" badge on every single card.
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    thumbnail: c.image_url || c.thumbnail || FALLBACK_THUMBNAIL,
  } as Course;
}

export async function fetchPublicCourses(limit?: number): Promise<Course[]> {
  let query = supabase
    .from('courses')
    .select('*, instructor:profiles(id, first_name, last_name, avatar_url)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (typeof limit === 'number') {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('Error fetching public courses:', error);
    throw error;
  }
  return (data || []).map(formatCourse);
}

/**
 * Published courses, readable without a session.
 *
 * The landing page previously used `useCoursesManagement`, which only fetches
 * for a signed-in user and filters to courses they own — so on a page that
 * redirects signed-in users away it always returned an empty array.
 */
export function usePublicCourses(limit?: number) {
  return useQuery({
    queryKey: ['courses', 'public', limit ?? 'all'],
    queryFn: () => fetchPublicCourses(limit),
    staleTime: 5 * 60 * 1000,
  });
}

export default usePublicCourses;
