
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CourseEnrollment, CourseStats } from '@/types/course';

export function useCourseEnrollments(courseId?: string) {
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchEnrollments = async () => {
    if (!courseId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching enrollments for course:', courseId);

      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          profiles:user_id(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });

      if (error) {
        console.error('Error fetching enrollments:', error);
        throw error;
      }

      console.log('Raw enrollment data:', data);

      const transformedEnrollments: CourseEnrollment[] = (data || []).map(enrollment => ({
        id: enrollment.id,
        user_id: enrollment.user_id,
        course_id: enrollment.course_id,
        enrolled_at: enrollment.enrolled_at,
        completion_status: enrollment.completion_status || 0,
        user: enrollment.profiles ? {
          id: enrollment.profiles.id,
          first_name: enrollment.profiles.first_name || '',
          last_name: enrollment.profiles.last_name || '',
          avatar_url: enrollment.profiles.avatar_url,
        } : undefined,
      }));

      console.log('Transformed enrollments:', transformedEnrollments);
      setEnrollments(transformedEnrollments);

      // Fetch course statistics
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_course_stats', { course_id_param: courseId });

      if (statsError) {
        console.error('Error fetching course stats:', statsError);
      } else if (statsData && statsData.length > 0) {
        setStats({
          enrollment_count: Number(statsData[0].enrollment_count) || 0,
          completion_rate: Number(statsData[0].completion_rate) || 0,
        });
        console.log('Course stats:', statsData[0]);
      } else {
        // Fallback stats calculation
        setStats({
          enrollment_count: transformedEnrollments.length,
          completion_rate: transformedEnrollments.length > 0 
            ? transformedEnrollments.reduce((acc, e) => acc + (e.completion_status || 0), 0) / transformedEnrollments.length 
            : 0,
        });
      }

    } catch (err: any) {
      console.error('Error fetching enrollments:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: 'Failed to fetch course enrollments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [courseId]);

  return {
    enrollments,
    stats,
    loading,
    error,
    refetch: fetchEnrollments,
  };
}
