
import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EyeIcon, PencilIcon, TrashIcon, Search, UserPlus, Download, FileSpreadsheet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

// Mock user data
const mockUsers = [
  { id: 'user1', name: 'John Doe', email: 'john.doe@example.com', role: 'student', status: 'active', enrolledCourses: 3, completedCourses: 2, lastActive: '2025-04-05T10:30:00Z', dateJoined: '2025-01-15' },
  { id: 'user2', name: 'Jane Smith', email: 'jane.smith@example.com', role: 'student', status: 'active', enrolledCourses: 5, completedCourses: 4, lastActive: '2025-04-06T08:15:00Z', dateJoined: '2025-01-10' },
  { id: 'user3', name: 'Admin User', email: 'admin@example.com', role: 'admin', status: 'active', enrolledCourses: 0, completedCourses: 0, lastActive: '2025-04-06T09:45:00Z', dateJoined: '2024-12-01' },
  { id: 'user4', name: 'Alex Johnson', email: 'alex.j@example.com', role: 'student', status: 'inactive', enrolledCourses: 2, completedCourses: 0, lastActive: '2025-03-15T11:20:00Z', dateJoined: '2025-02-05' },
  { id: 'user5', name: 'Taylor Williams', email: 'taylor.w@example.com', role: 'student', status: 'active', enrolledCourses: 4, completedCourses: 1, lastActive: '2025-04-04T14:10:00Z', dateJoined: '2025-01-20' },
  { id: 'user6', name: 'Sam Brown', email: 'sam.b@example.com', role: 'instructor', status: 'active', enrolledCourses: 0, completedCourses: 0, lastActive: '2025-04-05T16:30:00Z', dateJoined: '2025-01-05' },
  { id: 'user7', name: 'Jordan Lee', email: 'jordan.l@example.com', role: 'student', status: 'active', enrolledCourses: 6, completedCourses: 3, lastActive: '2025-04-06T07:45:00Z', dateJoined: '2025-01-12' },
  { id: 'user8', name: 'Casey Miller', email: 'casey.m@example.com', role: 'student', status: 'pending', enrolledCourses: 1, completedCourses: 0, lastActive: '2025-04-01T09:20:00Z', dateJoined: '2025-03-28' },
];

// Mock enrollment data
const mockEnrollments = [
  { id: 'enr1', userId: 'user1', courseId: 'course1', courseName: 'Introduction to Data Science', enrollmentDate: '2025-01-20', progress: 100, status: 'completed', certificateIssued: true },
  { id: 'enr2', userId: 'user1', courseId: 'course2', courseName: 'Advanced Machine Learning', enrollmentDate: '2025-02-15', progress: 65, status: 'in-progress', certificateIssued: false },
  { id: 'enr3', userId: 'user1', courseId: 'course3', courseName: 'Data Engineering Fundamentals', enrollmentDate: '2025-03-10', progress: 25, status: 'in-progress', certificateIssued: false },
  { id: 'enr4', userId: 'user2', courseId: 'course1', courseName: 'Introduction to Data Science', enrollmentDate: '2025-01-12', progress: 100, status: 'completed', certificateIssued: true },
  { id: 'enr5', userId: 'user2', courseId: 'course2', courseName: 'Advanced Machine Learning', enrollmentDate: '2025-01-25', progress: 100, status: 'completed', certificateIssued: true },
  { id: 'enr6', userId: 'user2', courseId: 'course3', courseName: 'Data Engineering Fundamentals', enrollmentDate: '2025-02-05', progress: 100, status: 'completed', certificateIssued: true },
  { id: 'enr7', userId: 'user2', courseId: 'course4', courseName: 'Business Analytics with Python', enrollmentDate: '2025-03-01', progress: 100, status: 'completed', certificateIssued: true },
  { id: 'enr8', userId: 'user2', courseId: 'course5', courseName: 'Data Visualization Techniques', enrollmentDate: '2025-03-20', progress: 40, status: 'in-progress', certificateIssued: false },
];

