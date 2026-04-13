
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Edit, Trash2, Plus, FilterX, Download, Filter, Users, Award, Eye, PlusCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCoursesManagement } from '@/hooks/useCoursesManagement';
import { useCourseEnrollments } from '@/hooks/useCourseEnrollments';
import { IssueCertificatesModal } from '@/components/admin/IssueCertificatesModal';

import { Course } from '@/types/course';
import { Spinner } from '@/components/ui/spinner';

export default function AdminCourses() {
  const {
    courses,
    loading: coursesLoading,
    saveCourse,
    createCourse,
    updateCourse,
    deleteCourse,
    publishCourse,
    unpublishCourse,
  } = useCoursesManagement();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('courses');
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleEditCourse = (course: Course) => {
    navigate(`/courses/${course.id}/management`);
  };

  const handleDeleteCourse = async (course: Course) => {
    const success = await deleteCourse(course.id);
    if (success) {
      toast({
        title: 'Course Deleted',
        description: `"${course.title}" has been successfully removed.`,
      });
    }
  };

  const handleAddCourse = async () => {
    try {
      const newCourse = await createCourse({
        title: 'New Course',
        description: 'Course description',
        category: 'Data Science',
        level: 'Beginner',
        duration: '',
        enrollment_status: 'open',
        status: 'draft',
        published: false,
      });

      if (newCourse?.id) {
        navigate(`/courses/${newCourse.id}/management`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create new course',
        variant: 'destructive',
      });
    }
  };


  const handleTogglePublish = async (course: Course) => {
    if (course.published) {
      await unpublishCourse(course.id);
    } else {
      await publishCourse(course.id);
    }
  };

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = 
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'published' && course.published) || 
      (statusFilter === 'draft' && !course.published);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const categories = [...new Set(courses.map(course => course.category))];

  if (coursesLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Courses & Enrollments</h1>
            <p className="text-muted-foreground mt-2">
              Create, edit, and manage your educational courses and track student enrollments.
            </p>
          </div>
          <Button onClick={handleAddCourse} className="bg-insightBlue hover:bg-insightBlue/90">
            <Plus className="mr-2 h-4 w-4" /> Add Course
          </Button>
        </div>


        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="enrollments">
              <Users className="mr-2 h-4 w-4" />
              Enrollments
            </TabsTrigger>
            <TabsTrigger value="certificates">
              <Award className="mr-2 h-4 w-4" />
              Certificates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="courses">
            <Card>
              <CardHeader>
                <CardTitle>Courses ({filteredCourses.length})</CardTitle>
                <CardDescription>
                  View and manage all courses available on the platform.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search courses..." 
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all') && (
                    <div className="flex justify-end">
                      <Button 
                        variant="ghost" 
                        className="h-8 px-2 lg:px-3" 
                        onClick={clearFilters}
                      >
                        <FilterX className="mr-2 h-4 w-4" />
                        Clear filters
                      </Button>
                    </div>
                  )}

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Students</TableHead>
                          <TableHead>Instructor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCourses.length > 0 ? (
                          filteredCourses.map((course) => (
                            <TableRow key={course.id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  {course.title}
                                  <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                                    {course.description}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {course.category}
                                </Badge>
                              </TableCell>
                              <TableCell>{course.level}</TableCell>
                              <TableCell>{course.enrollmentCount || 0}</TableCell>
                              <TableCell>
                                {course.instructor ? (
                                  <span>{course.instructor.name}</span>
                                ) : (
                                  <span className="text-muted-foreground">Unassigned</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={
                                    course.status === 'published' ? "default" : 
                                    course.status === 'draft' ? "secondary" : 
                                    "outline"
                                  }
                                  className="capitalize"
                                >
                                  {course.status || 'Draft'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <span className="sr-only">Open menu</span>
                                      <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        width="24" 
                                        height="24" 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        className="h-4 w-4"
                                      >
                                        <circle cx="12" cy="12" r="1" />
                                        <circle cx="12" cy="5" r="1" />
                                        <circle cx="12" cy="19" r="1" />
                                      </svg>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleEditCourse(course)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleTogglePublish(course)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      {course.published ? 'Unpublish' : 'Publish'}
                                    </DropdownMenuItem>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will permanently delete the course "{course.title}". This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction 
                                            onClick={() => handleDeleteCourse(course)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                              No courses found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="enrollments">
            <EnrollmentsTab courses={courses} />
          </TabsContent>

          <TabsContent value="certificates">
            <CertificatesTab courses={courses} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// Separate component for enrollments tab to keep the main component focused
function EnrollmentsTab({ courses }: { courses: Course[] }) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { enrollments, stats, loading } = useCourseEnrollments(selectedCourseId);

  const filteredEnrollments = enrollments.filter(enrollment => 
    enrollment.user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    enrollment.user?.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Student Enrollments
        </CardTitle>
        <CardDescription>
          View and manage student enrollments for courses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map(course => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search students..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stats.enrollment_count}</div>
                  <p className="text-xs text-muted-foreground">Total Enrollments</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stats.completion_rate}%</div>
                  <p className="text-xs text-muted-foreground">Average Completion</p>
                </CardContent>
              </Card>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Enrollment Date</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnrollments.length > 0 ? (
                    filteredEnrollments.map((enrollment) => (
                      <TableRow key={enrollment.id}>
                        <TableCell className="font-medium">
                          {enrollment.user ? 
                            `${enrollment.user.first_name} ${enrollment.user.last_name}` : 
                            'Unknown User'
                          }
                        </TableCell>
                        <TableCell>
                          {new Date(enrollment.enrolled_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="bg-slate-200 h-2 w-24 rounded-full overflow-hidden">
                              <div 
                                className="bg-primary h-full" 
                                style={{ width: `${enrollment.completion_status}%` }}
                              ></div>
                            </div>
                            <span className="text-xs">{enrollment.completion_status}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            enrollment.completion_status >= 100 ? 'default' :
                            enrollment.completion_status > 0 ? 'outline' : 'secondary'
                          }>
                            {enrollment.completion_status >= 100 ? 'Completed' :
                             enrollment.completion_status > 0 ? 'In Progress' : 'Not Started'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No enrollments found for this course.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Certificates tab component
function CertificatesTab({ courses }: { courses: Course[] }) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Mock certificates data - in real implementation, this would come from Supabase
  const mockCertificates = [
    {
      id: 'cert-1',
      user_name: 'John Doe',
      user_email: 'john.doe@example.com',
      course_title: courses.find(c => c.id === selectedCourseId)?.title || 'Course',
      issued_at: '2025-01-01',
      verification_code: 'CERT-2025-001',
      certificate_type: 'completion'
    },
    {
      id: 'cert-2',
      user_name: 'Jane Smith',
      user_email: 'jane.smith@example.com',
      course_title: courses.find(c => c.id === selectedCourseId)?.title || 'Course',
      issued_at: '2024-12-15',
      verification_code: 'CERT-2024-045',
      certificate_type: 'achievement'
    }
  ];

  const filteredCertificates = mockCertificates.filter(cert =>
    cert.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleIssueCertificates = (courseId: string, userIds: string[]) => {
    toast({
      title: 'Certificates Issued',
      description: `Successfully issued ${userIds.length} certificates for the selected course.`,
    });
  };

  const handleDownloadCertificate = (certificate: any) => {
    toast({
      title: 'Certificate Downloaded',
      description: `Certificate for ${certificate.user_name} has been downloaded.`,
    });
  };

  const handleRevokeCertificate = (certificate: any) => {
    toast({
      title: 'Certificate Revoked',
      description: `Certificate for ${certificate.user_name} has been revoked.`,
      variant: 'destructive',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Course Certificates
        </CardTitle>
        <CardDescription>
          Manage and issue certificates for course completions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map(course => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
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

            <IssueCertificatesModal onIssueCertificates={handleIssueCertificates}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Issue Certificates
              </Button>
            </IssueCertificatesModal>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{filteredCertificates.length}</div>
                <p className="text-xs text-muted-foreground">Total Certificates</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {filteredCertificates.filter(c => c.certificate_type === 'completion').length}
                </div>
                <p className="text-xs text-muted-foreground">Completion Certificates</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {filteredCertificates.filter(c => c.certificate_type === 'achievement').length}
                </div>
                <p className="text-xs text-muted-foreground">Achievement Certificates</p>
              </CardContent>
            </Card>
          </div>

          {/* Certificates Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Verification Code</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCertificates.length > 0 ? (
                  filteredCertificates.map((certificate) => (
                    <TableRow key={certificate.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{certificate.user_name}</span>
                          <span className="text-sm text-muted-foreground">
                            {certificate.user_email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{certificate.course_title}</TableCell>
                      <TableCell>
                        <Badge variant={
                          certificate.certificate_type === 'achievement' ? 'default' : 'secondary'
                        }>
                          {certificate.certificate_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(certificate.issued_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          {certificate.verification_code}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadCertificate(certificate)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeCertificate(certificate)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No certificates found for this course.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
