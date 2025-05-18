
import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserWithProfile } from '@/types/supabase';

/**
 * Enriches a Supabase auth user with profile data from the database
 */
export const useUserProfile = (authUser: User | null) => {
  const [enrichedUser, setEnrichedUser] = useState<UserWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!authUser) {
      setEnrichedUser(null);
      setLoading(false);
      return;
    }
    
    const enrichUserData = async () => {
      try {
        // Initialize enriched user with auth user data
        const userWithProfile: UserWithProfile = {
          ...authUser,
          email: authUser.email || '', // Ensure email is always set
          name: authUser.user_metadata?.name,
          avatar: authUser.user_metadata?.avatar_url,
        };
        
        // Get profile data
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching profile:', profileError);
        }
        
        if (profile) {
          // Add profile data to enriched user
          userWithProfile.name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || undefined;
          userWithProfile.avatar = profile.avatar_url || undefined;
          userWithProfile.bio = profile.bio || undefined;
          userWithProfile.role = profile.role || 'student';
          
          // Parse roles from profile
          if (profile.roles) {
            userWithProfile.roles = Array.isArray(profile.roles) 
              ? profile.roles 
              : (profile.roles || 'student').split(',').map(r => r.trim());
          } else if (profile.role) {
            // If only role is available, convert it to roles array
            userWithProfile.roles = [profile.role, 'student'];
          } else {
            // Default to student role if no roles are set
            userWithProfile.roles = ['student'];
          }
            
          // Ensure student is always a base role
          if (!userWithProfile.roles.includes('student')) {
            userWithProfile.roles.push('student');
          }
        } else {
          // Set default roles if no profile
          userWithProfile.roles = ['student'];
        }
        
        // Get enrolled courses
        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('user_id', authUser.id);
        
        if (enrollmentsError) {
          console.error('Error fetching enrollments:', enrollmentsError);
        }
        
        if (enrollments) {
          userWithProfile.enrolledCourses = enrollments.map(e => e.course_id);
        }
        
        setEnrichedUser(userWithProfile);
      } catch (error) {
        console.error('Error enriching user data:', error);
        // Return partially enriched user on error
        setEnrichedUser({
          ...authUser,
          email: authUser.email || '',
          roles: ['student'], // Default role
        });
      } finally {
        setLoading(false);
      }
    };
    
    enrichUserData();
  }, [authUser]);
  
  return { enrichedUser, loading };
};
