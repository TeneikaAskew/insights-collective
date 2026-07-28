// ABOUTME: Dashboard showing user's enrolled courses in Canvas/Blackboard style
// ABOUTME: Main landing page for students to access their enrolled courses and see progress

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, 
  Clock, 
  Calendar, 
  Search,
  Bell,
  BarChart3,
  Users,
  MessageCircle,
  ChevronRight
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import CourseErrorState from '@/components/course/CourseErrorState';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('EnrolledCoursesDashboard');

interface EnrolledCourse {
  id: string;
  title: string;
  category: string;
  level: string;
  // Real thumbnail URL, or null when the course has none. We render a neutral
  // placeholder instead of substituting a stock photo.
  thumbnail: string | null;
  // Real instructor name, or null when unknown. The instructor line is
  // omitted rather than showing a generic "Instructor" label.
  instructor_name: string | null;
  progress: number;
  last_accessed?: string;
  upcoming_due_date?: string;
}

export default function EnrolledCoursesDashboard() {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchEnrolledCourses();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const fetchEnrolledCourses = async () => {
    try {
      setLoading(true);
      setCoursesError(null);
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`
          course_id,
          completion_status,
          enrolled_at,
          courses!inner (
            id,
            title,
            category,
            level,
            thumbnail,
            image_url,
            instructor_id,
            profiles:instructor_id (first_name, last_name)
          )
        `)
        .eq('user_id', user?.id);

      if (error) throw error;

      const courseIds = (enrollments || []).map(e => (e.courses as any)?.id).filter(Boolean);

      // Fetch next upcoming due date per course
      const { data: upcomingAssignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('course_id, due_date')
        .in('course_id', courseIds)
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true });

      if (assignmentsError) throw assignmentsError;

      const nextDueDateMap: Record<string, string> = {};
      (upcomingAssignments || []).forEach(a => {
        if (!nextDueDateMap[a.course_id]) {
          nextDueDateMap[a.course_id] = a.due_date!;
        }
      });

      // Transform the data
      const enrolledCourses: EnrolledCourse[] = (enrollments || []).map(enrollment => {
        const course = enrollment.courses as any;
        const instructor = course.profiles;
        const instructorName = instructor
          ? `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim()
          : '';

        return {
          id: course.id || '',
          title: course.title || '',
          category: course.category || '',
          level: course.level || '',
          thumbnail: course.thumbnail || course.image_url || null,
          instructor_name: instructorName || null,
          progress: enrollment.completion_status || 0,
          last_accessed: enrollment.enrolled_at,
          upcoming_due_date: nextDueDateMap[course.id] || undefined
        };
      });

      setCourses(enrolledCourses);
    } catch (error: any) {
      logger.error('Error fetching enrolled courses:', error);
      setCoursesError(error?.message || 'Failed to load your enrolled courses');
      toast({
        title: 'Error loading courses',
        description: 'Failed to load your enrolled courses',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [recentActivity, setRecentActivity] = useState<{course: string; activity: string; time: string}[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<{course: string; task: string; due: string}[]>([]);
  const [sidebarError, setSidebarError] = useState<string | null>(null);

  const fetchSidebarData = useCallback(async () => {
    if (!user || courses.length === 0) return;
    setSidebarError(null);
    try {
      const courseIds = courses.map(c => c.id);

      // Fetch recent content_item_progressions as activity
      const { data: progressions, error: progressionsError } = await supabase
        .from('content_item_progressions')
        .select('workflow_state, updated_at, content_items(title, course_id, courses(title))')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (progressionsError) throw progressionsError;

      // Fetch upcoming deadlines from assignments
      const { data: deadlines, error: deadlinesError } = await supabase
        .from('assignments')
        .select('title, due_date, courses(title)')
        .in('course_id', courseIds)
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(5);

      if (deadlinesError) throw deadlinesError;

      setRecentActivity((progressions || []).map(p => {
        const ci = p.content_items as any;
        const courseName = ci?.courses?.title || 'Course';
        const action = p.workflow_state === 'completed' ? 'Completed' : 'In progress';
        const timeAgo = p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '';
        return { course: courseName, activity: `${action}: ${ci?.title || 'Item'}`, time: timeAgo };
      }));

      setUpcomingDeadlines((deadlines || []).map(d => ({
        course: (d.courses as any)?.title || 'Course',
        task: d.title,
        due: d.due_date ? new Date(d.due_date).toLocaleDateString() : 'No date'
      })));
    } catch (error: any) {
      logger.error('Error fetching sidebar data:', error);
      setSidebarError(error?.message || 'Failed to load recent activity and deadlines');
    }
  }, [user, courses]);

  useEffect(() => {
    void fetchSidebarData();
  }, [fetchSidebarData]);

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Access Your Courses</h1>
          <p className="text-muted-foreground mb-6">
            Please log in to view your enrolled courses and progress.
          </p>
          <Button asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">My Courses</h1>
              <p className="text-muted-foreground">
                Continue your learning journey
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </Button>
              <Button asChild size="sm">
                <Link to="/courses">
                  <Search className="h-4 w-4 mr-2" />
                  Browse Courses
                </Link>
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Main Course Grid */}
          <div className="lg:col-span-3">
            {coursesError ? (
              <CourseErrorState
                title="Error loading courses"
                error={coursesError}
                onRetry={() => void fetchEnrolledCourses()}
              />
            ) : filteredCourses.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Enrolled Courses</h3>
                  <p className="text-muted-foreground mb-4">
                    Start your learning journey by enrolling in courses.
                  </p>
                  <Button asChild>
                    <Link to="/courses">Browse Courses</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filteredCourses.map((course) => (
                  <Card
                    key={course.id}
                    className="group flex flex-col overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  >
                    <div className="aspect-video overflow-hidden bg-muted relative">
                      {course.thumbnail && (
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                        />
                      )}
                      <div className="absolute top-2 left-2 flex gap-1.5">
                        <Badge>{course.category}</Badge>
                        <Badge variant="outline" className="bg-background/80 backdrop-blur">
                          {course.level}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="flex flex-col flex-1 p-5">
                      <h3 className="text-lg font-semibold mb-1 line-clamp-2">
                        {course.title}
                      </h3>

                      {course.instructor_name && (
                        <p className="text-sm text-muted-foreground mb-4">
                          Instructor: {course.instructor_name}
                        </p>
                      )}

                      <div className="space-y-2 mb-4 mt-auto">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Progress
                          </span>
                          <span className="text-sm font-semibold tabular-nums">
                            {course.progress}%
                          </span>
                        </div>
                        <Progress value={course.progress} className="h-2" />

                        {course.upcoming_due_date && (
                          <div className="flex justify-end text-xs">
                            <span className="text-ss-warn">
                              Due: {new Date(course.upcoming_due_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <Button asChild className="w-full rounded-full">
                        <Link to={`/course/${course.id}`}>
                          Continue Learning
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {sidebarError ? (
              <CourseErrorState
                title="Error loading activity"
                error={sidebarError}
                onRetry={() => void fetchSidebarData()}
              />
            ) : (
              <>
                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {recentActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent activity yet.</p>
                    ) : (
                      recentActivity.map((activity, index) => (
                        <div key={index} className="border-b last:border-0 pb-3 last:pb-0">
                          <p className="font-medium text-sm">{activity.course}</p>
                          <p className="text-sm text-muted-foreground">{activity.activity}</p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Upcoming Deadlines */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Upcoming Deadlines
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {upcomingDeadlines.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
                    ) : (
                      upcomingDeadlines.map((deadline, index) => (
                        <div key={index} className="border-b last:border-0 pb-3 last:pb-0">
                          <p className="font-medium text-sm">{deadline.task}</p>
                          <p className="text-sm text-muted-foreground">{deadline.course}</p>
                          <p className="text-xs text-ss-warn">Due: {deadline.due}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}