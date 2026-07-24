
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isValidUUID } from '@/utils/idUtils';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useCoursePermissions');

export function useCoursePermissions(courseId?: string) {
  const { user } = useAuth();
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInstructor, setIsInstructor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    logger.log('useCoursePermissions effect triggered - user:', user?.id, 'courseId:', courseId);
    
    if (!user || !courseId) {
      logger.log('Missing user or courseId, setting canEdit to false');
      setCanEdit(false);
      setLoading(false);
      return;
    }
    
    // Validate UUID format
    if (!isValidUUID(courseId)) {
      logger.error(`Invalid course UUID format: ${courseId}`);
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
          .select('roles')
          .eq('id', user.id)
          .single();
        
        logger.log('User profile data:', userProfile, 'error:', profileError);

        if (profileError) {
          logger.error('Error fetching user profile:', profileError);
          throw profileError;
        }

        // Use the new security definer functions for consistent role checking
        logger.log('Checking permissions for user:', user.id, 'course:', courseId);
        
        const { data: hasAdminAccess, error: adminError } = await supabase
          .rpc('has_admin_access', { user_id_param: user.id });
        
        logger.log('Admin access check result:', hasAdminAccess, 'error:', adminError);
        
        if (adminError) {
          logger.error('Error checking admin access:', adminError);
          throw adminError;
        }
        
        const { data: isCourseInstructor, error: instructorError } = await supabase
          .rpc('is_course_instructor', { 
            user_id_param: user.id, 
            course_id_param: courseId 
          });
        
        logger.log('Instructor access check result:', isCourseInstructor, 'error:', instructorError);
        
        if (instructorError) {
          logger.error('Error checking instructor access:', instructorError);
          throw instructorError;
        }
        
        // Fallback check using profile data directly
        const isAdminFromProfile = userProfile?.roles?.includes('admin');
        const finalAdminAccess = hasAdminAccess || isAdminFromProfile;
        
        logger.log('Setting permissions - Admin (RPC):', hasAdminAccess, 'Admin (Profile):', isAdminFromProfile, 'Final Admin:', finalAdminAccess, 'Instructor:', isCourseInstructor);
        logger.log('About to set state - canEdit will be:', finalAdminAccess || isCourseInstructor);
        
        setIsAdmin(finalAdminAccess);
        setIsInstructor(isCourseInstructor || false);
        setCanEdit(finalAdminAccess || isCourseInstructor);
        
        // Log security event for tracking (non-fatal telemetry — warn on failure)
        if (hasAdminAccess || isCourseInstructor) {
          const { error: securityLogError } = await supabase.rpc('log_security_event', {
            p_user_id: user.id,
            p_event_type: 'course_access_granted',
            p_severity: 'info',
            p_description: `User accessed course management for course ${courseId}`,
            p_metadata: {
              course_id: courseId,
              access_type: hasAdminAccess ? 'admin' : 'instructor'
            }
          });
          if (securityLogError) logger.warn('Failed to write course_access_granted security event:', securityLogError);
        }
        
      } catch (error: any) {
        logger.error('Error checking course permissions:', error);
        setError(error.message || 'Error checking course permissions');
        setCanEdit(false);
        
        // Log security event for failed access attempts (non-fatal telemetry)
        const { error: securityLogError } = await supabase.rpc('log_security_event', {
          p_user_id: user.id,
          p_event_type: 'course_access_denied',
          p_severity: 'warning',
          p_description: `Failed to check course permissions for course ${courseId}`,
          p_metadata: {
            course_id: courseId,
            error: error.message
          }
        });
        if (securityLogError) logger.warn('Failed to write course_access_denied security event:', securityLogError);
      } finally {
        setLoading(false);
      }
    };
    
    checkPermissions();
  }, [user, courseId]);
  
  return { canEdit, loading, isAdmin, isInstructor, error };
}
