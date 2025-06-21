
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
        // Use the new security definer functions for consistent role checking
        const { data: hasAdminAccess, error: adminError } = await supabase
          .rpc('has_admin_access', { user_id_param: user.id });
        
        if (adminError) {
          console.error('Error checking admin access:', adminError);
          throw adminError;
        }
        
        const { data: isCourseInstructor, error: instructorError } = await supabase
          .rpc('is_course_instructor', { 
            user_id_param: user.id, 
            course_id_param: courseId 
          });
        
        if (instructorError) {
          console.error('Error checking instructor access:', instructorError);
          throw instructorError;
        }
        
        setIsAdmin(hasAdminAccess || false);
        setIsInstructor(isCourseInstructor || false);
        setCanEdit(hasAdminAccess || isCourseInstructor || false);
        
        // Log security event for tracking
        if (hasAdminAccess || isCourseInstructor) {
          await supabase.rpc('log_security_event', {
            p_user_id: user.id,
            p_event_type: 'course_access_granted',
            p_severity: 'info',
            p_description: `User accessed course management for course ${courseId}`,
            p_metadata: {
              course_id: courseId,
              access_type: hasAdminAccess ? 'admin' : 'instructor'
            }
          });
        }
        
      } catch (error: any) {
        console.error('Error checking course permissions:', error);
        setError(error.message || 'Error checking course permissions');
        setCanEdit(false);
        
        // Log security event for failed access attempts
        await supabase.rpc('log_security_event', {
          p_user_id: user.id,
          p_event_type: 'course_access_denied',
          p_severity: 'warning',
          p_description: `Failed to check course permissions for course ${courseId}`,
          p_metadata: {
            course_id: courseId,
            error: error.message
          }
        });
      } finally {
        setLoading(false);
      }
    };
    
    checkPermissions();
  }, [user, courseId]);
  
  return { canEdit, loading, isAdmin, isInstructor, error };
}
