
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface AdminUserResponse {
  id: string;
  email: string;
  phone?: string;
  created_at: string;
  last_sign_in_at?: string;
  providers: string[];
  first_name: string;
  last_name: string;
  avatar_url?: string;
  bio?: string;
  role: string;
  roles: string[];
  user_metadata?: Record<string, any>;
}

interface AdminUsersResponse {
  users: AdminUserResponse[];
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { session, user } = useAuth();

  const fetchUsers = async () => {
    console.log('[useAdminUsers] Starting fetchUsers...');
    setLoading(true);
    setError(null);
    
    try {
      // Check authentication first
      if (!session || !session.access_token) {
        console.error('[useAdminUsers] No valid session or access token');
        throw new Error("Authentication required to access admin functions");
      }

      // Check if user is admin
      if (!user?.roles?.includes('admin')) {
        console.error('[useAdminUsers] User is not an admin:', user?.roles);
        throw new Error("Admin privileges required");
      }
      
      console.log('[useAdminUsers] Making request to admin-users function...');
      console.log('[useAdminUsers] Session token available:', !!session.access_token);
      console.log('[useAdminUsers] User roles:', user?.roles);
      
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'listUsers' },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('[useAdminUsers] Edge function error:', error);
        throw error;
      }
      
      console.log('[useAdminUsers] Raw response data:', data);
      
      const response = data as AdminUsersResponse;
      const usersList = response.users || [];
      
      console.log('[useAdminUsers] Processed users list:', usersList.length, 'users');
      
      setUsers(usersList);
      
      if (usersList.length === 0) {
        console.warn('[useAdminUsers] No users returned from API');
      }
      
    } catch (err: any) {
      console.error('[useAdminUsers] Error fetching users:', err);
      const errorMessage = err.message || 'Failed to load users';
      setError(errorMessage);
      
      toast({
        title: 'Error',
        description: 'Could not load user list. Please check your admin permissions and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, roles: string[]) => {
    try {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }
      
      console.log('[useAdminUsers] Updating user role:', userId, roles);
      
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'updateUserRole', userId, data: { roles } },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      
      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, roles, role: getHighestRole(roles) } 
            : user
        )
      );
      
      return { success: true };
    } catch (err: any) {
      console.error('[useAdminUsers] Error updating user role:', err);
      toast({
        title: 'Error',
        description: 'Failed to update user role. Please try again.',
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }
      
      console.log('[useAdminUsers] Deleting user:', userId);
      
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'deleteUser', userId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      
      // Update local state
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
      
      return { success: true };
    } catch (err: any) {
      console.error('[useAdminUsers] Error deleting user:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete user. Please try again.',
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  };

  const resetUserPassword = async (email: string) => {
    try {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }
      
      console.log('[useAdminUsers] Resetting password for:', email);
      
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'resetPassword', data: { email } },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      
      return { success: true };
    } catch (err: any) {
      console.error('[useAdminUsers] Error resetting password:', err);
      toast({
        title: 'Error',
        description: 'Failed to send password reset. Please try again.',
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  };

  // Helper function to determine highest role
  const getHighestRole = (roles: string[] = ['student']): string => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('instructor')) return 'instructor';
    return 'student';
  };

  return { 
    users, 
    loading, 
    error, 
    fetchUsers, 
    updateUserRole, 
    deleteUser, 
    resetUserPassword 
  };
}
