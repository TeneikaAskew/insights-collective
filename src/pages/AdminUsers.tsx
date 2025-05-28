
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
  Search, MoreHorizontal, Filter, Download, Eye, PenSquare, Loader2
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
  created_at?: string;
  last_sign_in_at?: string;
}

const AdminUsers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [updatedRoles, setUpdatedRoles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();
  
  const { 
    users, 
    loading, 
    error,
    fetchUsers, 
    updateUserRole
  } = useAdminUsers();
  
  useEffect(() => {
    console.log('[AdminUsers] Component mounted, fetching users...');
    fetchUsers();
  }, []);

  useEffect(() => {
    console.log('[AdminUsers] Users state updated:', users);
    console.log('[AdminUsers] Loading state:', loading);
    console.log('[AdminUsers] Error state:', error);
  }, [users, loading, error]);
  
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
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
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

  console.log('[AdminUsers] Rendering with users:', users.length, 'loading:', loading, 'error:', error);
  
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
                ) : error ? (
                  <div className="flex flex-col justify-center items-center py-8">
                    <p className="text-destructive mb-4">Error loading users: {error}</p>
                    <Button onClick={fetchUsers} variant="outline">
                      Retry
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            {users.length === 0 ? 'No users found.' : 'No users match your search criteria.'}
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

      {/* View Details Dialog */}
      <Dialog open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View detailed information about this user.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-medium">Name:</Label>
                <div className="col-span-3">
                  {`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || 'Unnamed User'}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-medium">Roles:</Label>
                <div className="col-span-3">
                  {selectedUser.roles?.map(role => (
                    <Badge key={role} variant="outline" className="mr-1">
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-medium">Created:</Label>
                <div className="col-span-3">
                  {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : 'Unknown'}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Roles Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Roles</DialogTitle>
            <DialogDescription>
              Update the roles for this user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>User Roles</Label>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="student-role"
                    checked={true}
                    disabled={true}
                  />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUserRoles}>
              Update Roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminUsers;
