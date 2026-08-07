
import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { EnrichedUser } from './useAuth';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useUserProfile');

/**
 * Enriches a Supabase auth user with profile data and roles from the database.
 * Roles are loaded from the user_roles table via get_user_roles RPC (canonical source).
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
      setError(null);
      try {
        // Fetch profile and roles in parallel
        const [profileResult, rolesResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single(),
          supabase.rpc('get_user_roles', { _user_id: user.id })
        ]);

        const { data: profile, error: profileError } = profileResult;
        const { data: rolesData, error: rolesError } = rolesResult;

        if (profileError && profileError.code !== 'PGRST116') {
          logger.error('Error fetching profile:', profileError);
          throw profileError;
        }

        if (rolesError) {
          // BEHAVIOR CHANGE (silent-failure audit): a failed roles RPC used to be
          // logged and then silently replaced with fallback/default roles, leaving
          // the user (and any consumer of useAuth().error) unaware that their
          // effective roles may be wrong. We still fail CLOSED (default roles),
          // but the error is now surfaced through the hook's error state.
          logger.error('Error fetching roles from user_roles:', rolesError);
          setError(new Error(`Failed to load user roles: ${rolesError.message}`));
        }

        // Canonical roles from user_roles table, fall back to profile.roles, then default
        let roles: string[] = ['student'];
        if (rolesData && Array.isArray(rolesData) && rolesData.length > 0) {
          roles = rolesData as string[];
        } else if (profile?.roles) {
          // Legacy fallback: parse roles from profiles table
          let legacyRoles: any = profile.roles;
          if (typeof legacyRoles === 'string') {
            if (legacyRoles.startsWith('{') && legacyRoles.endsWith('}')) {
              legacyRoles = legacyRoles.slice(1, -1).split(',').filter((r: string) => r.trim());
            } else {
              legacyRoles = [legacyRoles];
            }
          }
          if (Array.isArray(legacyRoles) && legacyRoles.length > 0) {
            roles = legacyRoles;
          }
        }

        logger.log('[useUserProfile] Roles resolved:', roles);

        // Generate a display name from first_name and last_name
        const displayName = profile?.first_name && profile?.last_name
          ? `${profile.first_name} ${profile.last_name}`.trim()
          : profile?.first_name || user.email?.split('@')[0] || 'User';

        const finalEnrichedUser = {
          ...user,
          ...profile,
          avatar: profile?.avatar_url,
          avatar_url: profile?.avatar_url,
          name: displayName,
          roles
        };

        logger.log('[useUserProfile] Final enriched user roles:', finalEnrichedUser.roles);

        setEnrichedUser(finalEnrichedUser);
      } catch (err) {
        logger.error('Error loading user profile:', err);
        setError(err as Error);
        setEnrichedUser({
          ...user,
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
