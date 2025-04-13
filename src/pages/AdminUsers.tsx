import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Search, MoreHorizontal, Filter, UserPlus, Download, Eye, PenSquare, KeyRound, Trash2, Loader2
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UserData {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role?: string;
  roles?: string[];
  enrolledCourses?: string[];
  created_at?: string;
}

const AdminUsers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    roles: ['student'] as string[]
  });
  const [updatedRoles, setUpdatedRoles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();
  
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        
        if (authError) {
          throw authError;
        }
        
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*');
        
        if (profilesError) {
          throw profilesError;
        }
        
        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select('user_id, course_id');
        
        if (enrollmentsError) {
          throw enrollmentsError;
        }
        
        const enrollmentsByUser: Record<string, string[]> = {};
        enrollments?.forEach(enrollment => {
          if (!enrollmentsByUser[enrollment.user_id]) {
            enrollmentsByUser[enrollment.user_id] = [];
          }
          enrollmentsByUser[enrollment.user_id].push(enrollment.course_id);
        });
        
        const userData = authData.users.map(user => {
          const profile = profiles?.find(p => p.id === user.id);
          
          let roles = ['student'];
          if (profile?.roles) {
            roles = Array.isArray(profile.roles) 
              ? profile.roles 
              : profile.roles.split(',').map(r => r.trim());
            
            if (!roles.includes('student')) {
              roles.push('student');
            }
          }
          
          const highestRole = getHighestRole(roles);
          
          return {
            id: user.id,
            email: user.email || '',
            name: profile 
              ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() 
              : user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown',
            avatar: profile?.avatar_url || user.user_metadata?.avatar_url,
            role: highestRole,
            roles: roles,
            enrolledCourses: enrollmentsByUser[user.id] || [],
            created_at: user.created_at
          };
        });
        
        setUsers(userData);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({
          title: 'Error',
          description: 'Failed to load users. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [toast]);
  
  const getHighestRole = (roles: string[] = ['student']): string => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('instructor')) return 'instructor';
    return 'student';
  };
  
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'instructor':
        return 'secondary';
      default:
        return 'outline';
    }
  };
  
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && user.role === activeTab;
  });
  
  const handleOpenUserDetails = (user: UserData) => {
    setSelectedUser(user);
    setIsViewDetailsOpen(true);
  };
  
  const handleOpenEditUser = (user: UserData) => {
    setSelectedUser(user);
    setUpdatedRoles(user.roles || ['student']);
    setIsEditUserOpen(true);
  };
  
  const handleOpenResetPassword = (user: UserData) => {
    setSelectedUser(user);
    setIsResetPasswordOpen(true);
  };
  
  const handleOpenDeleteUser = (user: UserData) => {
    setSelectedUser(user);
    setIsDeleteUserOpen(true);
  };
  
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase.auth.admin.deleteUser(selectedUser.id);
      
      if (error) throw error;
      
      setUsers(users.filter(user => user.id !== selectedUser.id));
      setIsDeleteUserOpen(false);
      
      toast({
        title: 'User Deleted',
        description: `${selectedUser.name} has been removed from the system.`,
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddUser = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.admin.createUser({
        email: newUser.email,
        password: Math.random().toString(36).substring(2, 10),
        email_confirm: true,
        user_metadata: {
          name: newUser.name
        }
      });
      
      if (error) throw error;
      
      if (data.user) {
        const [firstName, ...lastNameParts] = newUser.name.split(' ');
        const lastName = lastNameParts.join(' ');
        
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            first_name: firstName,
            last_name: lastName,
            roles: newUser.roles
          });
        
        if (profileError) throw profileError;
        
        const newUserData: UserData = {
          id: data.user.id,
          email: data.user.email || newUser.email,
          name: newUser.name,
          roles: newUser.roles,
          role: getHighestRole(newUser.roles),
          enrolledCourses: [],
          created_at: new Date().toISOString()
        };
        
        setUsers([...users, newUserData]);
        setNewUser({ name: '', email: '', roles: ['student'] });
        setIsAddUserOpen(false);
        
        toast({
          title: 'User Added',
          description: `${newUser.name} has been added to the system.`,
        });
      }
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add user.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateUserRoles = async () => {
    if (!selectedUser) return;
    
    try {
      setLoading(true);
      
      if (!updatedRoles.includes('student')) {
        updatedRoles.push('student');
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({ roles: updatedRoles })
        .eq('id', selectedUser.id);
      
      if (error) throw error;
      
      setUsers(users.map(user => {
        if (user.id === selectedUser.id) {
          return {
            ...user,
            roles: updatedRoles,
            role: getHighestRole(updatedRoles)
          };
        }
        return user;
      }));
      
      setIsEditUserOpen(false);
      
      toast({
        title: 'User Updated',
        description: `Roles for ${selectedUser.name} have been updated.`,
      });
      
      if (selectedUser.email === 'teneika.askew@gmail.com' && !updatedRoles.includes('admin')) {
        toast({
          title: 'Warning',
          description: 'Teneika Askew should have admin role. Please add it back.',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Error updating user roles:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user roles.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleResetPassword = async () => {
    if (!selectedUser) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
      
      setIsResetPasswordOpen(false);
      
      toast({
        title: 'Password Reset Email Sent',
        description: `A password reset link has been sent to ${selectedUser.email}.`,
      });
    } catch (error: any) {
      console.error('Error sending password reset:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send password reset email.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleExportUsers = () => {
    toast({
      title: 'Export Started',
      description: 'User data is being prepared for export.',
    });
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
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
  
  const toggleNewUserRole = (role: string) => {
    if (role === 'student') return;
    
    setNewUser(prev => {
      const updatedRoles = prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role];
      
      return {
        ...prev,
        roles: updatedRoles
      };
    });
  };
  
  useEffect(() => {
    const setAdminForTeneika = async () => {
      try {
        const teneikaUser = users.find(user => user.email === 'teneika.askew@gmail.com');
        
        if (teneikaUser && (!teneikaUser.roles?.includes('admin'))) {
          console.log('Setting admin role for Teneika Askew');
          
          const updatedRoles = [...(teneikaUser.roles || []), 'admin'];
          if (!updatedRoles.includes('student')) {
            updatedRoles.push('student');
          }
          
          const { error } = await supabase
            .from('profiles')
            .update({ roles: updatedRoles })
            .eq('id', teneikaUser.id);
          
          if (error) throw error;
          
          setUsers(users.map(user => {
            if (user.id === teneikaUser.id) {
              return {
                ...user,
                roles: updatedRoles,
                role: 'admin'
              };
            }
            return user;
          }));
          
          toast({
            title: 'Admin Role Added',
            description: 'Teneika Askew has been granted admin privileges.',
          });
        }
      } catch (error) {
        console.error('Error setting admin role:', error);
      }
    };
    
    if (users.length > 0) {
      setAdminForTeneika();
    }
  }, [users, toast]);
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportUsers}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={() => setIsAddUserOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search users..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">All Users</TabsTrigger>
            <TabsTrigger value="student">Students</TabsTrigger>
            <TabsTrigger value="instructor">Instructors</TabsTrigger>
            <TabsTrigger value="admin">Admins</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="space-y-4">
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-xl">Users</CardTitle>
                <CardDescription>
                  Manage your users, their roles, and permissions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Loading users...</span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Enrolled Courses</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            No users found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <Checkbox />
                            </TableCell>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={getRoleBadgeVariant(user.role || 'student')}>
                                {user.role?.charAt(0).toUpperCase() + user.role?.slice(1) || 'Student'}
                              </Badge>
                              {user.roles && user.roles.length > 1 && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  +{user.roles.length - 1} more
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{user.enrolledCourses?.length || 0}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleOpenUserDetails(user)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenEditUser(user)}>
                                    <PenSquare className="mr-2 h-4 w-4" />
                                    Edit Roles
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenResetPassword(user)}>
                                    <KeyRound className="mr-2 h-4 w-4" />
                                    Reset Password
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleOpenDeleteUser(user)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete User
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Enter the details for the new user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                value={newUser.name} 
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={newUser.email} 
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                placeholder="john.doe@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>User Roles</Label>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="student-role-new" 
                    checked={true} 
                    disabled 
                  />
                  <Label htmlFor="student-role-new" className="font-normal">Student (required)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="instructor-role-new" 
                    checked={newUser.roles.includes('instructor')} 
                    onCheckedChange={() => toggleNewUserRole('instructor')}
                  />
                  <Label htmlFor="instructor-role-new" className="font-normal">Instructor</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="admin-role-new" 
                    checked={newUser.roles.includes('admin')} 
                    onCheckedChange={() => toggleNewUserRole('admin')}
                  />
                  <Label htmlFor="admin-role-new" className="font-normal">Admin</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : 'Add User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Name</h4>
                  <p>{selectedUser.name}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Email</h4>
                  <p>{selectedUser.email}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Primary Role</h4>
                  <Badge variant={getRoleBadgeVariant(selectedUser.role || 'student')}>
                    {selectedUser.role?.charAt(0).toUpperCase() + selectedUser.role?.slice(1) || 'Student'}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">All Roles</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedUser.roles?.map(role => (
                      <Badge key={role} variant="outline" className="text-xs">
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Enrolled Courses</h4>
                  <p>{selectedUser.enrolledCourses?.length || 0}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Joined</h4>
                  <p>{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'Unknown'}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Roles</DialogTitle>
            <DialogDescription>
              Manage the roles assigned to {selectedUser?.name}.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="student-role" 
                    checked={true} 
                    disabled 
                  />
                  <Label htmlFor="student-role" className="font-normal">Student (required)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="instructor-role" 
                    checked={updatedRoles.includes('instructor')} 
                    onCheckedChange={() => toggleRole('instructor')}
                  />
                  <Label htmlFor="instructor-role" className="font-normal">Instructor</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="admin-role" 
                    checked={updatedRoles.includes('admin')} 
                    onCheckedChange={() => toggleRole('admin')}
                  />
                  <Label htmlFor="admin-role" className="font-normal">Admin</Label>
                </div>
              </div>
              {selectedUser.email === 'teneika.askew@gmail.com' && !updatedRoles.includes('admin') && (
                <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm">
                  Warning: Teneika Askew should have admin role. Please consider keeping it enabled.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleUpdateUserRoles} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : 'Update Roles'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Send a password reset link to the user's email.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <p>
                A password reset link will be sent to <strong>{selectedUser.email}</strong>.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : 'Send Reset Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              account and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              className="bg-destructive text-destructive-foreground"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminUsers;
