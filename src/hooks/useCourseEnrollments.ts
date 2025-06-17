
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
      // Fetch enrollments with user profiles
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select(`
          *,
          user:profiles!enrollments_user_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });

      if (enrollmentError) throw enrollmentError;

      // Also fetch user emails from auth.users via profiles
      const { data: profilesWithAuth, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          avatar_url
        `)
        .in('id', (enrollmentData || []).map(e => e.user_id));

      if (profilesError) {
        console.warn('Could not fetch additional profile data:', profilesError);
      }

      const transformedEnrollments: CourseEnrollment[] = (enrollmentData || []).map(enrollment => ({
        ...enrollment,
        user: enrollment.user ? {
          id: enrollment.user.id,
          first_name: enrollment.user.first_name || '',
          last_name: enrollment.user.last_name || '',
          avatar_url: enrollment.user.avatar_url,
          // Note: email is not available from profiles table for security reasons
          email: undefined,
        } : undefined,
      }));

      setEnrollments(transformedEnrollments);

      // Calculate basic stats from the data we have
      const enrollmentCount = transformedEnrollments.length;
      const completionRate = enrollmentCount > 0 
        ? Math.round(transformedEnrollments.reduce((sum, e) => sum + (e.completion_status || 0), 0) / enrollmentCount)
        : 0;

      setStats({
        enrollment_count: enrollmentCount,
        completion_rate: completionRate,
      });

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
