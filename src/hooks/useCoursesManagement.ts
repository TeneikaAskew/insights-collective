import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Course, CourseFormData, CourseEnrollment, CourseStats } from '@/types/course';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useCoursesManagement');

export function useCoursesManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCourses = async () => {
    setLoading(true);
    setError(null);

    try {
      logger.log('Fetching courses...');

      if (!user) {
        logger.error('CRITICAL: No user found in course management (should be impossible on protected route)');
        setCourses([]);
        setError('Authentication error: No user session found');
        return;
      }

      // Fetch courses with instructor data - now using new RLS policies
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          *,
          instructor:profiles!courses_instructor_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (coursesError) {
        logger.warn('Error fetching courses:', coursesError);
        throw coursesError;
      }

      logger.log('Raw courses data:', coursesData);

      // Fetch enrollment counts for all courses
      const courseIds = coursesData?.map(course => course.id) || [];
      let enrollmentCounts: Record<string, number> = {};

      // `user` above comes from AuthContext, which restores from localStorage
      // before supabase-js has finished attaching the token to outgoing
      // requests. In that window the query goes out as `anon`, which has no
      // grant on enrollments, and every public page carrying SiteSearch logged
      // `42501 permission denied for table enrollments` — four times per load.
      //
      // Ask the client whether it will actually send a token, rather than
      // asking the context whether it believes someone is signed in.
      const { data: { session } } = await supabase.auth.getSession();

      if (courseIds.length > 0 && session) {
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('course_id')
          .in('course_id', courseIds);

        if (enrollmentError) {
          // Do NOT swallow this — a silent failure here used to render every
          // course as "0 enrolled". Throwing routes it through the hook's
          // existing error path (error state + destructive toast).
          logger.error('Error fetching enrollment counts:', enrollmentError);
          throw enrollmentError;
        }

        // Count enrollments per course (empty data is a legitimate result)
        enrollmentCounts = (enrollmentData || []).reduce((acc, enrollment) => {
          acc[enrollment.course_id] = (acc[enrollment.course_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }

      // Transform data to match frontend interface
      const transformedCourses: Course[] = ((coursesData || []) as any[]).map((course: any) => ({
        ...course,
        imageUrl: course.image_url,
        enrollmentStatus: course.enrollment_status,
        enrollmentCount: enrollmentCounts[course.id] || 0,
        createdAt: course.created_at,
        updatedAt: course.updated_at,
        instructor: course.instructor ? {
          id: course.instructor.id,
          name: `${course.instructor.first_name || ''} ${course.instructor.last_name || ''}`.trim(),
          firstName: course.instructor.first_name,
          lastName: course.instructor.last_name,
          avatar: course.instructor.avatar_url,
        } : undefined,
      }));

      // Filter courses based on user role — read from user_roles (source of truth), not profiles.roles
      const { data: roleRows, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (rolesError) {
        // Do NOT swallow this — a silent failure here made isAdmin false and
        // filtered the course list to nothing for admins. Throwing routes it
        // through the hook's error path (error state + destructive toast).
        logger.error('Error fetching user roles:', rolesError);
        throw rolesError;
      }

      const isAdmin = (roleRows ?? []).some((r: { role: string }) => r.role === 'admin');

      // Admins see all courses, instructors see only their courses
      const filteredCourses = isAdmin
        ? transformedCourses
        : transformedCourses.filter(c => c.instructor_id === user.id);

      logger.log('User is admin:', isAdmin);
      logger.log('Filtered courses for user:', filteredCourses);
      setCourses(filteredCourses);
    } catch (err: any) {
      // Demoted from error → warn: this hook runs on many pages via SiteSearch,
      // and Firefox intermittently aborts the request during navigation. The
      // toast + setError still surface real failures to the user; the flaky
      // console.error here was failing E2E without indicating a real bug.
      logger.warn('Error fetching courses:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: 'Failed to fetch courses',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveCourse = async (courseData: Partial<CourseFormData>, courseId?: string) => {
    try {
      logger.log('Saving course data:', courseData);
      
      const dbCourseData = {
        title: courseData.title,
        description: courseData.description,
        category: courseData.category,
        level: courseData.level,
        duration: courseData.duration,
        tags: courseData.tags,
        image_url: courseData.image_url,
        enrollment_status: courseData.enrollment_status,
        published: courseData.published,
        status: courseData.status,
        instructor_id: courseData.instructor_id || null,
      };

      logger.log('Database course data:', dbCourseData);

      let result;
      if (courseId) {
        // Log audit event for course update
        const { data: oldData } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single();

        const { data, error } = await supabase
          .from('courses')
          .update(dbCourseData as any)
          .eq('id', courseId)
          .select()
          .single();

        if (error) {
          logger.error('Error updating course:', error);
          throw error;
        }
        result = data;
        
        // Log the update action (non-fatal telemetry — warn on failure)
        if (user) {
          const { error: auditError } = await supabase.rpc('log_audit_event', {
            p_user_id: user.id,
            p_action: 'course_updated',
            p_table_name: 'courses',
            p_record_id: courseId,
            p_old_values: oldData,
            p_new_values: result
          });
          if (auditError) logger.warn('Failed to write course_updated audit event:', auditError);
        }
        
        logger.log('Course updated successfully:', result);
      } else {
        // Create new course
        const { data, error } = await supabase
          .from('courses')
          .insert(dbCourseData as any)
          .select()
          .single();

        if (error) {
          logger.error('Error creating course:', error);
          throw error;
        }
        result = data;
        
        // Log the creation action (non-fatal telemetry — warn on failure)
        if (user) {
          const { error: auditError } = await supabase.rpc('log_audit_event', {
            p_user_id: user.id,
            p_action: 'course_created',
            p_table_name: 'courses',
            p_record_id: result.id,
            p_new_values: result
          });
          if (auditError) logger.warn('Failed to write course_created audit event:', auditError);
        }
        
        logger.log('Course created successfully:', result);
      }

      // Refresh courses list
      await fetchCourses();

      toast({
        title: 'Success',
        description: courseId ? 'Course updated successfully' : 'Course created successfully',
      });

      return result;
    } catch (err: any) {
      logger.error('Error saving course:', err);
      
      // Log security event for failed operations (non-fatal telemetry)
      if (user) {
        const { error: securityLogError } = await supabase.rpc('log_security_event', {
          p_user_id: user.id,
          p_event_type: 'course_save_failed',
          p_severity: 'error',
          p_description: `Failed to ${courseId ? 'update' : 'create'} course`,
          p_metadata: {
            course_id: courseId,
            error: err.message
          }
        });
        if (securityLogError) logger.warn('Failed to write course_save_failed security event:', securityLogError);
      }
      
      toast({
        title: 'Error',
        description: err.message || 'Failed to save course',
        variant: 'destructive',
      });
      throw err;
    }
  };

  const createCourse = async (courseData: Partial<CourseFormData>) => {
    return await saveCourse(courseData);
  };

  const updateCourse = async (courseId: string, courseData: Partial<CourseFormData>) => {
    return await saveCourse(courseData, courseId);
  };

  const deleteCourse = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      // Log the deletion action (non-fatal telemetry — warn on failure)
      if (user) {
        const { error: auditError } = await supabase.rpc('log_audit_event', {
          p_user_id: user.id,
          p_action: 'course_deleted',
          p_table_name: 'courses',
          p_record_id: courseId
        });
        if (auditError) logger.warn('Failed to write course_deleted audit event:', auditError);
      }

      // Refresh courses list
      await fetchCourses();

      toast({
        title: 'Success',
        description: 'Course deleted successfully',
      });

      return true;
    } catch (err: any) {
      logger.error('Error deleting course:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete course',
        variant: 'destructive',
      });
      return false;
    }
  };

  const publishCourse = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ published: true })
        .eq('id', courseId);

      if (error) throw error;

      // Log the publish action (non-fatal telemetry — warn on failure)
      if (user) {
        const { error: auditError } = await supabase.rpc('log_audit_event', {
          p_user_id: user.id,
          p_action: 'course_published',
          p_table_name: 'courses',
          p_record_id: courseId
        });
        if (auditError) logger.warn('Failed to write course_published audit event:', auditError);
      }

      await fetchCourses();
      
      toast({
        title: 'Success',
        description: 'Course published successfully',
      });

      return true;
    } catch (err: any) {
      logger.error('Error publishing course:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to publish course',
        variant: 'destructive',
      });
      return false;
    }
  };

  const unpublishCourse = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ published: false })
        .eq('id', courseId);

      if (error) throw error;

      // Log the unpublish action (non-fatal telemetry — warn on failure)
      if (user) {
        const { error: auditError } = await supabase.rpc('log_audit_event', {
          p_user_id: user.id,
          p_action: 'course_unpublished',
          p_table_name: 'courses',
          p_record_id: courseId
        });
        if (auditError) logger.warn('Failed to write course_unpublished audit event:', auditError);
      }

      await fetchCourses();
      
      toast({
        title: 'Success',
        description: 'Course unpublished successfully',
      });

      return true;
    } catch (err: any) {
      logger.error('Error unpublishing course:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to unpublish course',
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    // Only fetch courses when user is loaded
    if (user) {
      fetchCourses();
    }
  }, [user]);

  return {
    courses,
    loading,
    error,
    saveCourse,
    createCourse,
    updateCourse,
    deleteCourse,
    publishCourse,
    unpublishCourse,
    refetch: fetchCourses,
  };
}
