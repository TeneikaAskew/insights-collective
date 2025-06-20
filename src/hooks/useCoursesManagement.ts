
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
      
      const { data, error } = await supabase
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

      if (error) {
        console.error('Error fetching courses:', error);
        throw error;
      }

      console.log('Raw courses data:', data);

      // Transform data to match frontend interface
      const transformedCourses: Course[] = (data || []).map(course => ({
        ...course,
        imageUrl: course.image_url,
        enrollmentStatus: course.enrollment_status,
        enrollmentCount: course.enrollment_count || 0,
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

      console.log('Transformed courses:', transformedCourses);
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
        // Update existing course
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
      toast({
        title: 'Error',
        description: err.message || 'Failed to save course',
        variant: 'destructive',
      });
      throw err;
    }
  };

  const deleteCourse = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      // Refresh courses list
      await fetchCourses();

      toast({
        title: 'Success',
        description: 'Course deleted successfully',
      });
    } catch (err: any) {
      console.error('Error deleting course:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete course',
        variant: 'destructive',
      });
      throw err;
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
    deleteCourse,
    refetch: fetchCourses,
  };
}
