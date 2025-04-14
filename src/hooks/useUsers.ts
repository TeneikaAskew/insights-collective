
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/supabase';
import { useToast } from './use-toast';

export function useUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = useCallback(async (searchQuery?: string) => {
    setLoading(true);
    try {
      console.log("Fetching users with search query:", searchQuery);
      
      let query = supabase
        .from('profiles')
        .select('*');
      
      if (searchQuery && searchQuery.length > 0) {
        // Use wildcard search on first and last names
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      
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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, fetchUsers };
}