// Mock certificates data
const mockCertificates = [
  { id: 'cert1', userId: 'user1', courseId: 'course1', courseName: 'Introduction to Data Science', issueDate: '2025-02-25', downloadUrl: '#' },
  { id: 'cert2', userId: 'user1', courseId: 'course2', courseName: 'Advanced Machine Learning', issueDate: '2025-03-15', downloadUrl: '#' },
  { id: 'cert3', userId: 'user2', courseId: 'course1', courseName: 'Introduction to Data Science', issueDate: '2025-02-20', downloadUrl: '#' },
  { id: 'cert4', userId: 'user2', courseId: 'course2', courseName: 'Advanced Machine Learning', issueDate: '2025-02-28', downloadUrl: '#' },
  { id: 'cert5', userId: 'user2', courseId: 'course3', courseName: 'Data Engineering Fundamentals', issueDate: '2025-03-10', downloadUrl: '#' },
  { id: 'cert6', userId: 'user2', courseId: 'course4', courseName: 'Business Analytics with Python', issueDate: '2025-04-05', downloadUrl: '#' },
];

const AdminUsers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Filter users based on search and filters
  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });
  
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedUsers(new Set(filteredUsers.map(user => user.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };
  
  const handleUserSelection = (userId: string, checked: boolean) => {
    const newSelectedUsers = new Set(selectedUsers);
    if (checked) {
      newSelectedUsers.add(userId);
    } else {
      newSelectedUsers.delete(userId);
    }
    setSelectedUsers(newSelectedUsers);
    setSelectAll(newSelectedUsers.size === filteredUsers.length);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
          <div className="flex gap-2">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
            <Button variant="outline">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          </div>
        </div>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Users</CardTitle>
            <CardDescription>Manage your platform users, enrollments, and certificates.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all-users" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all-users">All Users</TabsTrigger>
                <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
                <TabsTrigger value="certificates">Certificates</TabsTrigger>
              </TabsList>
              
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search users..." 
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="instructor">Instructors</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <TabsContent value="all-users" className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox 
                            checked={selectAll} 
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all users" 
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Courses</TableHead>
                        <TableHead>Date Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedUsers.has(user.id)} 
                                onCheckedChange={(checked) => handleUserSelection(user.id, !!checked)}
                                aria-label={`Select ${user.name}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={user.role === 'admin' ? 'default' : user.role === 'instructor' ? 'secondary' : 'outline'}>
                                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                user.status === 'active' ? 'success' : 
                                user.status === 'inactive' ? 'destructive' : 
                                'outline'
                              }>
                                {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{user.enrolledCourses}</span>
                                <span className="text-xs text-muted-foreground">
                                  {user.completedCourses} completed
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{new Date(user.dateJoined).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon">
                                  <EyeIcon className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon">
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon">
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-6">
                            No users found matching your filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              
              <TabsContent value="enrollments" className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Enrollment Date</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Certificate</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockEnrollments.map((enrollment) => {
                        const user = mockUsers.find(u => u.id === enrollment.userId);
                        return (
                          <TableRow key={enrollment.id}>
                            <TableCell className="font-medium">{user?.name}</TableCell>
                            <TableCell>{enrollment.courseName}</TableCell>
                            <TableCell>{new Date(enrollment.enrollmentDate).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="bg-muted w-24 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-primary h-full"
                                    style={{ width: `${enrollment.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs">{enrollment.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                enrollment.status === 'completed' ? 'success' : 
                                enrollment.status === 'in-progress' ? 'secondary' : 
                                'outline'
                              }>
                                {enrollment.status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {enrollment.certificateIssued ? (
                                <Badge variant="outline" className="bg-green-50">Issued</Badge>
                              ) : (
                                <Badge variant="outline">Not Issued</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon">
                                  <EyeIcon className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon">
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              
              <TabsContent value="certificates" className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockCertificates.map((certificate) => {
                        const user = mockUsers.find(u => u.id === certificate.userId);
                        return (
                          <TableRow key={certificate.id}>
                            <TableCell className="font-medium">{user?.name}</TableCell>
                            <TableCell>{certificate.courseName}</TableCell>
                            <TableCell>{new Date(certificate.issueDate).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm">
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </Button>
                                <Button variant="ghost" size="icon">
                                  <EyeIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminUsers;
