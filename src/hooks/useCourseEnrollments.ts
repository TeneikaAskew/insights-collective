
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CourseEnrollment, CourseStats } from '@/types/course';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useCourseEnrollments');

export function useCourseEnrollments(courseId?: string) {
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchEnrollments = async () => {
    if (!courseId) {
      setEnrollments([]);
      setStats(null);
      setLoading(false);
      return;
    }

    // Reset stale data from the previously selected course so the UI (and
    // downstream actions like the CSV export button) doesn't operate on it
    // while the new fetch is in flight.
    setEnrollments([]);
    setStats(null);
    setLoading(true);
    setError(null);


    try {
      logger.log('Fetching enrollments for course:', courseId);

      // First get enrollments
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('id, user_id, course_id, enrolled_at, completion_status')
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });

      if (enrollmentError) {
        logger.error('Error fetching enrollments:', enrollmentError);
        throw enrollmentError;
      }

      logger.log('Raw enrollment data:', enrollments);

      if (!enrollments || enrollments.length === 0) {
        logger.log('No enrollments found for course:', courseId);
        setEnrollments([]);
        setStats({
          enrollment_count: 0,
          completion_rate: 0,
        });
        setLoading(false);
        return;
      }

      // Get profiles for enrolled users
      const userIds = enrollments.map(e => e.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);
      
      if (profileError) {
        // Do NOT swallow this — enrollments would render with missing user
        // names as if that were normal. Throwing routes it through the hook's
        // existing error path (error state + destructive toast).
        logger.error('Error fetching profiles:', profileError);
        throw profileError;
      }

      logger.log('Profile data:', profiles);

      const transformedEnrollments: CourseEnrollment[] = enrollments.map(enrollment => {
        const profile = profiles?.find(p => p.id === enrollment.user_id);
        return {
          id: enrollment.id,
          user_id: enrollment.user_id,
          course_id: enrollment.course_id,
          enrolled_at: enrollment.enrolled_at,
          completion_status: enrollment.completion_status || 0,
          user: profile ? {
            id: profile.id,
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            avatar_url: profile.avatar_url,
          } : undefined,
        };
      });

      logger.log('Transformed enrollments:', transformedEnrollments);
      setEnrollments(transformedEnrollments);

      // Fetch course statistics
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_course_stats', { course_id_param: courseId });

      // Client-side stats derived from the enrollment rows that DID load
      // successfully above. Used both when the RPC returns no rows and as a
      // degraded-but-honest fallback when the RPC errors.
      const computeFallbackStats = (): CourseStats => ({
        enrollment_count: transformedEnrollments.length,
        completion_rate: transformedEnrollments.length > 0
          ? transformedEnrollments.reduce((acc, e) => acc + (e.completion_status || 0), 0) / transformedEnrollments.length
          : 0,
      });

      if (statsError) {
        // Non-fatal degradation: the stats RPC failed, but the enrollment data
        // is genuinely loaded, so recompute stats client-side from it instead
        // of leaving stats empty. The hook has no warning channel in its return
        // shape, so the RPC failure is surfaced via the logger only — it must
        // never be silently indistinguishable from a successful RPC path.
        logger.error('Error fetching course stats — falling back to client-side stats:', statsError);
        setStats(computeFallbackStats());
      } else if (statsData && statsData.length > 0) {
        setStats({
          enrollment_count: Number(statsData[0].enrollment_count) || 0,
          completion_rate: Number(statsData[0].completion_rate) || 0,
        });
        logger.log('Course stats:', statsData[0]);
      } else {
        // RPC succeeded but returned no rows — fall back to client-side stats
        setStats(computeFallbackStats());
      }

    } catch (err: any) {
      logger.error('Error fetching enrollments:', err);
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
