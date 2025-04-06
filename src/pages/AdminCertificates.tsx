
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Filter, PlusCircle, Eye } from 'lucide-react';
import { mockService } from '@/lib/mockData';
import { useState } from 'react';
import { IssueCertificatesModal } from '@/components/admin/IssueCertificatesModal';
import { useToast } from '@/hooks/use-toast';

const AdminCertificates = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  // In a real app, this would come from the database
  const users = mockService.getAllUsers();
  const courses = mockService.getAllCourses();
  
  // Create mock certificates data
  const certificates = users.flatMap(user => 
    (user.enrolledCourses || []).slice(0, Math.floor(Math.random() * 2) + 1).map(courseId => {
      const course = courses.find(c => c.id === courseId);
      return {
        id: `cert-${user.id}-${courseId}`,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        courseId,
        courseTitle: course?.title || 'Unknown Course',
        issueDate: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
        certificateUrl: '#'
      };
    })
  );
  
  // Filter certificates based on search term
  const filteredCertificates = certificates.filter(certificate => 
    certificate.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    certificate.courseTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleIssueCertificates = (courseId: string, userIds: string[]) => {
    toast({
      title: 'Certificates Issued',
      description: `Successfully issued ${userIds.length} certificates for the selected course.`,
    });
  };
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Certificates</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <IssueCertificatesModal onIssueCertificates={handleIssueCertificates}>
              <Button size="sm">
                <PlusCircle className="h-4 w-4 mr-2" />
                Issue Certificates
              </Button>
            </IssueCertificatesModal>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search certificates..."
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
            <CardTitle className="text-xl">Issued Certificates</CardTitle>
            <CardDescription>
              View all certificates issued to students for completed courses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certificate ID</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCertificates.map((certificate) => (
                  <TableRow key={certificate.id}>
                    <TableCell className="font-medium">{certificate.id}</TableCell>
                    <TableCell>{certificate.userName}</TableCell>
                    <TableCell>{certificate.courseTitle}</TableCell>
                    <TableCell>{new Date(certificate.issueDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
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

export default AdminCertificates;
