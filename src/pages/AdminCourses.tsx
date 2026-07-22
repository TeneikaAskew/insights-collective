
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Edit, Trash2, Plus, FilterX, Download, Filter, Users, Award, Eye, PlusCircle, BarChart3 } from 'lucide-react';
import { Hint } from '@/components/ui/hint';
import { CourseProgressDashboard } from '@/components/admin/CourseProgressDashboard';
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

  const handleAddCourse = () => {
    // Route into the Teachable-style course builder wizard
    navigate('/courses/new/builder');
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
      <div className="teachable-workspace bg-white -mx-4 md:-mx-6 lg:-mx-8 -my-4 px-4 md:px-8 lg:px-12 py-10 min-h-[calc(100vh-4rem)]">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 pb-6 border-b border-neutral-200">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-2">Admin</p>
              <h1 className="font-display text-4xl md:text-5xl text-neutral-900">Manage courses &amp; enrollments</h1>
              <p className="text-neutral-600 mt-2 max-w-2xl">
                Create courses with the guided builder, publish them, and keep an eye on enrollments and certificates.
              </p>
            </div>
            <Button
              onClick={handleAddCourse}
              className="h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-none"
            >
              <Plus className="mr-2 h-4 w-4" /> New course
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 bg-neutral-100 rounded-full p-1 h-auto">
              <TabsTrigger value="courses" className="rounded-full px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Courses
              </TabsTrigger>
              <TabsTrigger value="enrollments" className="rounded-full px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Users className="mr-2 h-4 w-4" /> Enrollments
              </TabsTrigger>
              <TabsTrigger value="certificates" className="rounded-full px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Award className="mr-2 h-4 w-4" /> Certificates
              </TabsTrigger>
              <TabsTrigger value="progress" className="rounded-full px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <BarChart3 className="mr-2 h-4 w-4" /> Progress
              </TabsTrigger>
            </TabsList>

            <TabsContent value="courses" className="space-y-6">
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Search courses"
                    className="pl-11 h-11 rounded-full border-neutral-300 bg-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-[200px] h-11 rounded-full border-neutral-300 bg-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px] h-11 rounded-full border-neutral-300 bg-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
                {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all') && (
                  <Button variant="ghost" onClick={clearFilters} className="h-11 rounded-full">
                    <FilterX className="mr-2 h-4 w-4" /> Clear
                  </Button>
                )}
              </div>

              {/* Card grid */}
              {filteredCourses.length === 0 ? (
                <div className="text-center py-20 border border-dashed rounded-2xl">
                  <h3 className="font-display text-2xl text-neutral-900 mb-2">No courses yet</h3>
                  <p className="text-neutral-500 mb-4">Get started by creating your first course.</p>
                  <Button
                    onClick={handleAddCourse}
                    className="h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-none"
                  >
                    <Plus className="mr-2 h-4 w-4" /> New course
                  </Button>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCourses.map((course) => (
                    <div
                      key={course.id}
                      className="group rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:border-neutral-900 transition-all"
                    >
                      <button
                        onClick={() => handleEditCourse(course)}
                        className="block w-full text-left"
                      >
                        <div className="aspect-[16/9] bg-neutral-100 overflow-hidden">
                          {(course as any).image_url || (course as any).thumbnail ? (
                            <img
                              src={(course as any).image_url || (course as any).thumbnail}
                              alt={course.title}
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-300">
                              <BookOpenIcon />
                            </div>
                          )}
                        </div>
                        <div className="p-5">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant={course.published ? 'default' : 'secondary'}
                              className={
                                course.published
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0'
                                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-100 border-0'
                              }
                            >
                              {course.published ? 'Published' : 'Draft'}
                            </Badge>
                            {course.category && (
                              <span className="text-[11px] uppercase tracking-[0.15em] text-neutral-500">
                                {course.category}
                              </span>
                            )}
                          </div>
                          <h3 className="font-display text-xl text-neutral-900 mb-2 line-clamp-2 leading-tight">
                            {course.title}
                          </h3>
                          <p className="text-sm text-neutral-600 line-clamp-2 mb-4">
                            {course.description}
                          </p>
                          <div className="flex items-center justify-between text-xs text-neutral-500">
                            <span>{course.enrollmentCount || 0} enrolled</span>
                            <span>{course.instructor?.name || 'Unassigned'}</span>
                          </div>
                        </div>
                      </button>
                      <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCourse(course)}
                          className="rounded-full"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
                        </Button>
                        <div className="flex items-center gap-1">
                          <Hint label={course.published ? 'Hide this course from the catalog' : 'Make this course visible in the catalog'}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTogglePublish(course)}
                              className="rounded-full text-neutral-600"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              {course.published ? 'Unpublish' : 'Publish'}
                            </Button>
                          </Hint>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Hint label="Delete this course permanently">
                                <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </Hint>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this course?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently deletes "{course.title}" and cannot be undone.
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="enrollments">
              <EnrollmentsTab courses={courses} />
            </TabsContent>

            <TabsContent value="certificates">
              <CertificatesTab courses={courses} />
            </TabsContent>

            <TabsContent value="progress">
              <CourseProgressDashboard courses={courses} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

function BookOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}


// Separate component for enrollments tab to keep the main component focused
function EnrollmentsTab({ courses }: { courses: Course[] }) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');

  const { enrollments, stats, loading } = useCourseEnrollments(selectedCourseId);
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true; // no filter → include every enrollment, even ones without a profile row
    const first = enrollment.user?.first_name?.toLowerCase() ?? '';
    const last = enrollment.user?.last_name?.toLowerCase() ?? '';
    return first.includes(term) || last.includes(term);
  });

  const handleDownloadReport = () => {
    const escape = (val: unknown) => {
      const s = String(val ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Student Name', 'Enrolled Date', 'Completion %', 'Status'];
    const rows = filteredEnrollments.map((e) => {
      const name = e.user ? `${e.user.first_name ?? ''} ${e.user.last_name ?? ''}`.trim() : 'Unknown User';
      const pct = e.completion_status ?? 0;
      const status = pct >= 100 ? 'Completed' : pct > 0 ? 'In Progress' : 'Not Started';
      return [name, new Date(e.enrolled_at).toISOString().slice(0, 10), pct, status];
    });
    const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = (selectedCourse?.title || 'course').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.href = url;
    a.download = `${safeTitle}-completion-report.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


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
            <Button
              variant="outline"
              onClick={handleDownloadReport}
              disabled={loading || filteredEnrollments.length === 0}
              data-testid="download-completion-report"
            >
              <Download className="h-4 w-4 mr-2" />
              Download completion report
            </Button>
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

// Certificates tab component — real data from public.certificates.
type CertRow = {
  id: string;
  user_id: string;
  course_id: string;
  certificate_type: string;
  issued_at: string;
  verification_code: string;
  student_name: string;
  student_email: string;
};

function CertificatesTab({ courses }: { courses: Course[] }) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!selectedCourseId) { setCerts([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('certificates')
        .select('id, user_id, course_id, certificate_type, issued_at, verification_code, profiles:user_id(first_name, last_name)')
        .eq('course_id', selectedCourseId)
        .order('issued_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        toast({ title: 'Failed to load certificates', description: error.message, variant: 'destructive' });
        setCerts([]);
      } else {
        setCerts(
          (data || []).map((r: any) => ({
            id: r.id,
            user_id: r.user_id,
            course_id: r.course_id,
            certificate_type: r.certificate_type || 'completion',
            issued_at: r.issued_at,
            verification_code: r.verification_code,
            student_name: `${r.profiles?.first_name || ''} ${r.profiles?.last_name || ''}`.trim() || 'Student',
            student_email: '',
          })),
        );
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedCourseId, toast]);

  const filteredCertificates = certs.filter(cert =>
    cert.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.verification_code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const courseTitle = courses.find(c => c.id === selectedCourseId)?.title || 'Course';

  const handleVerifyLink = (certificate: CertRow) => {
    // Real verification page — the same public route students/employers use.
    window.open(`/verify-certificate/${certificate.verification_code}`, '_blank', 'noopener');
  };

  const handleRevokeCertificate = async (certificate: CertRow) => {
    const { error } = await supabase.from('certificates').delete().eq('id', certificate.id);
    if (error) {
      toast({ title: 'Revoke failed', description: error.message, variant: 'destructive' });
      return;
    }
    setCerts(prev => prev.filter(c => c.id !== certificate.id));
    toast({
      title: 'Certificate revoked',
      description: `Certificate for ${certificate.student_name} has been revoked.`,
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
          Certificates are auto-issued when a student completes every published item in a course. Use this view to review or revoke them.
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
                placeholder="Search by student name or code..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold tabular-nums">{filteredCertificates.length}</div>
                <p className="text-xs text-muted-foreground">Total Certificates</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold tabular-nums">
                  {filteredCertificates.filter(c => c.certificate_type === 'completion').length}
                </div>
                <p className="text-xs text-muted-foreground">Completion Certificates</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold tabular-nums">
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Loading certificates…
                    </TableCell>
                  </TableRow>
                ) : filteredCertificates.length > 0 ? (
                  filteredCertificates.map((certificate) => (
                    <TableRow key={certificate.id}>
                      <TableCell className="font-medium">{certificate.student_name}</TableCell>
                      <TableCell>{courseTitle}</TableCell>
                      <TableCell>
                        <Badge variant={certificate.certificate_type === 'achievement' ? 'default' : 'secondary'}>
                          {certificate.certificate_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(certificate.issued_at).toLocaleDateString()}</TableCell>
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
                            onClick={() => handleVerifyLink(certificate)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Verify
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke this certificate?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This deletes the certificate for {certificate.student_name}. The verification code will stop working.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRevokeCertificate(certificate)}>
                                  Revoke
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No certificates issued for this course yet.
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
