
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/profileUtils';
import { createRateLimiter, validateSessionIntegrity } from '@/utils/securityUtils';

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
  roles: string[];
}

// Create rate limiter for admin operations (5 requests per minute)
const adminRateLimiter = createRateLimiter(5, 60000);

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, session } = useAuth();

  const fetchUsers = useCallback(async () => {
    console.log('[useAdminUsers] Starting fetchUsers...');
    setLoading(true);
    setError(null);
    
    try {
      // Enhanced admin privilege checking
      if (!isAdmin(user?.roles)) {
        throw new Error("Admin privileges required");
      }

      // Rate limiting check
      const userIdentifier = user?.id || 'anonymous';
      if (!adminRateLimiter(userIdentifier)) {
        throw new Error("Too many requests. Please wait before trying again.");
      }

      // Enhanced session validation
      if (!session || !validateSessionIntegrity(session)) {
        throw new Error('Invalid or expired session');
      }

      console.log('[useAdminUsers] Enhanced security checks passed, calling admin-users edge function...');
      
      // Call the edge function with enhanced error handling
      const { data, error: functionError } = await supabase.functions.invoke('admin-users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: { action: 'listUsers' }
      });

      if (functionError) {
        console.error('[useAdminUsers] Edge function error:', functionError);
        throw new Error(functionError.message || 'Failed to fetch users');
      }

      if (!data || !data.users) {
        console.error('[useAdminUsers] No users data received from edge function');
        throw new Error('No users data received');
      }

      console.log('[useAdminUsers] Raw users from edge function:', data.users.length);

      // Enhanced data transformation with validation
      const transformedUsers = data.users.map((user: any) => {
        // Validate and sanitize user data
        if (!user.id || !user.email) {
          console.warn('[useAdminUsers] Invalid user data detected:', user);
          throw new Error('Invalid user data received');
        }

        // Ensure roles is always an array and handle PostgreSQL array format
        let roles = user.roles || ['student'];
        
        // Handle PostgreSQL array format like "{admin,student}"
        if (typeof roles === 'string') {
          if (roles.startsWith('{') && roles.endsWith('}')) {
            roles = roles.slice(1, -1).split(',').filter((role: string) => role.trim());
          } else {
            roles = [roles];
          }
        }
        
        // Clean and validate roles array
        roles = roles.filter((role: string) => role && typeof role === 'string' && role.trim() !== '');
        
        // Ensure student role is always included
        if (!roles.includes('student')) {
          roles.push('student');
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
          roles: roles
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
      } else if (err.message?.includes('Too many requests')) {
        errorMessage = 'Rate limit exceeded';
        toastDescription = 'Too many requests. Please wait before trying again.';
      } else if (err.message?.includes('session')) {
        errorMessage = 'Session invalid';
        toastDescription = 'Your session is invalid. Please log in again.';
      } else if (err.message?.includes('User profile not found')) {
        errorMessage = 'Profile not found';
        toastDescription = 'Your user profile was not found. Please contact support.';
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
  }, [user, session, toast]);

  const updateUserRole = async (userId: string, roles: string[]) => {
    try {
      console.log('[useAdminUsers] Updating user role:', userId, roles);
      
      // Enhanced validation
      if (!userId || !Array.isArray(roles)) {
        throw new Error('Invalid parameters provided');
      }

      // Rate limiting check
      const userIdentifier = user?.id || 'anonymous';
      if (!adminRateLimiter(userIdentifier)) {
        throw new Error("Too many requests. Please wait before trying again.");
      }

      // Enhanced session validation
      if (!session || !validateSessionIntegrity(session)) {
        throw new Error('Invalid or expired session');
      }
      
      // Ensure student role is always included
      const updatedRoles = [...roles];
      if (!updatedRoles.includes('student')) {
        updatedRoles.push('student');
      }

      // Call the edge function to update user roles
      const { data, error } = await supabase.functions.invoke('admin-users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: { 
          action: 'updateUserRole',
          userId,
          data: { roles: updatedRoles }
        }
      });

      if (error) throw new Error(error.message || 'Failed to update user role');
      
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
        description: 'User role updated successfully.',
      });
      
      return { success: true };
    } catch (err: any) {
      console.error('[useAdminUsers] Error updating user role:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to update user role. Please try again.',
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
