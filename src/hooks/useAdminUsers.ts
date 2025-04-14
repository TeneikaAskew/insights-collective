
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
  const { session } = useAuth();

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Ensure we have a valid session
      if (!session || !session.access_token) {
        throw new Error("Authentication required to access admin functions");
      }
      
      if (process.env.NODE_ENV === "development") {
        console.log('Fetching admin users with access token:', !!session.access_token);
      }
      
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'listUsers' },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Error details:', error);
        throw error;
      }
      
      const response = data as AdminUsersResponse;
      setUsers(response.users || []);
      
      if (process.env.NODE_ENV === "development") {
        console.log('Admin users loaded:', response.users?.length || 0);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to load users');
      toast({
        title: 'Error',
        description: 'Could not load user list. Please try again.',
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
      console.error('Error updating user role:', err);
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
      console.error('Error deleting user:', err);
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
      
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'resetPassword', data: { email } },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      
      return { success: true };
    } catch (err: any) {
      console.error('Error resetting password:', err);
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
