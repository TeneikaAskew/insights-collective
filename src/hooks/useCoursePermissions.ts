
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useCoursePermissions(courseId?: string) {
  const { user } = useAuth();
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInstructor, setIsInstructor] = useState(false);
  
  useEffect(() => {
    if (!user || !courseId) {
      setCanEdit(false);
      setLoading(false);
      return;
    }
    
    const checkPermissions = async () => {
      setLoading(true);
      
      try {
        // Check if user is admin
        const isUserAdmin = user.roles?.includes('admin') || false;
        setIsAdmin(isUserAdmin);
        
        if (isUserAdmin) {
          setCanEdit(true);
          setLoading(false);
          return;
        }
        
        // Check if user is the course instructor
        const { data: course, error: courseError } = await supabase
          .from('courses')
          .select('instructor_id')
          .eq('id', courseId)
          .single();
        
        if (courseError) throw courseError;
        
        if (course.instructor_id === user.id) {
          setCanEdit(true);
          setIsInstructor(true);
          setLoading(false);
          return;
        }
        
        // Check if user has an assignment to the course
        const { data: assignments, error: assignmentsError } = await supabase
          .from('course_assignments')
          .select('role')
          .eq('course_id', courseId)
          .eq('user_id', user.id);
        
        if (assignmentsError) throw assignmentsError;
        
        const hasAssignment = assignments && assignments.length > 0;
        setIsInstructor(hasAssignment);
        setCanEdit(hasAssignment);
      } catch (error) {
        console.error('Error checking course permissions:', error);
        setCanEdit(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkPermissions();
  }, [user, courseId]);
  
  return { canEdit, loading, isAdmin, isInstructor };
}
