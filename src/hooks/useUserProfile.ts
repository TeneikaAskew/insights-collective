
import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { EnrichedUser } from './useAuth';
import { enrichProfileWithRoles } from '@/utils/profileUtils';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useUserProfile');

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  roles: string[];
  email: string;
  avatar_url?: string;
  title?: string;
  company?: string;
  bio?: string;
  social_links?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
  };
}

/**
 * Enriches a Supabase auth user with profile data from the database
 */
export function useUserProfile(user: User | null) {
  const [enrichedUser, setEnrichedUser] = useState<EnrichedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setEnrichedUser(null);
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          // Only log error if it's not a "no profile found" error
          if (profileError.code !== 'PGRST116') {
            logger.error('Error fetching profile:', profileError);
          }
          throw profileError;
        }

        // Enrich profile with consistent role information
        const enrichedProfile = enrichProfileWithRoles(profile);
        
        logger.log('[useUserProfile] Profile fetched for user:', user.id);
        logger.log('[useUserProfile] Raw profile data:', profile);
        logger.log('[useUserProfile] Enriched profile data:', enrichedProfile);
        logger.log('[useUserProfile] Profile roles:', enrichedProfile?.roles);
        
        // Generate a display name from first_name and last_name
        const displayName = enrichedProfile?.first_name && enrichedProfile?.last_name 
          ? `${enrichedProfile.first_name} ${enrichedProfile.last_name}`.trim()
          : enrichedProfile?.first_name || user.email?.split('@')[0] || 'User';

        // Combine auth user data with profile data
        const finalEnrichedUser = {
          ...user,
          ...enrichedProfile,
          // Ensure avatar and name are properly set
          avatar: enrichedProfile?.avatar_url,
          avatar_url: enrichedProfile?.avatar_url,
          name: displayName,
          roles: enrichedProfile?.roles || ['student']
        };
        
        logger.log('[useUserProfile] Final enriched user:', finalEnrichedUser);
        logger.log('[useUserProfile] Final user roles:', finalEnrichedUser.roles);
        
        setEnrichedUser(finalEnrichedUser);
      } catch (err) {
        logger.error('Error loading user profile:', err);
        setError(err as Error);
        // Still set the basic user data even if profile fetch fails
        setEnrichedUser({
          ...user,
          // Set default values for avatar and name
          avatar: undefined,
          avatar_url: undefined,
          name: user.email?.split('@')[0] || 'User',
          roles: ['student']
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  return { enrichedUser, loading, error };
}
