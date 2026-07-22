import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import CourseCard from '@/components/common/CourseCard';
import NotificationItem from '@/components/common/NotificationItem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Bell, Calendar, ArrowRight, Clock, LineChart } from 'lucide-react';
import StudentProgressAnalytics from '@/components/dashboard/StudentProgressAnalytics';
import { useCoursesManagement } from '@/hooks/useCoursesManagement';
import { useToast } from '@/hooks/use-toast';
import { Course } from '@/types';
import { Navigate, Link } from 'react-router-dom';
import { computeDashboardMetrics } from '@/utils/dashboardMetrics';

import { createLogger } from '@/utils/logger';

const logger = createLogger('Dashboard');

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('courses');
  const { toast } = useToast();
  
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teachingCourses, setTeachingCourses] = useState<Course[]>([]);
  const [inProgressCount, setInProgressCount] = useState(0);
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/dashboard" replace />;
  }
  
  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select('course_id, completion_status')
          .eq('user_id', user.id);

        if (enrollmentsError) throw enrollmentsError;

        // Derive "in progress" from real progression + certificate data.
        // enrollments.completion_status is not updated by the app, so filtering
        // it in the range (0, 100) always yielded 0.
        const enrolledIds = (enrollments ?? []).map((e) => e.course_id).filter(Boolean);
        if (enrolledIds.length > 0) {
          const [progRes, certRes] = await Promise.all([
            supabase
              .from('content_item_progressions')
              .select('workflow_state, content_items!inner(modules!inner(course_id))')
              .eq('user_id', user.id)
              .in('workflow_state', ['read', 'completed']),
            supabase
              .from('certificates')
              .select('course_id')
              .eq('user_id', user.id)
              .in('course_id', enrolledIds),
          ]);
          const progressions = (progRes.data ?? []).map((p: any) => {
            const ci = Array.isArray(p.content_items) ? p.content_items[0] : p.content_items;
            const mod = Array.isArray(ci?.modules) ? ci?.modules[0] : ci?.modules;
            return { course_id: mod?.course_id, workflow_state: p.workflow_state };
          });
          const metrics = computeDashboardMetrics(
            (enrollments ?? []).map((e) => ({ course_id: e.course_id })),
            progressions,
            (certRes.data ?? []) as any,
          );
          setInProgressCount(metrics.inProgress);
        } else {
          setInProgressCount(0);
        }
        
        if (enrollments && enrollments.length > 0) {
          const courseIds = enrollments.map(enrollment => enrollment.course_id);
          
          const { data: courses, error: coursesError } = await supabase
            .from('courses')
            .select(`
              *,
              instructor:profiles(
                id,
                first_name,
                last_name,
                avatar_url
              )
            `)
            .in('id', courseIds);
          
          if (coursesError) throw coursesError;
          
          // Real enrollment counts per course — no fake rating/enrollment placeholders.
          const { data: enrollRows } = await supabase
            .from('enrollments')
            .select('course_id')
            .in('course_id', courseIds);
          const enrollCounts = new Map<string, number>();
          (enrollRows || []).forEach((r: any) => {
            enrollCounts.set(r.course_id, (enrollCounts.get(r.course_id) || 0) + 1);
          });

          const formattedCourses: Course[] = courses.map(course => ({
            ...course,
            instructor: {
              id: course.instructor?.id || '',
              name: course.instructor
                ? `${course.instructor?.first_name || ''} ${course.instructor?.last_name || ''}`.trim()
                : 'Instructor',
              email: '',
              role: 'instructor',
              avatar: course.instructor?.avatar_url || '',
            },
            enrollmentCount: enrollCounts.get(course.id) ?? 0,
            modules: [],
            createdAt: course.created_at,
            updatedAt: course.updated_at,
            thumbnail: course.image_url || course.thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
          }));

          setEnrolledCourses(formattedCourses);
        }
        
        setLoading(false);
      } catch (error: any) {
        logger.error('Error fetching enrolled courses:', error);
        setError(error.message);
        setLoading(false);
        toast({
          title: "Failed to load courses",
          description: error.message,
          variant: "destructive"
        });
      }
    };
    
    fetchEnrolledCourses();
  }, [user, toast]);
  
  useEffect(() => {
    const fetchInstructorCourses = async () => {
      if (!user) return;
      
      try {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('course_assignments')
          .select('course_id')
          .eq('user_id', user.id);
        
        if (assignmentsError) throw assignmentsError;
        
        if (assignments && assignments.length > 0) {
          const courseIds = assignments.map(assignment => assignment.course_id);
          
          const { data: courses, error: coursesError } = await supabase
            .from('courses')
            .select(`
              *,
              instructor:profiles(
                id,
                first_name,
                last_name,
                avatar_url
              )
            `)
            .in('id', courseIds);
          
          if (coursesError) throw coursesError;
          
          const { data: enrollRows } = await supabase
            .from('enrollments')
            .select('course_id')
            .in('course_id', courseIds);
          const enrollCounts = new Map<string, number>();
          (enrollRows || []).forEach((r: any) => {
            enrollCounts.set(r.course_id, (enrollCounts.get(r.course_id) || 0) + 1);
          });

          const formattedCourses: Course[] = courses.map(course => ({
            ...course,
            instructor: {
              id: course.instructor?.id || '',
              name: course.instructor
                ? `${course.instructor?.first_name || ''} ${course.instructor?.last_name || ''}`.trim()
                : 'Instructor',
              email: '',
              role: 'instructor',
              avatar: course.instructor?.avatar_url || '',
            },
            enrollmentCount: enrollCounts.get(course.id) ?? 0,
            modules: [],
            createdAt: course.created_at,
            updatedAt: course.updated_at,
            thumbnail: course.image_url || course.thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
          }));

          setTeachingCourses(formattedCourses);
        }
      } catch (error: any) {
        logger.error('Error fetching instructor courses:', error);
        toast({
          title: "Failed to load instructor courses",
          description: error.message,
          variant: "destructive"
        });
      }
    };
    
    fetchInstructorCourses();
  }, [user, toast]);
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);

  // Fetch real notifications from DB
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(10);
        setNotifications(data || []);
      } catch (err) {
        logger.error('Error fetching notifications:', err);
      }
    };
    fetchNotifications();
  }, [user]);

  // Fetch real upcoming deadlines from assignments
  useEffect(() => {
    const fetchDeadlines = async () => {
      if (!user || enrolledCourses.length === 0) return;
      try {
        const courseIds = enrolledCourses.map(c => c.id);
        const { data } = await supabase
          .from('assignments')
          .select('id, title, due_date, course_id, courses(title)')
          .in('course_id', courseIds)
          .gte('due_date', new Date().toISOString())
          .order('due_date', { ascending: true })
          .limit(5);
        
        setUpcomingDeadlines((data || []).map(d => ({
          id: d.id,
          title: d.title,
          courseTitle: (d.courses as any)?.title || 'Course',
          dueDate: d.due_date,
          type: 'assignment'
        })));
      } catch (err) {
        logger.error('Error fetching deadlines:', err);
      }
    };
    fetchDeadlines();
  }, [user, enrolledCourses]);
  
  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const handleMetricClick = (tab: string) => {
    setActiveTab(tab);
  };
  
  if (!user) return null;
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name}! Here's an overview of your learning progress.
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors" 
            onClick={() => handleMetricClick('courses')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Enrolled Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{enrolledCourses.length}</div>
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors" 
            onClick={() => handleMetricClick('courses')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold" data-testid="metric-in-progress">{inProgressCount}</div>
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors" 
            onClick={() => handleMetricClick('notifications')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{notifications.filter(n => !n.isRead).length}</div>
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors" 
            onClick={() => handleMetricClick('deadlines')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Upcoming Deadlines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{upcomingDeadlines.length}</div>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="courses">My Courses</TabsTrigger>
            <TabsTrigger value="progress">
              <LineChart className="h-4 w-4 mr-1.5" />
              Progress
            </TabsTrigger>
            {teachingCourses.length > 0 && (
              <TabsTrigger value="teaching">Teaching</TabsTrigger>
            )}
            <TabsTrigger value="deadlines">Upcoming Deadlines</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Progress analytics</h2>
                <p className="text-sm text-muted-foreground">
                  Weekly completion, assignment status, and your next action for every course.
                </p>
              </div>
            </div>
            <StudentProgressAnalytics />
          </TabsContent>
          
          <TabsContent value="courses" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">My Courses</h2>
              <Button variant="outline" size="sm" asChild>
                <Link to="/courses">Browse Courses</Link>
              </Button>
            </div>
            
            {loading ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-muted-foreground mb-4">Error loading courses: {error}</p>
                  <Button onClick={() => window.location.reload()}>Try Again</Button>
                </CardContent>
              </Card>
            ) : enrolledCourses.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {enrolledCourses.map((course) => (
                  <CourseCard 
                    key={course.id} 
                    course={course}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-muted-foreground mb-4">You haven't enrolled in any courses yet.</p>
                  <Button asChild>
                    <Link to="/courses">Browse Courses</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {teachingCourses.length > 0 && (
            <TabsContent value="teaching" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Courses You Teach</h2>
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/courses'}>
                  Manage Courses
                </Button>
              </div>
              
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {teachingCourses.map((course) => (
                  <CourseCard 
                    key={course.id} 
                    course={course}
                  />
                ))}
              </div>
            </TabsContent>
          )}
          
          <TabsContent value="deadlines" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Upcoming Deadlines</h2>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/calendar'}>
                View Calendar
              </Button>
            </div>
            
            {upcomingDeadlines.length > 0 ? (
              <div className="space-y-4">
                {upcomingDeadlines.map((deadline) => (
                  <Card key={deadline.id}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {deadline.type === 'assignment' ? (
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <BookOpen className="h-4 w-4 text-primary" />
                              </div>
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Clock className="h-4 w-4 text-primary" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">{deadline.title}</h4>
                            <p className="text-sm text-muted-foreground">{deadline.courseTitle}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">
                            {deadline.type === 'assignment' ? 'Assignment' : 'Quiz'}
                          </Badge>
                          <p className="text-sm text-muted-foreground">Due {formatDueDate(deadline.dueDate)}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-muted-foreground">You don't have any upcoming deadlines.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="notifications" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Notifications</h2>
              {notifications.some(n => !n.isRead) && (
                <Button variant="outline" size="sm">
                  Mark All as Read
                </Button>
              )}
            </div>
            
            {notifications.length > 0 ? (
              <Card>
                <CardContent className="p-0 divide-y">
                  {notifications.map((notification) => (
                    <NotificationItem 
                      key={notification.id} 
                      notification={notification} 
                    />
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-muted-foreground">You don't have any notifications.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
