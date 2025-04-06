
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Filter } from 'lucide-react';
import { mockService } from '@/lib/mockData';
import { useState } from 'react';

const AdminEnrollments = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // In a real app, this would be a proper enrollment list with user and course info
  const users = mockService.getAllUsers();
  const courses = mockService.getAllCourses();
  
  // Create mock enrollments data
  const enrollments = users.flatMap(user => 
    (user.enrolledCourses || []).map(courseId => {
      const course = courses.find(c => c.id === courseId);
      return {
        id: `${user.id}-${courseId}`,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        courseId,
        courseTitle: course?.title || 'Unknown Course',
        enrollmentDate: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
        progress: Math.floor(Math.random() * 101),
        status: Math.random() > 0.3 ? 'Active' : (Math.random() > 0.5 ? 'Completed' : 'On Hold')
      };
    })
  );
  
  // Filter enrollments based on search term
  const filteredEnrollments = enrollments.filter(enrollment => 
    enrollment.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    enrollment.courseTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Course Enrollments</h1>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search enrollments..."
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
        
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-xl">Enrollments</CardTitle>
            <CardDescription>
              View all student enrollments across courses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Enrollment Date</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnrollments.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">{enrollment.userName}</TableCell>
                    <TableCell>{enrollment.userEmail}</TableCell>
                    <TableCell>{enrollment.courseTitle}</TableCell>
                    <TableCell>{new Date(enrollment.enrollmentDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-200 h-2 w-24 rounded-full overflow-hidden">
                          <div 
                            className="bg-primary h-full" 
                            style={{ width: `${enrollment.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs">{enrollment.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        enrollment.status === 'Active' ? 'outline' :
                        enrollment.status === 'Completed' ? 'default' : 'secondary'
                      }>
                        {enrollment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminEnrollments;
