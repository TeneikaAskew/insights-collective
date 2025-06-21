
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
    console.log('useCoursePermissions effect triggered - user:', user?.id, 'courseId:', courseId);
    
    if (!user || !courseId) {
      console.log('Missing user or courseId, setting canEdit to false');
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
        // First, let's check user profile directly as a fallback
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('role, roles')
          .eq('id', user.id)
          .single();
        
        console.log('User profile data:', userProfile, 'error:', profileError);
        
        // Use the new security definer functions for consistent role checking
        console.log('Checking permissions for user:', user.id, 'course:', courseId);
        
        const { data: hasAdminAccess, error: adminError } = await supabase
          .rpc('has_admin_access', { user_id_param: user.id });
        
        console.log('Admin access check result:', hasAdminAccess, 'error:', adminError);
        
        if (adminError) {
          console.error('Error checking admin access:', adminError);
          throw adminError;
        }
        
        const { data: isCourseInstructor, error: instructorError } = await supabase
          .rpc('is_course_instructor', { 
            user_id_param: user.id, 
            course_id_param: courseId 
          });
        
        console.log('Instructor access check result:', isCourseInstructor, 'error:', instructorError);
        
        if (instructorError) {
          console.error('Error checking instructor access:', instructorError);
          throw instructorError;
        }
        
        // Fallback check using profile data directly
        const isAdminFromProfile = userProfile?.role === 'admin' || userProfile?.roles?.includes('admin');
        const finalAdminAccess = hasAdminAccess || isAdminFromProfile;
        
        console.log('Setting permissions - Admin (RPC):', hasAdminAccess, 'Admin (Profile):', isAdminFromProfile, 'Final Admin:', finalAdminAccess, 'Instructor:', isCourseInstructor);
        console.log('About to set state - canEdit will be:', finalAdminAccess || isCourseInstructor);
        
        setIsAdmin(finalAdminAccess);
        setIsInstructor(isCourseInstructor || false);
        setCanEdit(finalAdminAccess || isCourseInstructor);
        
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
