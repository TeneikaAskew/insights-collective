
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/supabase';
import { useToast } from './use-toast';

/**
 * Hook for fetching and searching users
 */
export function useUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setUsers([]);
      return;
    }

    const searchUsers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, role, bio, roles')
          .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
          .limit(20);

        if (error) throw error;

        // Transform the data to match Profile type, providing defaults for missing fields
        const transformedData: Profile[] = (data || []).map(user => ({
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          avatar_url: user.avatar_url,
          role: user.role,
          bio: user.bio || '',
          roles: user.roles || ['student']
        }));

        setUsers(transformedData);
      } catch (error) {
        console.error('Error searching users:', error);
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
    setSearchQuery(query);
  };

  return {
    users,
    loading,
    searchQuery,
    updateSearchQuery
  };
}
