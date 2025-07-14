import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Course } from '@/types/course';
import { useAuth } from '@/contexts/AuthContext';

export function useUserCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchUserCourses = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data: enrollments, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('user_id', user.id);

        if (enrollmentError) {
          throw enrollmentError;
        }

        const courseIds = enrollments.map((e) => e.course_id);

        if (courseIds.length === 0) {
          setCourses([]);
          setLoading(false);
          return;
        }

        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select(`
            *,
            instructor:profiles(
              id,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .in('id', courseIds);

        if (coursesError) {
          throw coursesError;
        }

        const formattedCourses = coursesData.map(course => ({
            ...course,
            instructor: {
              id: course.instructor?.id || course.instructor_id || '',
              name: course.instructor
                ? `${course.instructor?.first_name || ''} ${course.instructor?.last_name || ''}`.trim()
                : 'Instructor',
              email: '',
              role: 'instructor',
              avatar: course.instructor?.avatar_url || '',
            },
            enrollmentCount: 0,
            modules: [],
            rating: 4.5,
            createdAt: course.created_at,
            updatedAt: course.updated_at,
            thumbnail: course.image_url || course.thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
          }));

        setCourses(formattedCourses);
      } catch (err: any) {
        setError(err.message);
        toast({
          title: 'Error',
          description: 'Failed to fetch user courses',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserCourses();
  }, [user, toast]);

  return {
    courses,
    loading,
    error,
  };
}
