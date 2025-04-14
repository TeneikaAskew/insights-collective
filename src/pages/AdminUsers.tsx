
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
import { useAdminUsers } from '@/hooks/useAdminUsers';

interface UserData {
  id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role?: string;
  roles?: string[];
  providers?: string[];
  created_at?: string;
  last_sign_in_at?: string;
}

const AdminUsers = () => {
  const [searchTerm, setSearchTerm] = useState('');
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
  
  const { 
    users, 
    loading, 
    fetchUsers, 
    updateUserRole, 
    deleteUser: deleteUserFn, 
    resetUserPassword 
  } = useAdminUsers();
  
  useEffect(() => {
    fetchUsers();
  }, []);
  
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
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const matchesSearch = 
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
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
      const result = await deleteUserFn(selectedUser.id);
      
      if (!result.success) throw new Error(result.error);
      
      setIsDeleteUserOpen(false);
      
      toast({
        title: 'User Deleted',
        description: `User has been removed from the system.`,
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user.',
        variant: 'destructive'
      });
    }
  };
  
  const handleAddUser = async () => {
    try {
      setIsAddUserOpen(false);
      
      toast({
        title: 'Add User Not Implemented',
        description: `Creating users through the admin panel isn't supported. Users must register through the sign-up page.`,
        variant: 'destructive'
      });
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add user.',
        variant: 'destructive'
      });
    }
  };
  
  const handleUpdateUserRoles = async () => {
    if (!selectedUser) return;
    
    try {
      if (!updatedRoles.includes('student')) {
        updatedRoles.push('student');
      }
      
      const result = await updateUserRole(selectedUser.id, updatedRoles);
      
      if (!result.success) throw new Error(result.error);
      
      setIsEditUserOpen(false);
      
      toast({
        title: 'User Updated',
        description: `Roles have been updated.`,
      });
    } catch (error: any) {
      console.error('Error updating user roles:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user roles.',
        variant: 'destructive'
      });
    }
  };
  
  const handleResetPassword = async () => {
    if (!selectedUser) return;
    
    try {
      const result = await resetUserPassword(selectedUser.email);
      
      if (!result.success) throw new Error(result.error);
      
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
    }
  };
  
  const handleExportUsers = () => {
    try {
      // Create CSV string
      const headers = "ID,Name,Email,Role,Created At,Last Sign In\n";
      const csvData = filteredUsers.map(user => {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
        const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'N/A';
        return `"${user.id}","${name}","${user.email}","${user.role}","${createdAt}","${lastSignIn}"`;
      }).join('\n');
      
      const csvContent = `data:text/csv;charset=utf-8,${headers}${csvData}`;
      const encodedUri = encodeURI(csvContent);
      
      // Create a link and trigger download
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "users.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'Export Completed',
        description: 'User data has been exported to CSV.',
      });
    } catch (error) {
      console.error('Error exporting users:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export user data.',
        variant: 'destructive'
      });
    }
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

  // Ensure admin for specific users like Teneika
  useEffect(() => {
    const checkAndUpdateAdmin = async () => {
      // Find Teneika's account or any other email that should always be admin
      const teneikaUser = users.find(user => 
        user.email === 'teneika.askew@gmail.com' && 
        (!user.roles?.includes('admin'))
      );
      
      if (teneikaUser) {
        console.log('Ensuring admin role for Teneika Askew');
        
        const updatedRoles = [...(teneikaUser.roles || []), 'admin'];
        if (!updatedRoles.includes('student')) {
          updatedRoles.push('student');
        }
        
        await updateUserRole(teneikaUser.id, updatedRoles);
        
        toast({
          title: 'Admin Role Added',
          description: 'Teneika Askew has been granted admin privileges.',
        });
      }
    };
    
    if (users.length > 0 && !loading) {
      checkAndUpdateAdmin();
    }
  }, [users, loading]);
  
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
                        <TableHead>Joined</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center">
                            No users found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => {
                          const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                          return (
                            <TableRow key={user.id}>
                              <TableCell>
                                <Checkbox />
                              </TableCell>
                              <TableCell className="font-medium">{name || 'Unnamed User'}</TableCell>
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
                              <TableCell>
                                {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                              </TableCell>
                              <TableCell>
                                {user.last_sign_in_at 
                                  ? new Date(user.last_sign_in_at).toLocaleDateString() 
                                  : 'Never'}
                              </TableCell>
                              <TableCell>
                                {user.providers && user.providers.length > 0
                                  ? user.providers.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
                                  : 'Email'}
                              </TableCell>
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
                          );
                        })
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
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser}>Add User</Button>
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
                  <p>{`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || 'Not provided'}</p>
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
                  <h4 className="text-sm font-medium text-muted-foreground">Provider</h4>
                  <p>
                    {selectedUser.providers && selectedUser.providers.length > 0
                      ? selectedUser.providers.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
                      : 'Email'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Joined</h4>
                  <p>{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'Unknown'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Last Sign-In</h4>
                  <p>
                    {selectedUser.last_sign_in_at 
                      ? new Date(selectedUser.last_sign_in_at).toLocaleDateString() 
                      : 'Never'}
                  </p>
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
              Manage the roles assigned to {selectedUser ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.email : ''}.
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
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateUserRoles}>Update Roles</Button>
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
            <Button variant="outline" onClick={() => setIsResetPasswordOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword}>Send Reset Link</Button>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminUsers;
