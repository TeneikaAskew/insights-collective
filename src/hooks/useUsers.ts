
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/supabase';
import { useToast } from './use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useUsers');

/**
 * Hook for fetching and searching users
 */
export function useUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setUsers([]);
      return;
    }

    const searchUsers = async () => {
      setLoading(true);
      try {
        logger.log('[useUsers] Searching for users with query:', searchQuery);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, bio, roles')
          .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
          .limit(50);

        if (error) throw error;

        logger.log('[useUsers] Raw user data received:', data?.length || 0, 'users');

        // Transform the data to match Profile type, providing defaults for missing fields
        const transformedData: Profile[] = (data || []).map(user => ({
          id: user.id,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          avatar_url: user.avatar_url,
          bio: user.bio || '',
          roles: user.roles || ['student']
        }));

        logger.log('[useUsers] Transformed user data:', transformedData.length, 'users');
        setUsers(transformedData);
      } catch (error) {
        logger.error('Error searching users:', error);
        toast({
          title: 'Error',
          description: 'Failed to search users. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, toast]);

  const updateSearchQuery = (query: string) => {
    logger.log('[useUsers] Updating search query to:', query);
    setSearchQuery(query);
  };

  return {
    users,
    loading,
    searchQuery,
    updateSearchQuery
  };
}
