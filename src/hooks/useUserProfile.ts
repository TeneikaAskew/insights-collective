import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { EnrichedUser } from './useAuth';

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
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        // Combine auth user data with profile data
        setEnrichedUser({
          ...user,
          ...profile,
          roles: profile.roles || []
        });
      } catch (err) {
        console.error('Error loading user profile:', err);
        setError(err as Error);
        // Still set the basic user data even if profile fetch fails
        setEnrichedUser({
          ...user,
          roles: []
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  return { enrichedUser, loading, error };
}
