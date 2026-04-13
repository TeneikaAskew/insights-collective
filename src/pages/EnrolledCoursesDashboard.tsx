// ABOUTME: Dashboard showing user's enrolled courses in Canvas/Blackboard style
// ABOUTME: Main landing page for students to access their enrolled courses and see progress

import { useState, useEffect } from 'react';
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
  thumbnail: string;
  instructor_name: string;
  progress: number;
  enrollment_status: string;
  last_accessed?: string;
  upcoming_due_date?: string;
  total_modules: number;
  completed_modules: number;
}

export default function EnrolledCoursesDashboard() {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
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

      // Fetch module counts per course
      const courseIds = (enrollments || []).map(e => (e.courses as any)?.id).filter(Boolean);
      
      const { data: moduleCounts } = await supabase
        .from('modules')
        .select('id, course_id')
        .in('course_id', courseIds);

      const moduleCountMap: Record<string, number> = {};
      (moduleCounts || []).forEach(m => {
        moduleCountMap[m.course_id] = (moduleCountMap[m.course_id] || 0) + 1;
      });

      // Fetch next upcoming due date per course
      const { data: upcomingAssignments } = await supabase
        .from('assignments')
        .select('course_id, due_date')
        .in('course_id', courseIds)
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true });

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
        const totalMods = moduleCountMap[course.id] || 0;
        const progress = enrollment.completion_status || 0;
        const completedMods = totalMods > 0 ? Math.round((progress / 100) * totalMods) : 0;
        
        return {
          id: course.id || '',
          title: course.title || '',
          category: course.category || '',
          level: course.level || '',
          thumbnail: course.thumbnail || course.image_url || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
          instructor_name: instructor ? `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || 'Instructor' : 'Instructor',
          progress,
          enrollment_status: 'Active',
          last_accessed: enrollment.enrolled_at,
          total_modules: totalMods,
          completed_modules: completedMods,
          upcoming_due_date: nextDueDateMap[course.id] || undefined
        };
      });

      setCourses(enrolledCourses);
    } catch (error: any) {
      logger.error('Error fetching enrolled courses:', error);
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

  useEffect(() => {
    const fetchSidebarData = async () => {
      if (!user || courses.length === 0) return;
      const courseIds = courses.map(c => c.id);

      // Fetch recent content_item_progressions as activity
      const { data: progressions } = await supabase
        .from('content_item_progressions')
        .select('workflow_state, updated_at, content_items(title, course_id, courses(title))')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      setRecentActivity((progressions || []).map(p => {
        const ci = p.content_items as any;
        const courseName = ci?.courses?.title || 'Course';
        const action = p.workflow_state === 'completed' ? 'Completed' : 'In progress';
        const timeAgo = p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '';
        return { course: courseName, activity: `${action}: ${ci?.title || 'Item'}`, time: timeAgo };
      }));

      // Fetch upcoming deadlines from assignments
      const { data: deadlines } = await supabase
        .from('assignments')
        .select('title, due_date, courses(title)')
        .in('course_id', courseIds)
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(5);

      setUpcomingDeadlines((deadlines || []).map(d => ({
        course: (d.courses as any)?.title || 'Course',
        task: d.title,
        due: d.due_date ? new Date(d.due_date).toLocaleDateString() : 'No date'
      })));
    };
    fetchSidebarData();
  }, [user, courses]);

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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">My Courses</h1>
              <p className="text-muted-foreground">
                Continue your learning journey
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </Button>
              <Button asChild>
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
            {filteredCourses.length === 0 ? (
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
              <div className="grid gap-6 md:grid-cols-2">
                {filteredCourses.map((course) => (
                  <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-video overflow-hidden">
                      <img 
                        src={course.thumbnail} 
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <Badge>{course.category}</Badge>
                        <Badge variant="outline">{course.level}</Badge>
                      </div>
                      
                      <h3 className="text-xl font-semibold mb-2 line-clamp-2">
                        {course.title}
                      </h3>
                      
                      <p className="text-sm text-muted-foreground mb-4">
                        Instructor: {course.instructor_name}
                      </p>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Progress</span>
                          <span className="text-sm text-muted-foreground">
                            {course.progress}%
                          </span>
                        </div>
                        <Progress value={course.progress} className="h-2" />
                        
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{course.completed_modules}/{course.total_modules} modules</span>
                          {course.upcoming_due_date && (
                            <span className="text-orange-600">Due: {new Date(course.upcoming_due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      
                      <Button asChild className="w-full">
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
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="border-b last:border-0 pb-3 last:pb-0">
                    <p className="font-medium text-sm">{activity.course}</p>
                    <p className="text-sm text-muted-foreground">{activity.activity}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                ))}
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
                {upcomingDeadlines.map((deadline, index) => (
                  <div key={index} className="border-b last:border-0 pb-3 last:pb-0">
                    <p className="font-medium text-sm">{deadline.task}</p>
                    <p className="text-sm text-muted-foreground">{deadline.course}</p>
                    <p className="text-xs text-orange-600">Due: {deadline.due}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}