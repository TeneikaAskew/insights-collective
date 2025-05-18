import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserWithProfile } from '@/types/supabase';

const createDefaultUserProfile = (authUser: User | null): UserWithProfile | null => {
  if (!authUser) return null;
  
  return {
    ...authUser,
    email: authUser.email || '',
    name: authUser.user_metadata?.name || '',
    avatar: authUser.user_metadata?.avatar_url,
    roles: ['student'],
    enrolledCourses: [],
  };
};

/**
 * Enriches a Supabase auth user with profile data from the database
 */
export const useUserProfile = (authUser: User | null) => {
  const [enrichedUser, setEnrichedUser] = useState<UserWithProfile | null>(() => 
    createDefaultUserProfile(authUser)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!authUser) {
      setEnrichedUser(null);
      setLoading(false);
      setError(null);
      return;
    }
    
    const enrichUserData = async () => {
      try {
        // Initialize enriched user with auth user data
        let userWithProfile = createDefaultUserProfile(authUser);
        if (!userWithProfile) throw new Error('Failed to create user profile');
        
        // Get profile data
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
          throw profileError;
        }
        
        if (profile) {
          // Add profile data to enriched user
          userWithProfile = {
            ...userWithProfile,
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || userWithProfile.name,
            avatar: profile.avatar_url || userWithProfile.avatar,
            bio: profile.bio,
            role: profile.role || 'student',
            roles: Array.isArray(profile.roles) 
              ? profile.roles 
              : (profile.roles || 'student').split(',').map(r => r.trim()),
          };
          
          // Ensure student is always a base role
          if (!userWithProfile.roles.includes('student')) {
            userWithProfile.roles.push('student');
          }
        }
        
        // Get enrolled courses
        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('user_id', authUser.id);
        
        if (enrollmentsError) {
          throw enrollmentsError;
        }
        
        if (enrollments) {
          userWithProfile.enrolledCourses = enrollments.map(e => e.course_id);
        }
        
        setEnrichedUser(userWithProfile);
        setError(null);
      } catch (err) {
        console.error('Error enriching user data:', err);
        const error = err instanceof Error ? err : new Error('Failed to enrich user data');
        setError(error);
        
        // Set default profile on error
        const defaultProfile = createDefaultUserProfile(authUser);
        setEnrichedUser(defaultProfile);
      } finally {
        setLoading(false);
      }
    };
    
    enrichUserData();
  }, [authUser]);
  
  return { enrichedUser, loading, error };
};
