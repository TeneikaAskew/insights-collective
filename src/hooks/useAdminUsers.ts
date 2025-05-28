
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

      console.log('[useAdminUsers] Fetching profiles...');
      
      // Fetch all user profiles directly from Supabase
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('[useAdminUsers] Profiles error:', profilesError);
        throw profilesError;
      }

      console.log('[useAdminUsers] Profiles fetched:', profiles?.length || 0);

      // Transform the data to match the expected format
      const transformedUsers = profiles?.map((profile) => ({
        id: profile.id,
        email: '', // We'll need to get this from auth if needed
        phone: '',
        created_at: profile.created_at,
        last_sign_in_at: null,
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        role: profile.role || getHighestRole(profile.roles || ['student']),
        roles: profile.roles || ['student']
      })) || [];

      console.log('[useAdminUsers] Transformed users:', transformedUsers.length);
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

      const { error } = await supabase
        .from('profiles')
        .update({ 
          role: highestRole,
          roles: roles 
        })
        .eq('id', userId);

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
