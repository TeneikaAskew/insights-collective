
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
  first_name: string;
  last_name: string;
  avatar_url?: string;
  bio?: string;
  role: string;
  roles: string[];
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchUsers = async () => {
    console.log('[useAdminUsers] Starting fetchUsers...');
    setLoading(true);
    setError(null);
    
    try {
      // Check if user is admin
      if (!user?.roles?.includes('admin')) {
        throw new Error("Admin privileges required");
      }

      console.log('[useAdminUsers] Calling admin-users edge function...');
      
      // Call the edge function to get all users with auth data
      const { data, error: functionError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'listUsers' }
      });

      if (functionError) {
        console.error('[useAdminUsers] Edge function error:', functionError);
        throw functionError;
      }

      if (!data || !data.users) {
        console.error('[useAdminUsers] No users data received from edge function');
        throw new Error('No users data received');
      }

      console.log('[useAdminUsers] Raw users from edge function:', data.users.length);

      // Transform the data to match the expected format
      const transformedUsers = data.users.map((user: any) => {
        // Ensure roles is always an array
        let roles = user.roles || ['student'];
        if (typeof roles === 'string') {
          roles = [roles];
        }
        
        // Clean and validate roles array
        roles = roles.filter((role: string) => role && typeof role === 'string');
        if (roles.length === 0) {
          roles = ['student'];
        }

        return {
          id: user.id,
          email: user.email || '',
          phone: user.phone || '',
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          avatar_url: user.avatar_url,
          bio: user.bio,
          role: user.role || getHighestRole(roles),
          roles: roles
        };
      });

      console.log('[useAdminUsers] Transformed users:', transformedUsers.length);
      console.log('[useAdminUsers] Sample user:', transformedUsers[0]);
      setUsers(transformedUsers);
      
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
      console.log('[useAdminUsers] Updating user role:', userId, roles);
      
      // Determine the highest role for the role field
      const highestRole = getHighestRole(roles);

      // Call the edge function to update user roles
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { 
          action: 'updateUserRole',
          userId,
          data: { roles }
        }
      });

      if (error) throw error;
      
      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, roles, role: highestRole } 
            : user
        )
      );
      
      toast({
        title: 'Success',
        description: 'User role updated successfully.',
      });
      
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
    updateUserRole
  };
}
