// ABOUTME: Admin user management page with bulk role update and delete functionality
// ABOUTME: Reads roles from canonical user_roles table, supports single and bulk actions
// ABOUTME: Soft Studio "Operator's Console" layout scoped to the admin section.

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Search, MoreHorizontal, Download, Eye, PenSquare, Loader2, Trash2, Users2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useAuth } from '@/contexts/AuthContext';
import { downloadCsv } from '@/utils/csv';
import { getInitials, avatarColor, roleBadgeVariant } from '@/utils/adminUiUtils';

import { createLogger } from '@/utils/logger';

const logger = createLogger('AdminUsers');

interface UserData {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  roles?: string[];
  created_at?: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const AdminUsers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isBulkRoleOpen, setIsBulkRoleOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [updatedRoles, setUpdatedRoles] = useState<string[]>([]);
  const [bulkRoles, setBulkRoles] = useState<string[]>(['student']);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const { toast } = useToast();
  const authContext = useAuth();
  const user = authContext?.user;

  const {
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
  } = useAdminUsers();

  const isAdmin = !!user?.roles?.includes('admin');
  const authResolved = !!user;

  // Debounce the search box, resetting to page 1 when the query changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Switching role tabs starts a fresh page and clears the current selection.
  useEffect(() => {
    setPage(1);
    setSelectedUsers([]);
  }, [activeTab]);

