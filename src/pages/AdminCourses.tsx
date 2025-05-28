import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Edit, Trash2, Plus, FilterX, Download, Filter, Users, Badge as BadgeIcon, Eye, PlusCircle } from 'lucide-react';
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
import CourseEditModal from '@/components/course/CourseEditModal';
import { IssueCertificatesModal } from '@/components/admin/IssueCertificatesModal';
import { mockService } from '@/lib/mockData';

const mockCourses = [
  {
    id: '1',
    title: 'Introduction to Data Science',
    description: 'A comprehensive beginner guide to data science fundamentals.',
    category: 'Data Engineering',
    level: 'Beginner',
    students: 145,
    rating: 4.7,
    published: true,
  },
  {
    id: '2',
    title: 'Machine Learning Fundamentals',
    description: 'Learn the core concepts and algorithms of machine learning.',
    category: 'AI/ML',
    level: 'Intermediate',
    students: 98,
    rating: 4.5,
    published: true,
  },
  {
    id: '3',
    title: 'Advanced SQL for Data Analysis',
    description: 'Master complex SQL queries for data analytics.',
    category: 'Analytics',
    level: 'Advanced',
    students: 72,
    rating: 4.6,
    published: false,
  },
  {
    id: '4',
    title: 'Data Visualization with Python',
    description: 'Create compelling visualizations using Python libraries.',
    category: 'Analytics',
    level: 'Intermediate',
    students: 112,
    rating: 4.8,
    published: true,
  },
  {
    id: '5',
    title: 'Big Data Processing with Spark',
    description: 'Learn how to process large datasets efficiently with Apache Spark.',
    category: 'Data Engineering',
    level: 'Advanced',
    students: 65,
    rating: 4.4,
    published: true,
  },
  {
    id: '6',
    title: 'Business Intelligence with Power BI',
    description: 'Create interactive reports and dashboards with Power BI.',
    category: 'Business Intelligence',
    level: 'Beginner',
    students: 88,
    rating: 4.3,
    published: true,
  },
  {
    id: '7',
    title: 'Deep Learning Fundamentals',
    description: 'Introduction to neural networks and deep learning concepts.',
    category: 'AI/ML',
    level: 'Intermediate',
    students: 55,
    rating: 4.9,
    published: false,
  },
];

export default function AdminCourses() {
  const [courses, setCourses] = useState(mockCourses);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [publishedFilter, setPublishedFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('courses');
  const [enrollmentSearchTerm, setEnrollmentSearchTerm] = useState('');
  const [certificateSearchTerm, setCertificateSearchTerm] = useState('');
  const { toast } = useToast();

  // Create mock enrollments data for the enrollments tab
  const users = mockService.getAllUsers();
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

  const handleEditCourse = (course: any) => {
    setCourseToEdit(course);
    setIsModalOpen(true);
  };

  const handleDeleteCourse = (id: string) => {
    setCourses(courses.filter(course => course.id !== id));
    toast({
      title: 'Course Deleted',
      description: 'The course has been successfully removed.',
    });
  };

  const handleAddCourse = () => {
    setCourseToEdit(null);
    setIsModalOpen(true);
  };

  const handleSaveCourse = (course: any) => {
    if (course.id) {
      setCourses(courses.map(c => c.id === course.id ? { ...c, ...course } : c));
      toast({
        title: 'Course Updated',
        description: 'The course has been successfully updated.',
      });
    } else {
      const newCourse = {
        ...course,
        id: Date.now().toString(),
        students: 0,
        rating: 0,
        published: false,
        imageUrl: course.imageUrl || 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8fHx8fHx8MTY4MTY5ODY2OA&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=1080'
      };
      setCourses([...courses, newCourse]);
      toast({
        title: 'Course Added',
        description: 'The course has been successfully added.',
      });
    }
    setIsModalOpen(false);
  };

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = 
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
    
    const matchesPublished = 
      publishedFilter === 'all' || 
      (publishedFilter === 'published' && course.published) || 
      (publishedFilter === 'draft' && !course.published);
    
    return matchesSearch && matchesCategory && matchesPublished;
  });

  const filteredEnrollments = enrollments.filter(enrollment => 
    enrollment.userName.toLowerCase().includes(enrollmentSearchTerm.toLowerCase()) || 
    enrollment.courseTitle.toLowerCase().includes(enrollmentSearchTerm.toLowerCase())
  );

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

  const filteredCertificates = certificates.filter(certificate => 
    certificate.userName.toLowerCase().includes(certificateSearchTerm.toLowerCase()) || 
    certificate.courseTitle.toLowerCase().includes(certificateSearchTerm.toLowerCase())
  );

  const handleIssueCertificates = (courseId: string, userIds: string[]) => {
    toast({
      title: 'Certificates Issued',
      description: `Successfully issued ${userIds.length} certificates for the selected course.`,
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setPublishedFilter('all');
  };

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

        <CourseEditModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveCourse}
          course={courseToEdit}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="enrollments">
              <Users className="mr-2 h-4 w-4" />
              Enrollments
            </TabsTrigger>
            <TabsTrigger value="certificates">
              <BadgeIcon className="mr-2 h-4 w-4" />
              Certificates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="courses">
            <Card>
          <CardHeader>
            <CardTitle>Courses</CardTitle>
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
                    <SelectItem value="AI/ML">AI/ML</SelectItem>
                    <SelectItem value="Analytics">Analytics</SelectItem>
                    <SelectItem value="Data Engineering">Data Engineering</SelectItem>
                    <SelectItem value="Business Intelligence">Business Intelligence</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={publishedFilter} onValueChange={setPublishedFilter}>
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
              
              {(searchQuery || categoryFilter !== 'all' || publishedFilter !== 'all') && (
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
                      <TableHead>Rating</TableHead>
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
                          <TableCell>{course.students}</TableCell>
                          <TableCell>{course.rating.toFixed(1)}</TableCell>
                          <TableCell>
                            <Badge variant={course.published ? "default" : "secondary"}>
                              {course.published ? "Published" : "Draft"}
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
                                        onClick={() => handleDeleteCourse(course.id)}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Student Enrollments
                </CardTitle>
                <CardDescription>
                  View and manage all student enrollments across courses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search enrollments by student or course..."
                        className="pl-8"
                        value={enrollmentSearchTerm}
                        onChange={(e) => setEnrollmentSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>Enrollment Date</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEnrollments.length > 0 ? (
                          filteredEnrollments.map((enrollment) => (
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
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                              No enrollments found.
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

          <TabsContent value="certificates">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgeIcon className="h-5 w-5" />
                  Certificates Management
                </CardTitle>
                <CardDescription>
                  View and manage all certificates issued to students for completed courses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search certificates by student or course..."
                        className="pl-8"
                        value={certificateSearchTerm}
                        onChange={(e) => setCertificateSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                      <IssueCertificatesModal onIssueCertificates={handleIssueCertificates}>
                        <Button size="sm" className="bg-insightBlue hover:bg-insightBlue/90">
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Issue Certificates
                        </Button>
                      </IssueCertificatesModal>
                    </div>
                  </div>

                  <div className="rounded-md border">
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
                        {filteredCertificates.length > 0 ? (
                          filteredCertificates.map((certificate) => (
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
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                              No certificates found.
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
        </Tabs>
      </div>
    </AppLayout>
  );
}
