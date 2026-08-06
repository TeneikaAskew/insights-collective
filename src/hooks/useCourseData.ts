
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Course } from '@/types';
import { createLogger } from '@/utils/logger';
import { isValidUUID } from '@/utils/idUtils';

const logger = createLogger('useCourseData');

export function useCourseData(courseId?: string) {
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // If no courseId or it's 'new', we're creating a new course
    if (!courseId || courseId === 'new') {
      setIsLoading(false);
      return;
    }

    // `id` is a uuid column, so a route param that is not one is rejected by
    // Postgres with 22P02 before RLS or the row is ever considered — never a
    // real query, and it renders as an error the user cannot act on. Every
    // caller here takes `courseId` straight from `useParams`, so a mistyped or
    // stale URL reaches this directly: CourseSidebar (via CourseLayout),
    // CourseRubrics, CourseQuestionBanks and ProfileMenu.
    //
    // CourseDetail already guards its own fetch this way; this hook did not,
    // which left /courses/<not-a-uuid> issuing a 22P02 anyway from the sidebar.
    if (!isValidUUID(courseId)) {
      logger.error(`Invalid course UUID format: ${courseId}`);
      setError('Invalid course ID format');
      setCourse(null);
      setIsLoading(false);
      return;
    }

    async function fetchCourse() {
      setIsLoading(true);
      setError(null);
      
      try {
        logger.log('Fetching course data for ID:', courseId);
        
        // Fetch course details with instructor information
        const { data, error: courseError } = await supabase
          .from('courses')
          .select(`
            *,
            instructor:profiles!instructor_id(id, first_name, last_name, avatar_url)
          `)
          .eq('id', courseId)
          .single();
        
        if (courseError) {
          logger.error('Course fetch error:', courseError);
          throw courseError;
        }

        if (!data) {
          throw new Error('Course not found');
        }

        logger.log('Raw course data from database:', data);

        // Transform database fields to frontend model
        const transformedCourse: Course = {
          id: data.id,
          title: data.title,
          description: data.description || '',
          category: data.category || '',
          level: data.level || '',
          thumbnail: data.thumbnail || data.image_url || '',
          imageUrl: data.image_url || '',
          enrollmentStatus: data.enrollment_status || 'open',
          duration: String(data.duration ?? ''),
          tags: data.tags || [],
          published: data.published || false,
          status: (data.status || 'draft') as Course['status'],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          instructor_id: data.instructor_id,
          instructor: data.instructor ? {
            id: data.instructor.id,
            name: `${data.instructor.first_name || ''} ${data.instructor.last_name || ''}`.trim(),
            firstName: data.instructor.first_name,
            lastName: data.instructor.last_name,
            avatar: data.instructor.avatar_url,
          } : undefined,
        };

        logger.log('Transformed course data:', transformedCourse);

        // Fetch enrollment count. Select an explicit non-secret column rather
        // than '*': table SELECT on enrollments is column-scoped (the
        // calendar_feed_token column is withheld), so a '*' expansion would hit
        // the ungranted column.
        const { count, error: countError } = await supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', courseId);

        if (countError) {
          logger.error('Enrollment count fetch error:', countError);
          throw countError;
        }

        transformedCourse.enrollmentCount = count || 0;

        // Set the course data
        setCourse(transformedCourse);
      } catch (err: any) {
        logger.error('Error fetching course:', err);
        setError(err.message || 'Failed to load course details');
        toast({
          title: 'Error',
          description: 'There was a problem loading the course',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchCourse();
  }, [courseId, toast]);

  return { course, isLoading, error };
}
