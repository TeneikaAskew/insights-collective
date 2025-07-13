import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/profileUtils';

interface AdminUserResponse {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  bio?: string;
  roles: string[];
  created_at: string;
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchUsers = useCallback(async () => {
    console.log('[useAdminUsers] Starting fetchUsers...');
    setLoading(true);
    setError(null);
    
    try {
      // Check admin privileges
      if (!isAdmin(user?.roles)) {
        throw new Error("Admin privileges required");
      }

      console.log('[useAdminUsers] Fetching users from profiles table...');
      
      // Query profiles table directly
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, bio, roles, created_at')
        .order('created_at', { ascending: false });

      if (queryError) {
        console.error('[useAdminUsers] Query error:', queryError);
        throw new Error(queryError.message || 'Failed to fetch users');
      }

      console.log('[useAdminUsers] Raw users from query:', data?.length || 0);

      // Transform and validate data
      const transformedUsers = (data || []).map((profile: any) => {
        // Ensure roles is always an array with at least 'student'
        let roles = profile.roles || ['student'];
        if (!Array.isArray(roles)) {
          roles = ['student'];
        }
        
        // Ensure student role is always included
        if (!roles.includes('student')) {
          roles = [...roles, 'student'];
        }

        return {
          id: profile.id,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          avatar_url: profile.avatar_url,
          bio: profile.bio || '',
          roles: roles,
          created_at: profile.created_at
        };
      });

      console.log('[useAdminUsers] Transformed users:', transformedUsers.length);
      setUsers(transformedUsers);
      
    } catch (err: any) {
      console.error('[useAdminUsers] Error fetching users:', err);
      
      let errorMessage = 'Failed to load users';
      let toastDescription = 'Could not load user list. Please try again.';
      
      if (err.message?.includes('Admin privileges required')) {
        errorMessage = 'Admin access required';
        toastDescription = 'You need admin privileges to access user management.';
      }
      
      setError(errorMessage);
      
      toast({
        title: 'Error',
        description: toastDescription,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const updateUserRole = async (userId: string, roles: string[]) => {
    try {
      console.log('[useAdminUsers] Updating user roles:', userId, roles);
      
      if (!userId || !Array.isArray(roles)) {
        throw new Error('Invalid parameters provided');
      }

      // Ensure student role is always included
      const updatedRoles = [...roles];
      if (!updatedRoles.includes('student')) {
        updatedRoles.push('student');
      }

      // Update roles directly in profiles table
      const { error } = await supabase
        .from('profiles')
        .update({ roles: updatedRoles })
        .eq('id', userId);

      if (error) throw new Error(error.message || 'Failed to update user roles');
      
      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, roles: updatedRoles } 
            : user
        )
      );
      
      toast({
        title: 'Success',
        description: 'User roles updated successfully.',
      });
      
      return { success: true };
    } catch (err: any) {
      console.error('[useAdminUsers] Error updating user roles:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to update user roles. Please try again.',
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  };

  return { 
    users, 
    loading, 
    error, 
    fetchUsers, 
    updateUserRole
  };
}