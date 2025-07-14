// ABOUTME: Course home page showing overview, recent activity, and quick access to course resources
// ABOUTME: Main landing page when entering a specific course in the LMS

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  Clock, 
  Users, 
  Calendar, 
  MessageCircle,
  FileText,
  BarChart3,
  CheckCircle
} from 'lucide-react';
import { useCourseData } from '@/hooks/useCourseData';
import { CourseLayout } from '@/components/course/CourseLayout';

export default function CourseHome() {
  const { courseId } = useParams();
  const { course, isLoading, error } = useCourseData(courseId);

  if (isLoading) {
    return (
      <CourseLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </CourseLayout>
    );
  }

  if (error || !course) {
    return (
      <CourseLayout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Course Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || "The course you're looking for doesn't exist."}
          </p>
          <Button asChild>
            <Link to={`/dashboard`}>Back to Dashboard</Link>
          </Button>
        </div>
      </CourseLayout>
    );
  }

  // Mock data for demonstration
  const overallProgress = 35;
  const recentActivity = [
    { type: 'assignment', title: 'Data Analysis Assignment', dueDate: '2024-01-15', status: 'pending' },
    { type: 'module', title: 'Module 3: Machine Learning Basics', status: 'completed' },
    { type: 'announcement', title: 'Midterm Exam Schedule', date: '2024-01-10' },
  ];

  const quickStats = [
    { label: 'Modules Completed', value: '3/8', icon: BookOpen },
    { label: 'Assignments Due', value: '2', icon: FileText },
    { label: 'Course Progress', value: `${overallProgress}%`, icon: BarChart3 },
    { label: 'Class Messages', value: '12', icon: MessageCircle },
  ];

  return (
    <CourseLayout>
      <div className="space-y-6">
        {/* Course Header */}
        <div className="border-b pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">{course.title}</h1>
              <p className="text-muted-foreground mt-1">
                {course.category} • {course.level}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">{course.enrollmentStatus}</Badge>
              <Badge variant="outline">{course.duration}</Badge>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Course Progress</span>
              <span className="text-sm text-muted-foreground">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickStats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {activity.type === 'assignment' && <FileText className="h-5 w-5 text-orange-500" />}
                    {activity.type === 'module' && <BookOpen className="h-5 w-5 text-blue-500" />}
                    {activity.type === 'announcement' && <MessageCircle className="h-5 w-5 text-green-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.dueDate && `Due: ${activity.dueDate}`}
                      {activity.date && `Posted: ${activity.date}`}
                    </p>
                  </div>
                  {activity.status === 'completed' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {activity.status === 'pending' && (
                    <Badge variant="outline">Due Soon</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to={`/course/${courseId}/modules`}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  View Modules
                </Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to={`/course/${courseId}/assignments`}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Assignments
                </Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to={`/course/${courseId}/announcements`}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Course Announcements
                </Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link to={`/course/${courseId}/grades`}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Grades
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Course Description */}
        <Card>
          <CardHeader>
            <CardTitle>About This Course</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {course.description}
            </p>
            {course.tags && course.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {course.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary">{tag}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CourseLayout>
  );
}