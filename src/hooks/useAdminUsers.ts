// ABOUTME: Hook for admin user management - fetches users, updates roles, and deletes users
// ABOUTME: Reads roles from user_roles table via get_user_roles RPC for consistency

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

      logger.log('[useAdminUsers] Fetching users from profiles table...');
      
      // Query profiles table
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, bio, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) {
        logger.error('[useAdminUsers] Query error:', profilesError);
        throw new Error(profilesError.message || 'Failed to fetch users');
      }

      logger.log('[useAdminUsers] Raw profiles from query:', profiles?.length || 0);

      // Fetch roles from user_roles table for each user
      const transformedUsers: AdminUserResponse[] = [];
      
      for (const profile of (profiles || [])) {
        // Use the get_user_roles RPC to fetch canonical roles
        const { data: rolesData, error: rolesError } = await supabase
          .rpc('get_user_roles', { _user_id: profile.id });

        // A roles lookup failure must not silently render every user as
        // 'student' in the admin UI — fail the fetch and surface the error.
        if (rolesError) {
          logger.error('[useAdminUsers] Error fetching roles for user:', profile.id, rolesError);
          throw new Error(rolesError.message || 'Failed to fetch user roles');
        }

        let roles: string[] = Array.isArray(rolesData) ? rolesData : [];
        if (roles.length === 0) roles = ['student'];

        transformedUsers.push({
          id: profile.id,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          avatar_url: profile.avatar_url,
          bio: profile.bio || '',
          roles,
          created_at: profile.created_at
        });
      }

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

  const deleteUsers = async (userIds: string[]) => {
    const results: { userId: string; success: boolean; error?: string }[] = [];

    for (const userId of userIds) {
      try {
        logger.log('[useAdminUsers] Deleting user:', userId);

        const { data, error } = await supabase.functions.invoke('admin-users', {
          body: { action: 'deleteUser', userId },
        });

        if (error) {
          logger.error('[useAdminUsers] Edge function error for', userId, error);
          results.push({ userId, success: false, error: error.message });
        } else if (data?.error) {
          logger.error('[useAdminUsers] Delete error for', userId, data.error);
          results.push({ userId, success: false, error: data.error });
        } else {
          results.push({ userId, success: true });
        }
      } catch (err: any) {
        logger.error('[useAdminUsers] Exception deleting user:', userId, err);
        results.push({ userId, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      await fetchUsers();
    }

    if (failCount > 0) {
      toast({
        title: 'Partial Failure',
        description: `Deleted ${successCount} user(s), ${failCount} failed.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Users Deleted',
        description: `Successfully deleted ${successCount} user(s).`,
      });
    }

    return results;
  };

  return { 
    users, 
    loading, 
    error, 
    fetchUsers, 
    updateUserRole,
    deleteUsers,
  };
}
