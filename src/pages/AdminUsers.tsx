import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface IssueCertificatesModalProps {
  userId: string;
  userName: string;
}

const IssueCertificatesModal = ({ userId, userName }: IssueCertificatesModalProps) => {
  return (
    <Button variant="outline" size="sm" onClick={() => toast.info(`Would issue certificate to ${userName}`)}>
      Issue Certificate
    </Button>
  );
};

const mockUsers = [
  { 
    id: '1', 
    name: 'John Smith', 
    email: 'john.smith@example.com', 
    role: 'student', 
    status: 'active',
    enrolledCourses: 3,
    completedCourses: 2,
    lastActive: '2023-04-01',
    joinDate: '2022-09-15'
  },
  { 
    id: '2', 
    name: 'Emily Davis', 
    email: 'emily.davis@example.com', 
    role: 'student', 
    status: 'active',
    enrolledCourses: 5,
    completedCourses: 4,
    lastActive: '2023-04-02',
    joinDate: '2022-07-20'
  },
  { 
    id: '3', 
    name: 'Michael Johnson', 
    email: 'michael.johnson@example.com', 
    role: 'instructor', 
    status: 'active',
    enrolledCourses: 0,
    completedCourses: 0,
    lastActive: '2023-04-01',
    joinDate: '2022-04-10'
  },
  { 
    id: '4', 
    name: 'Sarah Williams', 
    email: 'sarah.williams@example.com', 
    role: 'admin', 
    status: 'active',
    enrolledCourses: 0,
    completedCourses: 0,
    lastActive: '2023-04-02',
    joinDate: '2022-03-01'
  },
  { 
    id: '5', 
    name: 'David Brown', 
    email: 'david.brown@example.com', 
    role: 'student', 
    status: 'inactive',
    enrolledCourses: 2,
    completedCourses: 0,
    lastActive: '2023-02-15',
    joinDate: '2022-10-05'
  },
];

const mockEnrollments = [
  { 
    id: '1', 
    userId: '1', 
    userName: 'John Smith',
    courseId: '101', 
    courseName: 'Introduction to Data Science', 
    enrollmentDate: '2022-10-01', 
    progress: 100,
    status: 'completed', 
    certificateIssued: true 
  },
  { 
    id: '2', 
    userId: '1', 
    userName: 'John Smith',
    courseId: '102', 
    courseName: 'Advanced Python for Data Analysis', 
    enrollmentDate: '2022-11-15', 
    progress: 65,
    status: 'in-progress', 
    certificateIssued: false 
  },
  { 
    id: '3', 
    userId: '2', 
    userName: 'Emily Davis',
    courseId: '101', 
    courseName: 'Introduction to Data Science', 
    enrollmentDate: '2022-09-20', 
    progress: 100,
    status: 'completed', 
    certificateIssued: true 
  },
  { 
    id: '4', 
    userId: '2', 
    userName: 'Emily Davis',
    courseId: '103', 
    courseName: 'Data Engineering Fundamentals', 
    enrollmentDate: '2022-12-05', 
    progress: 100,
    status: 'completed', 
    certificateIssued: true 
  },
  { 
    id: '5', 
    userId: '2', 
    userName: 'Emily Davis',
    courseId: '104', 
    courseName: 'Data Visualization with D3.js', 
    enrollmentDate: '2023-01-20', 
    progress: 80,
    status: 'in-progress', 
    certificateIssued: false 
  },
];

const mockCertificates = [
  { 
    id: '1', 
    userId: '1', 
    userName: 'John Smith',
    courseId: '101', 
    courseName: 'Introduction to Data Science', 
    issueDate: '2023-01-10', 
    validUntil: 'Lifetime', 
    certificateId: 'CERT-DS-101-01234' 
  },
  { 
    id: '2', 
    userId: '2', 
    userName: 'Emily Davis',
    courseId: '101', 
    courseName: 'Introduction to Data Science', 
    issueDate: '2022-12-15', 
    validUntil: 'Lifetime', 
    certificateId: 'CERT-DS-101-01235' 
  },
  { 
    id: '3', 
    userId: '2', 
    userName: 'Emily Davis',
    courseId: '103', 
    courseName: 'Data Engineering Fundamentals', 
    issueDate: '2023-02-20', 
    validUntil: 'Lifetime', 
    certificateId: 'CERT-DE-103-01236' 
  },
];

