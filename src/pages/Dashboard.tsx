import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import CourseCard from '@/components/common/CourseCard';
import NotificationItem from '@/components/common/NotificationItem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Bell, Calendar, ArrowRight, Clock, LineChart, MessageSquare } from 'lucide-react';
import StudentProgressAnalytics from '@/components/dashboard/StudentProgressAnalytics';
import { useCoursesManagement } from '@/hooks/useCoursesManagement';
import { useToast } from '@/hooks/use-toast';
import { Course } from '@/types';
import { Navigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { computeDashboardMetrics } from '@/utils/dashboardMetrics';
import { CalendarPanel, type CalendarPanelView } from '@/components/calendar/CalendarPanel';
import { useUserCalendar } from '@/hooks/useCourseCalendar';

import { MessagesPanel } from '@/components/messages/MessagesPanel';

import { createLogger } from '@/utils/logger';
import { PageHeader } from '@/components/ui/page-header';

const logger = createLogger('Dashboard');

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  // Messages used to be the /messages page, which admins could hide from the page
  // catalog. It is a tab now, and a tab is not a route, so the catalog entry would have
  // stopped meaning anything — hiding "Messages" would have removed the sidebar link and
  // left the tab sitting there. The manifest entry still governs it.
  const { isPageVisible } = usePageVisibility();
  const messagesVisible = isPageVisible('/messages');

  // Tab lives in the URL so it can be linked to. The Calendar tab replaced the former
  // standalone /calendar page, and the places that used to link there — the profile
  // menu, the notifications dropdown — need a destination that opens it directly.
  // `replace` keeps tab switching out of the back-stack, so Back still leaves the
  // Dashboard rather than walking through every tab the user tried.
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'courses';
  const setActiveTab = (tab: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('tab', tab);
        // The open thread belongs to the Messages tab. Leaving it in the URL when the
        // user switches to Calendar means coming back later re-opens a thread they had
        // navigated away from.
        if (tab !== 'messages') next.delete('conversation');
        return next;
      },
      { replace: true },
    );
  };

  // Messages sit beside the Calendar for the same reason the Calendar sits here: both are
  // about the courses you are in, and neither earns a top-level page of its own. The open
  // thread rides in the query string so /dashboard?tab=messages&conversation=<id> is a
  // link somebody can send.
  // The Calendar tab's inner view also rides in the query string, so
  // /dashboard?tab=calendar&view=upcoming is a linkable "what's due" screen.
  const calendarView: CalendarPanelView =
    searchParams.get('view') === 'upcoming' ? 'upcoming' : 'selectedDay';
  const setCalendarView = (view: CalendarPanelView) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('tab', 'calendar');
        next.set('view', view);
        return next;
      },
      { replace: true },
    );
  };

  const openConversationId = searchParams.get('conversation') ?? undefined;

  const setOpenConversation = (conversationId?: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('tab', 'messages');
        if (conversationId) {
          next.set('conversation', conversationId);
        } else {
          next.delete('conversation');
        }
        return next;
      },
      { replace: true },
    );
  };
  
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teachingCourses, setTeachingCourses] = useState<Course[]>([]);
  const [inProgressCount, setInProgressCount] = useState(0);
  
  // Redirect to login if not authenticated.
  //
  // Built from the current location rather than hardcoded to "/dashboard": the tab now
  // lives in the query string, so a hardcoded path silently dropped it and returned a
  // signed-out user following a ?tab=calendar link to My Courses after logging in.
  // Encoded because the value itself contains a query string. safeInternalPath on the
  // Login side preserves search and hash, so the tab survives the round trip.
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${returnTo}`} replace />;
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
          if (progRes.error) throw progRes.error;
          if (certRes.error) throw certRes.error;
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
          const { data: enrollRows, error: enrollRowsError } = await supabase
            .from('enrollments')
            .select('course_id')
            .in('course_id', courseIds);
          if (enrollRowsError) throw enrollRowsError;
          const enrollCounts = new Map<string, number>();
          (enrollRows || []).forEach((r: any) => {
            enrollCounts.set(r.course_id, (enrollCounts.get(r.course_id) || 0) + 1);
          });

          const formattedCourses = courses.map((course: any) => ({
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
            // No stock-photo fallback — CourseCard renders a neutral
            // placeholder block when a course has no real artwork.
            thumbnail: course.image_url || course.thumbnail || undefined,
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
          
          const { data: enrollRows, error: enrollRowsError } = await supabase
            .from('enrollments')
            .select('course_id')
            .in('course_id', courseIds);
          if (enrollRowsError) throw enrollRowsError;
          const enrollCounts = new Map<string, number>();
          (enrollRows || []).forEach((r: any) => {
            enrollCounts.set(r.course_id, (enrollCounts.get(r.course_id) || 0) + 1);
          });

          const formattedCourses = courses.map((course: any) => ({
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
            // No stock-photo fallback — CourseCard renders a neutral
            // placeholder block when a course has no real artwork.
            thumbnail: course.image_url || course.thumbnail || undefined,
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
  // Counted in the database, not derived from the list. The list is capped at
  // ten, so deriving the badge from it reports "3 unread" to someone holding
  // fifty — the cap used to be invisible only because the list was itself
  // filtered to unread.
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notificationsReloadKey, setNotificationsReloadKey] = useState(0);
  // The deadline count comes from the same hook and same filters the Calendar's Upcoming view
  // reads, so the KPI number and the list it links to can never disagree.
  // Calendar events expose their start as `start_date` (see CourseCalendarEvent).
  const { events: calendarEvents } = useUserCalendar(user?.id, {
    types: ['quiz', 'assignment', 'event', 'announcement'],
  });
  const upcomingDeadlineCount = (calendarEvents ?? []).filter((event: any) => {
    const start = event?.start_date ?? event?.start_time ?? event?.due_date;
    if (!start) return false;
    const date = new Date(start);
    return !Number.isNaN(date.getTime()) && date.getTime() >= Date.now();
  }).length;


  // Fetch real notifications from DB
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      try {
        setNotificationsError(null);
        // Read and unread both. Filtering to unread meant the tab emptied itself
        // as you read things and then said "You don't have any notifications" —
        // measured against an account holding 199 of them. Unread rows are
        // already distinguishable: NotificationItem tints them, and the counter
        // above is a separate unread-only query.
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        if (error) throw error;

        const { count, error: countError } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
        if (countError) throw countError;
        setUnreadCount(count ?? 0);

        // Map DB rows (snake_case) to the shape NotificationItem renders
        // (camelCase); passing raw rows made every date show "Invalid Date".
        setNotifications((data || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          link: n.link,
          // Carried so a row with no stored link can still resolve a
          // destination from its course and type.
          courseId: n.course_id,
          isRead: n.is_read,
          createdAt: n.created_at,
        })));
      } catch (err: any) {
        logger.error('Error fetching notifications:', err);
        setNotificationsError(err?.message || 'Failed to load notifications');
      }
    };
    fetchNotifications();
  }, [user, notificationsReloadKey]);

  // Clicking a single notification marks it read. This handler was simply never
  // passed to NotificationItem, so the component's mark-as-read branch could not
  // fire: rows stayed unread (and the badge stayed high) no matter how many you
  // opened, and "Mark All as Read" was the only way to clear anything.
  const markNotificationRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;
    const previous = notifications;
    const previousUnread = unreadCount;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) {
      // Roll back the optimistic update — never report success on a failed write.
      logger.error('Error marking notification read:', error);
      setNotifications(previous);
      setUnreadCount(previousUnread);
      toast({
        title: 'Failed to mark notification as read',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const markAllNotificationsRead = async () => {
    const previous = notifications;
    // Gated on the real count, not on the ten rows in view: with every visible
    // row already read and unread ones below the cap, the old guard returned
    // early and the button did nothing while the badge still showed a number.
    if (unreadCount === 0) return;
    const previousUnread = unreadCount;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    // Every unread row of theirs, not just the ten on screen — the button says
    // "all", and the badge it clears is now a full count rather than a slice.
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user!.id)
      .eq('is_read', false);
    if (error) {
      // Roll back the optimistic update — never report success on a failed write.
      logger.error('Error marking notifications read:', error);
      setNotifications(previous);
      setUnreadCount(previousUnread);
      toast({
        title: 'Failed to mark notifications as read',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleMetricClick = (tab: string) => {
    setActiveTab(tab);
  };

  // The "Upcoming Deadlines" stat now opens the Calendar tab on its Upcoming view, so the
  // number and the list it links to come from one source instead of two.
  const openUpcoming = () => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('tab', 'calendar');
        next.set('view', 'upcoming');
        next.delete('conversation');
        return next;
      },
      { replace: true },
    );
  };

  
  if (!user) return null;
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          subtitle={`Welcome back, ${user.name}! Here's an overview of your learning progress.`}
        />
        
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
                <div className="text-2xl font-bold">{unreadCount}</div>
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors" 
            onClick={openUpcoming}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Upcoming Deadlines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{upcomingDeadlineCount}</div>

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
            
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="calendar">
              <Calendar className="h-4 w-4 mr-1.5" />
              Calendar
            </TabsTrigger>
            {messagesVisible && (
              <TabsTrigger value="messages">
                <MessageSquare className="h-4 w-4 mr-1.5" />
                Messages
              </TabsTrigger>
            )}
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
          
          {/* The former "Upcoming Deadlines" tab is gone: the Calendar tab's Upcoming
              view is the single place deadlines are listed. */}


          
          <TabsContent value="notifications" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Notifications</h2>
              {notifications.some(n => !n.isRead) && (
                <Button variant="outline" size="sm" onClick={markAllNotificationsRead}>
                  Mark All as Read
                </Button>
              )}
            </div>

            {notificationsError ? (
              <Card>
                <CardContent className="py-10 text-center" role="alert">
                  <p className="text-muted-foreground mb-4">
                    Failed to load notifications: {notificationsError}
                  </p>
                  <Button variant="outline" onClick={() => setNotificationsReloadKey((k) => k + 1)}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : notifications.length > 0 ? (
              <Card>
                {/* NotificationItem is a rounded, filled row of its own — unread
                    ones carry bg-secondary/50. Stacked flush by `divide-y` they
                    merged into one purple slab, and the divider line was
                    invisible against that fill. Spacing them apart is what makes
                    each one read as a separate item. */}
                <CardContent className="p-2 space-y-2">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markNotificationRead}
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

          <TabsContent value="calendar" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Calendar</h2>
              <p className="text-sm text-muted-foreground">
                View and manage your upcoming events, assignments, and deadlines.
              </p>
            </div>
            <CalendarPanel view={calendarView} onViewChange={setCalendarView} />
          </TabsContent>

          {messagesVisible && (
          <TabsContent value="messages" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Messages</h2>
              <p className="text-sm text-muted-foreground">
                Every course you are in, in one inbox. Start a new conversation from the course itself —
                students message the instructor, instructors message their students.
              </p>
            </div>
            <MessagesPanel
              conversationId={openConversationId}
              onSelectConversation={setOpenConversation}
            />
          </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
