
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

      if (error) throw error;

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

  const createCourse = async (courseData: CourseFormData): Promise<Course | null> => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .insert({
          ...courseData,
          instructor_id: user?.id,
          status: 'draft',
          published: false,
        })
        .select()
        .single();

      if (error) throw error;

      const newCourse: Course = {
        ...data,
        imageUrl: data.image_url,
        enrollmentStatus: data.enrollment_status,
        enrollmentCount: 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setCourses(prev => [newCourse, ...prev]);
      
      toast({
        title: 'Success',
        description: 'Course created successfully',
      });

      return newCourse;
    } catch (err: any) {
      console.error('Error creating course:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to create course',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateCourse = async (courseId: string, courseData: Partial<CourseFormData>): Promise<boolean> => {
    try {
      // Clean the data to only include database fields
      const cleanedData: Partial<CourseFormData> = {
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
        instructor_id: courseData.instructor_id,
      };

      // Remove undefined values
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key as keyof CourseFormData] === undefined) {
          delete cleanedData[key as keyof CourseFormData];
        }
      });

      const { data, error } = await supabase
        .from('courses')
        .update(cleanedData)
        .eq('id', courseId)
        .select()
        .single();

      if (error) throw error;

      const updatedCourse: Course = {
        ...data,
        imageUrl: data.image_url,
        enrollmentStatus: data.enrollment_status,
        enrollmentCount: data.enrollment_count || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setCourses(prev => prev.map(course => 
        course.id === courseId ? updatedCourse : course
      ));

      toast({
        title: 'Success',
        description: 'Course updated successfully',
      });

      return true;
    } catch (err: any) {
      console.error('Error updating course:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to update course',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteCourse = async (courseId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      setCourses(prev => prev.filter(course => course.id !== courseId));

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

  const publishCourse = async (courseId: string): Promise<boolean> => {
    return updateCourse(courseId, { published: true, status: 'published' });
  };

  const unpublishCourse = async (courseId: string): Promise<boolean> => {
    return updateCourse(courseId, { published: false, status: 'draft' });
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  return {
    courses,
    loading,
    error,
    createCourse,
    updateCourse,
    deleteCourse,
    publishCourse,
    unpublishCourse,
    refetch: fetchCourses,
  };
}
