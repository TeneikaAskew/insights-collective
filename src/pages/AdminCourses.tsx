
import { useMemo, useState } from 'react';
import { downloadCsv } from '@/utils/csv';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import AdminSoftStudio from '@/components/admin/AdminSoftStudio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Edit, Trash2, Plus, FilterX, Download, Users, Award, Eye, BarChart3,
  FileSpreadsheet, GraduationCap, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown, X,
} from 'lucide-react';
import { Hint } from '@/components/ui/hint';
import { CourseProgressDashboard } from '@/components/admin/CourseProgressDashboard';
import { UnifiedExportReport } from '@/components/admin/UnifiedExportReport';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCoursesManagement } from '@/hooks/useCoursesManagement';
import { useCourseEnrollments } from '@/hooks/useCourseEnrollments';
import { useCourseCertificates, type CertRow } from '@/hooks/useCourseCertificates';
import { useCourseRosterStats } from '@/hooks/useCourseRosterStats';
import { getInitials, avatarColor } from '@/utils/adminUiUtils';

import { Course } from '@/types/course';
import { Spinner } from '@/components/ui/spinner';
import CourseErrorState from '@/components/course/CourseErrorState';

type SortKey = 'title' | 'status' | 'enrolled' | 'progress';

export default function AdminCourses() {
  const {
    courses,
    loading: coursesLoading,
    error: coursesError,
    refetch: refetchCourses,
    deleteCourse,
    publishCourse,
    unpublishCourse,
  } = useCoursesManagement();

  const { statsByCourse } = useCourseRosterStats();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('courses');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
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
      setSelectedCourse((cur) => (cur?.id === course.id ? null : cur));
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

  const progressOf = (course: Course): number | null => {
    const s = statsByCourse[course.id];
    return s ? s.avgProgress : null;
  };

  const sortedCourses = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredCourses].sort((a, b) => {
      switch (sortKey) {
        case 'title':
          return a.title.localeCompare(b.title) * dir;
        case 'status':
          return (Number(a.published) - Number(b.published)) * dir;
        case 'enrolled':
          return ((a.enrollmentCount ?? 0) - (b.enrollmentCount ?? 0)) * dir;
        case 'progress':
          return ((progressOf(a) ?? -1) - (progressOf(b) ?? -1)) * dir;
        default:
          return 0;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCourses, sortKey, sortDir, statsByCourse]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'title' || key === 'status' ? 'asc' : 'desc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const hasFilters = searchQuery || categoryFilter !== 'all' || statusFilter !== 'all';
  const categories = [...new Set(courses.map((course) => course.category))];

  if (coursesLoading) {
    return (
      <AdminSoftStudio>
        <div className="flex justify-center items-center h-[50vh]">
          <Spinner size="lg" />
        </div>
      </AdminSoftStudio>
    );
  }

  // A failed courses fetch must not render as "No courses yet" — every tab on
  // this page depends on the course list, so surface the failure with a retry.
  if (coursesError) {
    return (
      <AdminSoftStudio>
        <div className="max-w-3xl mx-auto py-16 px-4">
          <CourseErrorState
            title="Failed to load courses"
            error={coursesError}
            onRetry={() => refetchCourses()}
          />
        </div>
      </AdminSoftStudio>
    );
  }

  const tabTrigger = 'rounded-xl px-4 py-2 data-[state=active]:bg-card data-[state=active]:text-ss-lav-deep data-[state=active]:shadow-[var(--ss-shadow)]';

  return (
    <AdminSoftStudio>
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-7">
        <div>
          <p className="ss-serif text-ss-lav-deep text-lg mb-1">Insights Collective · Admin</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Manage courses &amp; enrollments</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Create courses with the guided builder, publish them, and keep an eye on enrollments and certificates.
          </p>
        </div>
        <Button onClick={handleAddCourse} className="rounded-xl">
          <Plus className="mr-2 h-4 w-4" /> New course
        </Button>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-muted rounded-2xl p-1 h-auto flex-wrap">
          <TabsTrigger value="courses" className={tabTrigger}>Courses</TabsTrigger>
          <TabsTrigger value="enrollments" className={tabTrigger}>
            <Users className="mr-2 h-4 w-4" /> Enrollments
          </TabsTrigger>
          <TabsTrigger value="certificates" className={tabTrigger}>
            <Award className="mr-2 h-4 w-4" /> Certificates
          </TabsTrigger>
          <TabsTrigger value="progress" className={tabTrigger}>
            <BarChart3 className="mr-2 h-4 w-4" /> Progress
          </TabsTrigger>
          <TabsTrigger value="report" className={tabTrigger}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses"
                className="pl-10 rounded-xl bg-card"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[200px] rounded-xl bg-card">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="soft-studio">
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px] rounded-xl bg-card">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="soft-studio">
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters} className="rounded-xl">
                <FilterX className="mr-2 h-4 w-4" /> Clear
              </Button>
            )}
          </div>

          {/* Roster table */}
          {sortedCourses.length === 0 ? (
            hasFilters ? (
              <div className="text-center py-16 rounded-3xl border border-dashed border-border bg-card">
                <h3 className="text-xl font-bold mb-1">No courses match your filters</h3>
                <p className="text-muted-foreground mb-4">Try a different search or clear the filters.</p>
                <Button variant="outline" onClick={clearFilters} className="rounded-xl bg-card">
                  <FilterX className="mr-2 h-4 w-4" /> Clear filters
                </Button>
              </div>
            ) : (
              <div className="text-center py-16 rounded-3xl border border-dashed border-border bg-card">
                <h3 className="text-xl font-bold mb-1">No courses yet</h3>
                <p className="text-muted-foreground mb-4">Get started by creating your first course.</p>
                <Button onClick={handleAddCourse} className="rounded-xl">
                  <Plus className="mr-2 h-4 w-4" /> New course
                </Button>
              </div>
            )
          ) : (
            <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-[var(--ss-shadow)]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>
                        <button className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => toggleSort('title')}>
                          Course {sortIcon('title')}
                        </button>
                      </TableHead>
                      <TableHead>Instructor</TableHead>
                      <TableHead>
                        <button className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => toggleSort('status')}>
                          Status {sortIcon('status')}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button className="inline-flex items-center gap-1.5 hover:text-foreground ml-auto" onClick={() => toggleSort('enrolled')}>
                          Enrolled {sortIcon('enrolled')}
                        </button>
                      </TableHead>
                      <TableHead className="w-[190px]">
                        <button className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => toggleSort('progress')}>
                          Progress {sortIcon('progress')}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCourses.map((course) => {
                      const progress = progressOf(course);
                      const thumb = (course as any).image_url || (course as any).thumbnail;
                      return (
                        <TableRow
                          key={course.id}
                          className={cn('cursor-pointer', selectedCourse?.id === course.id && 'bg-ss-lav-chip')}
                          onClick={() => setSelectedCourse(course)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden flex items-center justify-center text-ss-lav-deep shrink-0">
                                {thumb ? (
                                  <img src={thumb} alt={course.title} className="h-full w-full object-cover" />
                                ) : (
                                  <BookOpenIcon />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{course.title}</p>
                                {course.category && (
                                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{course.category}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {course.instructor?.name || 'Unassigned'}
                          </TableCell>
                          <TableCell>
                            {course.published ? (
                              <Badge className="border-transparent bg-ss-good-chip text-ss-good">Published</Badge>
                            ) : (
                              <Badge className="border-transparent bg-ss-track text-muted-foreground">Draft</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{course.enrollmentCount ?? 0} enrolled</TableCell>
                          <TableCell>
                            {progress == null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full bg-ss-lav-deep" style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-xs tabular-nums">{progress}%</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Hint label="Edit this course">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEditCourse(course)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Hint>
                              <Hint label={course.published ? 'Hide this course from the catalog' : 'Make this course visible in the catalog'}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleTogglePublish(course)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Hint>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Hint label="Delete this course permanently">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </Hint>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="soft-studio">
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
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

        <TabsContent value="report">
          <UnifiedExportReport courses={courses} />
        </TabsContent>
      </Tabs>

      {/* Course detail drawer — hooks live inside so they only run when open */}
      <Sheet open={!!selectedCourse} onOpenChange={(open) => { if (!open) setSelectedCourse(null); }}>
        <SheetContent className="soft-studio bg-background w-full sm:max-w-lg overflow-y-auto">
          {selectedCourse && (
            <CourseDetailDrawer
              course={selectedCourse}
              enrollmentCount={selectedCourse.enrollmentCount ?? 0}
              avgProgress={progressOf(selectedCourse)}
              onEdit={() => handleEditCourse(selectedCourse)}
              onTogglePublish={() => handleTogglePublish(selectedCourse)}
              onDelete={() => handleDeleteCourse(selectedCourse)}
            />
          )}
        </SheetContent>
      </Sheet>
    </AdminSoftStudio>
  );
}

function BookOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

// Detail drawer for a single course — Overview / Enrollments / Certificates.
// Reuses the same data hooks as the standalone Enrollments and Certificates
// tabs so the drawer never diverges from them.
type DrawerSub = 'overview' | 'enrollments' | 'certificates';

function CourseDetailDrawer({
  course,
  enrollmentCount,
  avgProgress,
  onEdit,
  onTogglePublish,
  onDelete,
}: {
  course: Course;
  enrollmentCount: number;
  avgProgress: number | null;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const [sub, setSub] = useState<DrawerSub>('overview');
  const { enrollments, loading: enrollmentsLoading } = useCourseEnrollments(course.id);
  const { certs, loading: certsLoading, revoke } = useCourseCertificates(course.id);

  const subTab = (key: DrawerSub, label: string) => (
    <button
      onClick={() => setSub(key)}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-lg',
        sub === key ? 'bg-ss-lav-chip text-ss-lav-deep' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );

  const enrollmentName = (e: (typeof enrollments)[number]) =>
    e.user ? `${e.user.first_name} ${e.user.last_name}`.trim() || 'Student' : 'Unknown User';

  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle className="text-xl">{course.title}</SheetTitle>
        <SheetDescription>
          {course.category || 'Uncategorized'} · {course.published ? 'Published' : 'Draft'} ·{' '}
          {course.instructor?.name || 'Unassigned'}
        </SheetDescription>
      </SheetHeader>

      <div className="flex gap-1 mt-4 mb-4 border-b border-border pb-2">
        {subTab('overview', 'Overview')}
        {subTab('enrollments', 'Enrollments')}
        {subTab('certificates', 'Certificates')}
      </div>

      {sub === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-xl font-bold tabular-nums">{enrollmentCount}</div>
              <div className="text-xs text-muted-foreground">Enrolled</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-xl font-bold tabular-nums">{avgProgress == null ? '—' : `${avgProgress}%`}</div>
              <div className="text-xs text-muted-foreground">Avg progress</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-xl font-bold tabular-nums">{certsLoading ? '—' : certs.length}</div>
              <div className="text-xs text-muted-foreground">Certificates</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-xl bg-card" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl bg-card" onClick={onTogglePublish}>
              <Eye className="h-4 w-4 mr-2" /> {course.published ? 'Unpublish' : 'Publish'}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl bg-card text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="soft-studio">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this course?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes "{course.title}" and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">Recent enrollments</p>
            {enrollmentsLoading ? (
              <p className="text-sm text-muted-foreground py-3">Loading…</p>
            ) : enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No enrollments found for this course.</p>
            ) : (
              <div className="divide-y divide-border">
                {enrollments.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-2">
                    <span
                      className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ background: avatarColor(e.user_id) }}
                    >
                      {getInitials(e.user?.first_name, e.user?.last_name)}
                    </span>
                    <span className="text-sm truncate">{enrollmentName(e)}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">{e.completion_status}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {sub === 'enrollments' && (
        <div>
          {enrollmentsLoading ? (
            <p className="text-sm text-muted-foreground py-3">Loading…</p>
          ) : enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No enrollments found for this course.</p>
          ) : (
            <div className="divide-y divide-border">
              {enrollments.map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                    style={{ background: avatarColor(e.user_id) }}
                  >
                    {getInitials(e.user?.first_name, e.user?.last_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm truncate">{enrollmentName(e)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.enrolled_at).toLocaleDateString()}</p>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{e.completion_status}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sub === 'certificates' && (
        <div>
          {certsLoading ? (
            <p className="text-sm text-muted-foreground py-3">Loading certificates…</p>
          ) : certs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No certificates issued for this course yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {certs.map((cert) => (
                <div key={cert.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                    style={{ background: avatarColor(cert.user_id) }}
                  >
                    {getInitials(...cert.student_name.split(' ') as [string, string])}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm truncate">{cert.student_name}</p>
                    <code className="text-[11px] text-ss-lav-deep">{cert.verification_code}</code>
                  </div>
                  <div className="ml-auto flex gap-1">
                    <Hint label="Open the public verification page">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => window.open(`/verify-certificate/${cert.verification_code}`, '_blank', 'noopener')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Hint>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="soft-studio">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke this certificate?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This deletes the certificate for {cert.student_name}. The verification code will stop working.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => revoke(cert)}>Revoke</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
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
    const header = ['Student Name', 'Enrolled Date', 'Completion %', 'Status'];
    const rows = filteredEnrollments.map((e) => {
      const name = e.user ? `${e.user.first_name ?? ''} ${e.user.last_name ?? ''}`.trim() : 'Unknown User';
      const pct = e.completion_status ?? 0;
      const status = pct >= 100 ? 'Completed' : pct > 0 ? 'In Progress' : 'Not Started';
      return [name, new Date(e.enrolled_at).toISOString().slice(0, 10), pct, status];
    });
    const safeTitle = (selectedCourse?.title || 'course').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    downloadCsv(`${safeTitle}-completion-report.csv`, header, rows);
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

// Certificates tab component — real data via the shared useCourseCertificates
// hook (also used by the course detail drawer), so the fetch + count-checked
// revoke live in one place.
function CertificatesTab({ courses }: { courses: Course[] }) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');
  const { certs, loading, revoke } = useCourseCertificates(selectedCourseId);

  const filteredCertificates = certs.filter(cert =>
    cert.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.verification_code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const courseTitle = courses.find(c => c.id === selectedCourseId)?.title || 'Course';

  const handleVerifyLink = (certificate: CertRow) => {
    // Real verification page — the same public route students/employers use.
    window.open(`/verify-certificate/${certificate.verification_code}`, '_blank', 'noopener');
  };

  const handleRevokeCertificate = (certificate: CertRow) => revoke(certificate);

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
