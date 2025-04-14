
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/supabase';
import { useToast } from './use-toast';
import { useDebounce } from './useDebounce';

export function useUsers(initialSearchQuery = '') {
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [loading, setLoading] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { toast } = useToast();

  const fetchUsers = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      console.log("Fetching users with search query:", query);
      
      let supabaseQuery = supabase
        .from('profiles')
        .select('*');
      
      if (query && query.length > 0) {
        // Use wildcard search on first and last names
        supabaseQuery = supabaseQuery.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`);
      }
      
      const { data, error } = await supabaseQuery;
      
      if (error) {
        console.error("Supabase error fetching users:", error);
        throw error;
      }
      
      console.log("Fetched users:", data);
      
      // Ensure all profiles have the roles property
      const profilesWithRoles = data?.map(profile => ({
        ...profile,
        roles: profile.roles || (profile.role ? [profile.role, 'student'] : ['student'])
      })) || [];
      
      setUsers(profilesWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Could not load user list. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Create a function to update the search query
  const updateSearchQuery = useCallback((newQuery: string) => {
    setSearchQuery(newQuery);
  }, []);

  // Fetch users when component mounts or debounced search query changes
  useEffect(() => {
    fetchUsers(debouncedSearchQuery);
  }, [debouncedSearchQuery, fetchUsers]);

  return { 
    users, 
    loading, 
    fetchUsers,
    searchQuery,
    updateSearchQuery
  };
}
