
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { mockService } from '@/lib/mockData';
import CourseCard from '@/components/common/CourseCard';
import NotificationItem from '@/components/common/NotificationItem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Bell, Calendar, ArrowRight, Clock } from 'lucide-react';

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);
  
  if (!user) return null;
  
  // Get the enrolled courses for the user
  const enrolledCourses = mockService.getEnrolledCourses(user.id);
  
  // Get notifications for the user
  const notifications = mockService.getUserNotifications(user.id);
  
  // Progress values would come from the database in a real application
  const courseProgress = {
    "course1": 75,
    "course2": 30
  };
  
  // Upcoming deadlines (would be calculated from assignments and quizzes in a real app)
  const upcomingDeadlines = [
    {
      id: "deadline1",
      title: "Style Your Webpage",
      courseTitle: "Introduction to Web Development",
      dueDate: "2023-01-29T23:59:59Z",
      type: "assignment"
    },
    {
      id: "deadline2",
      title: "CSS Fundamentals Quiz",
      courseTitle: "Introduction to Web Development",
      dueDate: "2023-01-27T23:59:59Z",
      type: "quiz"
    }
  ];
  
  // Format the due date
  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
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
          <Card>
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
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">2</div>
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
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
          
          <Card>
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
        
        <Tabs defaultValue="courses" className="space-y-6">
          <TabsList>
            <TabsTrigger value="courses">My Courses</TabsTrigger>
            <TabsTrigger value="deadlines">Upcoming Deadlines</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          
          <TabsContent value="courses" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">My Courses</h2>
              <Button variant="outline" size="sm" asChild>
                <a href="/courses">Browse Courses</a>
              </Button>
            </div>
            
            {enrolledCourses.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {enrolledCourses.map((course) => (
                  <CourseCard 
                    key={course.id} 
                    course={course}
                    progress={courseProgress[course.id as keyof typeof courseProgress] || 0} 
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-muted-foreground mb-4">You haven't enrolled in any courses yet.</p>
                  <Button asChild>
                    <a href="/courses">Browse Courses</a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="deadlines" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Upcoming Deadlines</h2>
              <Button variant="outline" size="sm" asChild>
                <a href="/calendar">View Calendar</a>
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
