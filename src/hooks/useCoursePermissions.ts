
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isValidUUID } from '@/utils/idUtils';

export function useCoursePermissions(courseId?: string) {
  const { user } = useAuth();
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInstructor, setIsInstructor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!user || !courseId) {
      setCanEdit(false);
      setLoading(false);
      return;
    }
    
    // Validate UUID format
    if (!isValidUUID(courseId)) {
      console.error(`Invalid course UUID format: ${courseId}`);
      setError('Invalid course ID format');
      setCanEdit(false);
      setLoading(false);
      return;
    }
    
    const checkPermissions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Check if user is admin
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('roles')
          .eq('id', user.id)
          .single();
        
        if (profileError) throw profileError;
        
        const isUserAdmin = profile?.roles?.includes('admin');
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
          .maybeSingle();
        
        if (courseError) {
          console.error('Error fetching course:', courseError);
          // Don't throw, try to continue checking assignments
        }
        
        if (course?.instructor_id === user.id) {
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
      } catch (error: any) {
        console.error('Error checking course permissions:', error);
        setError(error.message || 'Error checking course permissions');
        setCanEdit(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkPermissions();
  }, [user, courseId]);
  
  return { canEdit, loading, isAdmin, isInstructor, error };
}
