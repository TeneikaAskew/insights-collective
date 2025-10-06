import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/profileUtils';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useAdminUsers');

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
    logger.log('[useAdminUsers] Starting fetchUsers...');
    setLoading(true);
    setError(null);
    
    try {
      // Check admin privileges
      if (!isAdmin(user?.roles)) {
        throw new Error("Admin privileges required");
      }

      logger.log('[useAdminUsers] Fetching users with roles via RPC...');
      
      // Use the secure RPC function to get all users with roles
      const { data, error: queryError } = await supabase
        .rpc('get_all_users_with_roles');

      if (queryError) {
        logger.error('[useAdminUsers] Query error:', queryError);
        throw new Error(queryError.message || 'Failed to fetch users');
      }

      logger.log('[useAdminUsers] Raw users from RPC:', data?.length || 0);

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

      logger.log('[useAdminUsers] Transformed users:', transformedUsers.length);
      setUsers(transformedUsers);
      
    } catch (err: any) {
      logger.error('[useAdminUsers] Error fetching users:', err);
      
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
      logger.log('[useAdminUsers] Updating user roles:', userId, roles);
      
      if (!userId || !Array.isArray(roles)) {
        throw new Error('Invalid parameters provided');
      }

      // Use the secure admin-only function for role updates
      const { error } = await supabase.rpc('update_user_roles', {
        target_user_id: userId,
        new_roles: roles
      });

      if (error) throw new Error(error.message || 'Failed to update user roles');
      
      // Refresh the users list to get updated data
      await fetchUsers();
      
      toast({
        title: 'Success',
        description: 'User roles updated successfully.',
      });
      
      return { success: true };
    } catch (err: any) {
      logger.error('[useAdminUsers] Error updating user roles:', err);
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