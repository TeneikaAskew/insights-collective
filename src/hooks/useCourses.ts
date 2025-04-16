
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { Course } from '@/types';

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          instructor:profiles(first_name, last_name, id, avatar_url)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setCourses(data || []);
    } catch (error: any) {
      console.error('Error fetching courses:', error);
      setError(error.message || 'Failed to load courses');
      toast({
        title: 'Error',
        description: 'Could not load courses. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createCourse = async (courseData: Partial<Course>) => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .insert(courseData)
        .select()
        .single();
      
      if (error) throw error;
      
      setCourses(prev => [data, ...prev]);
      
      toast({
        title: 'Course Created',
        description: 'The course has been successfully created.',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error creating course:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create course',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateCourse = async (courseId: string, courseData: Partial<Course>) => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .update(courseData)
        .eq('id', courseId)
        .select()
        .single();
      
      if (error) throw error;
      
      setCourses(prev => prev.map(course => 
        course.id === courseId ? { ...course, ...data } : course
      ));
      
      toast({
        title: 'Course Updated',
        description: 'The course has been successfully updated.',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error updating course:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update course',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteCourse = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);
      
      if (error) throw error;
      
      setCourses(prev => prev.filter(course => course.id !== courseId));
      
      toast({
        title: 'Course Deleted',
        description: 'The course has been successfully deleted.',
      });
      
      return true;
    } catch (error: any) {
      console.error('Error deleting course:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete course',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Fetch courses when component mounts
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return {
    courses,
    loading,
    error,
    fetchCourses,
    createCourse,
    updateCourse,
    deleteCourse
  };
}
