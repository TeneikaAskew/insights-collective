
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
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          user:profiles(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });

      if (error) throw error;

      const transformedEnrollments: CourseEnrollment[] = (data || []).map(enrollment => ({
        ...enrollment,
        user: enrollment.user ? {
          id: enrollment.user.id,
          first_name: enrollment.user.first_name || '',
          last_name: enrollment.user.last_name || '',
          avatar_url: enrollment.user.avatar_url,
        } : undefined,
      }));

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
