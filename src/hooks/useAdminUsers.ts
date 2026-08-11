// ABOUTME: Hook for admin user management - fetches users, updates roles, and deletes users
// ABOUTME: Server-side search/filter/pagination via the search_admin_users RPC (user_roles canonical)

import { useState, useCallback, useRef } from 'react';
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
  roles: string[];
  created_at: string;
}

export interface FetchUsersOptions {
  search?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}

interface RoleCounts {
  total: number;
  students: number;
  instructors: number;
  admins: number;
}

const DEFAULT_PAGE_SIZE = 20;

const mapRow = (r: any): AdminUserResponse => ({
  id: r.id,
  first_name: r.first_name || '',
  last_name: r.last_name || '',
  avatar_url: r.avatar_url,
  roles: Array.isArray(r.roles) && r.roles.length > 0 ? r.roles : ['student'],
  created_at: r.created_at,
});

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<RoleCounts>({ total: 0, students: 0, instructors: 0, admins: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Remember the last query so mutations can refresh the current page/filter.
  const lastOptsRef = useRef<FetchUsersOptions>({ search: '', role: 'all', page: 1, pageSize: DEFAULT_PAGE_SIZE });

  const fetchUsers = useCallback(async (opts: FetchUsersOptions = {}) => {
    const search = opts.search ?? '';
    const role = opts.role ?? 'all';
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
    lastOptsRef.current = { search, role, page, pageSize };

    logger.log('[useAdminUsers] Fetching users (server-side)...', { search, role, page });
    setLoading(true);
    setError(null);

    try {
      if (!isAdmin(user?.roles)) {
        throw new Error('Admin privileges required');
      }

      const [listRes, countsRes] = await Promise.all([
        supabase.rpc('search_admin_users', {
          p_search: search,
          p_role: role,
          p_limit: pageSize,
          p_offset: (page - 1) * pageSize,
        }),
        supabase.rpc('admin_user_role_counts'),
      ]);

      if (listRes.error) {
        logger.error('[useAdminUsers] search_admin_users error:', listRes.error);
        throw new Error(listRes.error.message || 'Failed to fetch users');
      }

      const rows = (listRes.data || []) as any[];
      setUsers(rows.map(mapRow));
      // total_count rides on the returned rows, so an empty page carries no
      // total. Past page 1 that means this page is off the end (a deletion or a
      // role change shrank the set) — not that no users match. Zeroing the total
      // there hid the pager and stranded the admin on an empty page with no way
      // back, so keep the previous total and leave the controls usable.
      if (rows.length > 0) {
        setTotal(Number(rows[0].total_count));
      } else if (page <= 1) {
        setTotal(0);
      }

      const c = !countsRes.error ? (countsRes.data || [])[0] : null;
      if (c) {
        setCounts({
          total: Number(c.total),
          students: Number(c.students),
          instructors: Number(c.instructors),
          admins: Number(c.admins),
        });
      }
    } catch (err: any) {
      logger.error('[useAdminUsers] Error fetching users:', err);

      let errorMessage = 'Failed to load users';
      let toastDescription = 'Could not load user list. Please try again.';

      if (err.message?.includes('Admin privileges required')) {
        errorMessage = 'Admin access required';
        toastDescription = 'You need admin privileges to access user management.';
      }

      setError(errorMessage);
      toast({ title: 'Error', description: toastDescription, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Refresh using the last query (after a mutation).
  const refresh = useCallback(() => fetchUsers(lastOptsRef.current), [fetchUsers]);

  // Fetch every user matching the current search/role filter (for CSV export),
  // not just the visible page.
  const fetchAllForExport = useCallback(async (): Promise<AdminUserResponse[]> => {
    const { search = '', role = 'all' } = lastOptsRef.current;
    const { data, error: exportError } = await supabase.rpc('search_admin_users', {
      p_search: search,
      p_role: role,
      p_limit: 100000,
      p_offset: 0,
    });
    if (exportError) throw new Error(exportError.message || 'Failed to export users');
    return (data || []).map(mapRow);
  }, []);

  const updateUserRole = async (
    userId: string,
    roles: string[],
    options: { skipRefresh?: boolean; silent?: boolean } = {}
  ) => {
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

      // Refresh the users list to get updated data. Bulk callers pass
      // skipRefresh and refetch once at the end instead of once per user.
      if (!options.skipRefresh) {
        await refresh();
      }

      if (!options.silent) {
        toast({
          title: 'Success',
          description: 'User roles updated successfully.',
        });
      }

      return { success: true };
    } catch (err: any) {
      logger.error('[useAdminUsers] Error updating user roles:', err);
      if (!options.silent) {
        toast({
          title: 'Error',
          description: err.message || 'Failed to update user roles. Please try again.',
          variant: 'destructive',
        });
      }
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
      await refresh();
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
    total,
    counts,
    loading,
    error,
    fetchUsers,
    refresh,
    fetchAllForExport,
    updateUserRole,
    deleteUsers,
  };
}