const AdminUsers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [issueCertificateDialogOpen, setIssueCertificateDialogOpen] = useState(false);
  const [massCertificateDialogOpen, setMassCertificateDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');

  const filteredUsers = mockUsers.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUsers(filteredUsers.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleMassIssueCertificates = () => {
    if (selectedCourse && selectedUsers.length > 0) {
      toast.success(`Certificates issued to ${selectedUsers.length} users for the selected course`);
      setMassCertificateDialogOpen(false);
      setSelectedCourse('');
    } else {
      toast.error("Please select a course and at least one user");
    }
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage users, their enrollments, and certificates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setMassCertificateDialogOpen(true)}>
            Mass Issue Certificates
          </Button>
          <Button>Add User</Button>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="px-6 py-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <Input 
                  placeholder="Search users..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="max-w-xs"
                />
                <div className="flex gap-2">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="instructor">Instructor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox 
                          onCheckedChange={(checked) => {
                            if (checked === true) {
                              setSelectedUsers(filteredUsers.map(user => user.id));
                            } else {
                              setSelectedUsers([]);
                            }
                          }}
                          checked={selectedUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Courses</TableHead>
                      <TableHead>Join Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={() => handleSelectUser(user.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'secondary' : 'outline'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.enrolledCourses > 0 ? (
                            <span>
                              {user.completedCourses}/{user.enrolledCourses} completed
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No courses</span>
                          )}
                        </TableCell>
                        <TableCell>{user.joinDate}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                            <IssueCertificatesModal userId={user.id} userName={user.name} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="enrollments" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Course Enrollments</CardTitle>
              <CardDescription>
                View and manage user enrollments across all courses
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockEnrollments.map((enrollment) => (
                      <TableRow key={enrollment.id}>
                        <TableCell className="font-medium">{enrollment.userName}</TableCell>
                        <TableCell>{enrollment.courseName}</TableCell>
                        <TableCell>{enrollment.enrollmentDate}</TableCell>
                        <TableCell>
                          <div className="w-full bg-muted rounded-full h-2 max-w-24">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${enrollment.progress}%` }}
                            />
                          </div>
                          <span className="text-xs">{enrollment.progress}%</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={enrollment.status === 'completed' ? 'default' : 'outline'}>
                            {enrollment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {enrollment.certificateIssued ? (
                            <Badge variant="outline">Issued</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted">Not Issued</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="certificates" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Issued Certificates</CardTitle>
              <CardDescription>
                View and manage all certificates issued to users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Certificate ID</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockCertificates.map((certificate) => (
                      <TableRow key={certificate.id}>
                        <TableCell className="font-medium">{certificate.certificateId}</TableCell>
                        <TableCell>{certificate.userName}</TableCell>
                        <TableCell>{certificate.courseName}</TableCell>
                        <TableCell>{certificate.issueDate}</TableCell>
                        <TableCell>{certificate.validUntil}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                            <Button variant="outline" size="sm">
                              Revoke
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Dialog open={massCertificateDialogOpen} onOpenChange={setMassCertificateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mass Issue Certificates</DialogTitle>
            <DialogDescription>
              Issue certificates to multiple users who have completed a course.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="101">Introduction to Data Science</SelectItem>
                  <SelectItem value="102">Advanced Python for Data Analysis</SelectItem>
                  <SelectItem value="103">Data Engineering Fundamentals</SelectItem>
                  <SelectItem value="104">Data Visualization with D3.js</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="rounded-md border p-4 max-h-60 overflow-y-auto mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Checkbox 
                    id="select-all"
                    checked={selectedUsers.length > 0 && selectedUsers.length === mockUsers.length}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        setSelectedUsers(mockUsers.map(user => user.id));
                      } else {
                        setSelectedUsers([]);
                      }
                    }}
                  />
                  <label htmlFor="select-all" className="font-medium">Select All Users</label>
                </div>
                
                <div className="space-y-2">
                  {mockUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-2">
                      <Checkbox 
                        id={`user-${user.id}`}
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={() => handleSelectUser(user.id)}
                      />
                      <label htmlFor={`user-${user.id}`} className="flex-1">
                        {user.name} ({user.email})
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMassCertificateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMassIssueCertificates}>
              Issue Certificates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminUsers;