  // Server-side fetch whenever the admin, filter, or page changes.
  useEffect(() => {
    if (user && user.roles && user.roles.includes('admin')) {
      fetchUsers({ search: debouncedSearch, role: activeTab, page, pageSize: PAGE_SIZE });
    } else if (user && user.roles && !user.roles.includes('admin')) {
      logger.log('[AdminUsers] User is not admin, showing access denied.');
    } else {
      logger.log('[AdminUsers] User not loaded yet, waiting...');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, debouncedSearch, activeTab, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Search, role filter, and pagination are all handled server-side; render
  // the current page of users directly.
  const filteredUsers = users;

  const handleOpenUserDetails = (user: UserData) => {
    setSelectedUser(user);
    setIsViewDetailsOpen(true);
  };

  const handleOpenEditUser = (user: UserData) => {
    setSelectedUser(user);
    setUpdatedRoles(user.roles || ['student']);
    setIsEditUserOpen(true);
  };

  const handleUpdateUserRoles = async () => {
    if (!selectedUser) return;

    try {
      // Copy before adding 'student' — never mutate React state in place.
      const rolesToSave = updatedRoles.includes('student')
        ? [...updatedRoles]
        : [...updatedRoles, 'student'];

      const result = await updateUserRole(selectedUser.id, rolesToSave);

      if (!result.success) throw new Error(result.error);

      setIsEditUserOpen(false);

      toast({
        title: 'User Updated',
        description: `Roles have been updated.`,
      });
    } catch (error: any) {
      logger.error('Error updating user roles:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user roles.',
        variant: 'destructive'
      });
    }
  };

  const handleExportUsers = async () => {
    try {
      // Export every user matching the current search/role filter, not just the
      // page currently shown.
      const allUsers = await fetchAllForExport();
      const rows = allUsers.map(user => [
        user.id,
        `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        (user.roles || ['student']).join(';'),
        user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A',
      ]);
      downloadCsv('users.csv', ['ID', 'Name', 'Roles', 'Created At'], rows);

      toast({
        title: 'Export Completed',
        description: `Exported ${rows.length} user(s) to CSV.`,
      });
    } catch (error) {
      logger.error('Error exporting users:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export user data.',
        variant: 'destructive'
      });
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSelectedUsers([]); // Clear selections when switching tabs
  };

  const toggleRole = (role: string) => {
    if (role === 'student') return;

    setUpdatedRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const toggleBulkRole = (role: string) => {
    if (role === 'student') return;

    setBulkRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSelectAllUsers = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(filteredUsers.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  // Open delete confirmation for bulk or single user
  const handleRequestDelete = (userIds: string[]) => {
    setDeleteTargetIds(userIds);
    setDeleteConfirmText('');
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await deleteUsers(deleteTargetIds);
      setSelectedUsers(prev => prev.filter(id => !deleteTargetIds.includes(id)));
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
      setDeleteTargetIds([]);
      setDeleteConfirmText('');
    }
  };

  const handleBulkRoleUpdate = () => {
    setBulkRoles(['student']);
    setIsBulkRoleOpen(true);
  };

  const handleConfirmBulkRoleUpdate = async () => {
    setIsBulkUpdating(true);
    try {
      const roles = [...bulkRoles];
      if (!roles.includes('student')) roles.push('student');

      let successCount = 0;
      let failCount = 0;

      // Skip the per-user refetch/toast — refetch once after the whole batch.
      for (const userId of selectedUsers) {
        const result = await updateUserRole(userId, roles, { skipRefresh: true, silent: true });
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      if (successCount > 0) {
        await refresh();
        setSelectedUsers([]);
      }

      if (failCount > 0) {
        toast({
          title: 'Partial Update',
          description: `Updated ${successCount} user(s), ${failCount} failed.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Roles Updated',
          description: `Successfully updated roles for ${successCount} user(s).`,
        });
      }
    } finally {
      setIsBulkUpdating(false);
      setIsBulkRoleOpen(false);
    }
  };

  // Global per-role counts come from the server (independent of the page).
  const tiles = [
    { value: 'all', label: 'All Users', n: counts.total },
    { value: 'student', label: 'Students', n: counts.students },
    { value: 'instructor', label: 'Instructors', n: counts.instructors },
    { value: 'admin', label: 'Admins', n: counts.admins },
  ];

  const deleteTargetNames = deleteTargetIds.map(id => {
    const u = users.find(usr => usr.id === id);
    return u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unnamed User' : id;
  });

  // Non-admins used to sit on an infinite spinner because fetchUsers() never
  // ran and `loading` never left its initial true. Show an explicit denial.
  if (authResolved && !isAdmin) {
    return (
      <div className="py-16 text-center" role="alert">
        <h1 className="text-2xl font-semibold mb-2">Access denied</h1>
        <p className="text-muted-foreground">
          You need administrator privileges to manage users.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="mb-7">
        <p className="ss-serif text-ss-lav-deep text-lg mb-1">Insights Collective · Admin</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">User Management</h1>
      </header>

      {/* Search + export */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users..."
            className="pl-9 rounded-xl bg-card"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={handleExportUsers} className="rounded-xl bg-card">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Role count-tiles — these are the filter (the four tabs, restyled) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {tiles.map((t) => {
          const on = activeTab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTabChange(t.value)}
              aria-pressed={on}
              className={cn(
                'rounded-2xl border px-4 py-4 text-left transition shadow-[var(--ss-shadow)]',
                on ? 'bg-ss-lav-chip border-transparent' : 'bg-card border-border hover:border-ss-lav',
              )}
            >
              <div className="text-2xl font-bold tracking-tight tabular-nums">{t.n}</div>
              <div className={cn('text-xs mt-0.5', on ? 'text-ss-lav-deep font-medium' : 'text-muted-foreground')}>
                {t.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selection bar */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-foreground text-background px-4 py-3 mb-4 shadow-[var(--ss-shadow)]">
          <span className="font-semibold">{selectedUsers.length} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="secondary" onClick={handleBulkRoleUpdate}>
            <PenSquare className="h-4 w-4 mr-2" />
            Update Roles
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleRequestDelete(selectedUsers)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-background/80 hover:bg-background/10 hover:text-background"
            onClick={() => setSelectedUsers([])}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table card */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-[var(--ss-shadow)]">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold">Users</h2>
          <p className="text-sm text-muted-foreground">Manage your users, their roles, and permissions.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading users...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col justify-center items-center py-16">
            <p className="text-destructive mb-4">Error loading users: {error}</p>
            <Button onClick={() => fetchUsers({ search: debouncedSearch, role: activeTab, page, pageSize: PAGE_SIZE })} variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-left">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                          onCheckedChange={handleSelectAllUsers}
                          aria-label="Select all users on this page"
                        />
                        <span>Name</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-left">Roles</TableHead>
                    <TableHead className="text-left">Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4}>
                        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                          <Users2 className="h-8 w-8 text-muted-foreground/60" />
                          <p className="ss-serif text-base text-muted-foreground">
                            {debouncedSearch || activeTab !== 'all'
                              ? 'No users match your search criteria.'
                              : 'No users found.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((userData) => {
                      const name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
                      const userRoles = userData.roles || ['student'];
                      const selected = selectedUsers.includes(userData.id);
                      return (
                        <TableRow key={userData.id} className={cn(selected && 'bg-ss-lav-chip/60')}>
                          <TableCell className="text-left">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selected}
                                onCheckedChange={(checked) => handleSelectUser(userData.id, checked as boolean)}
                                aria-label={`Select ${name || 'user'}`}
                              />
                              <Avatar className="h-9 w-9">
                                <AvatarFallback
                                  className="text-xs font-bold text-white"
                                  style={{ backgroundColor: avatarColor(userData.id) }}
                                >
                                  {getInitials(userData.first_name, userData.last_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{name || 'Unnamed User'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-left">
                            <div className="flex flex-wrap gap-1.5">
                              {userRoles.map(role => (
                                <Badge key={role} variant={roleBadgeVariant(role)}>
                                  {cap(role)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground tabular-nums">
                            {userData.created_at ? new Date(userData.created_at).toLocaleDateString() : 'Unknown'}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenUserDetails(userData)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenEditUser(userData)}>
                                  <PenSquare className="mr-2 h-4 w-4" />
                                  Edit Roles
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleRequestDelete([userData.id])}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} · {total} user{total === 1 ? '' : 's'}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* View Details Sheet */}
      <Sheet open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
        <SheetContent className="bg-background w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>User Details</SheetTitle>
            <SheetDescription>View detailed information about this user.</SheetDescription>
          </SheetHeader>
          {selectedUser && (
            <div className="mt-6 space-y-1">
              <div className="flex items-center gap-3 pb-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback
                    className="text-base font-bold text-white"
                    style={{ backgroundColor: avatarColor(selectedUser.id) }}
                  >
                    {getInitials(selectedUser.first_name, selectedUser.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">
                    {`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || 'Unnamed User'}
                  </div>
                </div>
              </div>
              {[
                ['Name', `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || 'Unnamed User'],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[80px_1fr] gap-3 py-3 border-t border-border text-sm">
                  <span className="text-muted-foreground font-medium">{k}</span>
                  <span className="break-words">{v}</span>
                </div>
              ))}
              <div className="grid grid-cols-[80px_1fr] gap-3 py-3 border-t border-border text-sm">
                <span className="text-muted-foreground font-medium">Roles</span>
                <span className="flex flex-wrap gap-1.5">
                  {(selectedUser.roles || ['student']).map(role => (
                    <Badge key={role} variant="outline">{cap(role)}</Badge>
                  ))}
                </span>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-3 py-3 border-t border-border text-sm">
                <span className="text-muted-foreground font-medium">Created</span>
                <span>{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : 'Unknown'}</span>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-3 py-3 border-t border-border text-sm">
                <span className="text-muted-foreground font-medium">ID</span>
                <span className="font-mono text-xs text-muted-foreground break-all">{selectedUser.id}</span>
              </div>
              <SheetFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsViewDetailsOpen(false)}>Close</Button>
                <Button
                  onClick={() => { setIsViewDetailsOpen(false); if (selectedUser) handleOpenEditUser(selectedUser); }}
                >
                  Edit Roles
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Roles Sheet (single user) */}
      <Sheet open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <SheetContent className="bg-background w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit User Roles</SheetTitle>
            <SheetDescription>Update the roles for this user.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-4">
            <Label>User Roles</Label>
            <div className="flex flex-col space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="student-role" checked disabled />
                <Label htmlFor="student-role">Student (required)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="instructor-role"
                  checked={updatedRoles.includes('instructor')}
                  onCheckedChange={() => toggleRole('instructor')}
                />
                <Label htmlFor="instructor-role">Instructor</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="admin-role"
                  checked={updatedRoles.includes('admin')}
                  onCheckedChange={() => toggleRole('admin')}
                />
                <Label htmlFor="admin-role">Administrator</Label>
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateUserRoles}>Update Roles</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Bulk Role Update Sheet */}
      <Sheet open={isBulkRoleOpen} onOpenChange={setIsBulkRoleOpen}>
        <SheetContent className="bg-background w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Update Roles for {selectedUsers.length} User(s)</SheetTitle>
            <SheetDescription>
              Select the roles to apply to all selected users. This will replace their current roles.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-4">
            <Label>Roles</Label>
            <div className="flex flex-col space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox checked disabled />
                <Label>Student (required)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={bulkRoles.includes('instructor')}
                  onCheckedChange={() => toggleBulkRole('instructor')}
                />
                <Label>Instructor</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={bulkRoles.includes('admin')}
                  onCheckedChange={() => toggleBulkRole('admin')}
                />
                <Label>Administrator</Label>
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsBulkRoleOpen(false)} disabled={isBulkUpdating}>
              Cancel
            </Button>
            <Button onClick={handleConfirmBulkRoleUpdate} disabled={isBulkUpdating}>
              {isBulkUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Apply Roles'
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Permanently Delete {deleteTargetIds.length === 1 ? 'User' : `${deleteTargetIds.length} Users`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This action <strong>cannot be undone</strong>. This will permanently delete
                  {deleteTargetIds.length === 1 ? (
                    <> <strong>{deleteTargetNames[0]}</strong></>
                  ) : (
                    <> <strong>{deleteTargetIds.length} users</strong></>
                  )} and remove all associated data including profile, roles, enrollments, and submissions.
                </p>
                <div className="pt-2">
                  <Label htmlFor="delete-confirm" className="text-sm font-medium">
                    Type <strong>DELETE</strong> to confirm:
                  </Label>
                  <Input
                    id="delete-confirm"
                    className="mt-1"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Permanently'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminUsers;
