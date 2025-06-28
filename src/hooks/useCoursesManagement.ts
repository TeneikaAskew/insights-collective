import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Course, CourseFormData, CourseEnrollment, CourseStats } from '@/types/course';

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
      console.log('Fetching courses...');
      
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
        console.error('Error fetching courses:', coursesError);
        throw coursesError;
      }

      console.log('Raw courses data:', coursesData);

      // Fetch enrollment counts for all courses
      const courseIds = coursesData?.map(course => course.id) || [];
      let enrollmentCounts: Record<string, number> = {};
      
      if (courseIds.length > 0) {
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('course_id')
          .in('course_id', courseIds);

        if (!enrollmentError && enrollmentData) {
          // Count enrollments per course
          enrollmentCounts = enrollmentData.reduce((acc, enrollment) => {
            acc[enrollment.course_id] = (acc[enrollment.course_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // Transform data to match frontend interface
      const transformedCourses: Course[] = (coursesData || []).map(course => ({
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

      console.log('Transformed courses with enrollment counts:', transformedCourses);
      setCourses(transformedCourses);
    } catch (err: any) {
      console.error('Error fetching courses:', err);
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
      console.log('Saving course data:', courseData);
      
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

      console.log('Database course data:', dbCourseData);

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
          .update(dbCourseData)
          .eq('id', courseId)
          .select()
          .single();

        if (error) {
          console.error('Error updating course:', error);
          throw error;
        }
        result = data;
        
        // Log the update action
        if (user) {
          await supabase.rpc('log_audit_event', {
            p_user_id: user.id,
            p_action: 'course_updated',
            p_table_name: 'courses',
            p_record_id: courseId,
            p_old_values: oldData,
            p_new_values: result
          });
        }
        
        console.log('Course updated successfully:', result);
      } else {
        // Create new course
        const { data, error } = await supabase
          .from('courses')
          .insert(dbCourseData)
          .select()
          .single();

        if (error) {
          console.error('Error creating course:', error);
          throw error;
        }
        result = data;
        
        // Log the creation action
        if (user) {
          await supabase.rpc('log_audit_event', {
            p_user_id: user.id,
            p_action: 'course_created',
            p_table_name: 'courses',
            p_record_id: result.id,
            p_new_values: result
          });
        }
        
        console.log('Course created successfully:', result);
      }

      // Refresh courses list
      await fetchCourses();

      toast({
        title: 'Success',
        description: courseId ? 'Course updated successfully' : 'Course created successfully',
      });

      return result;
    } catch (err: any) {
      console.error('Error saving course:', err);
      
      // Log security event for failed operations
      if (user) {
        await supabase.rpc('log_security_event', {
          p_user_id: user.id,
          p_event_type: 'course_save_failed',
          p_severity: 'error',
          p_description: `Failed to ${courseId ? 'update' : 'create'} course`,
          p_metadata: {
            course_id: courseId,
            error: err.message
          }
        });
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

      // Log the deletion action
      if (user) {
        await supabase.rpc('log_audit_event', {
          p_user_id: user.id,
          p_action: 'course_deleted',
          p_table_name: 'courses',
          p_record_id: courseId
        });
      }

      // Refresh courses list
      await fetchCourses();

      toast({
        title: 'Success',
        description: 'Course deleted successfully',
      });

      return true;
    } catch (err: any) {
      console.error('Error deleting course:', err);
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

      // Log the publish action
      if (user) {
        await supabase.rpc('log_audit_event', {
          p_user_id: user.id,
          p_action: 'course_published',
          p_table_name: 'courses',
          p_record_id: courseId
        });
      }

      await fetchCourses();
      
      toast({
        title: 'Success',
        description: 'Course published successfully',
      });

      return true;
    } catch (err: any) {
      console.error('Error publishing course:', err);
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

      // Log the unpublish action
      if (user) {
        await supabase.rpc('log_audit_event', {
          p_user_id: user.id,
          p_action: 'course_unpublished',
          p_table_name: 'courses',
          p_record_id: courseId
        });
      }

      await fetchCourses();
      
      toast({
        title: 'Success',
        description: 'Course unpublished successfully',
      });

      return true;
    } catch (err: any) {
      console.error('Error unpublishing course:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to unpublish course',
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

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
