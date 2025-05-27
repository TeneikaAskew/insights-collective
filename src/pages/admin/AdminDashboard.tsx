import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, BookOpen, MessageSquare, FileText, CheckCircle } from 'lucide-react';
import { mockService } from '@/lib/mockData';

const AdminDashboard = () => {
  // Mock data for dashboard cards
  const totalUsers = mockService.getAllUsers().length;
  const totalCourses = mockService.getAllCourses().length;
  const totalReviews = 42;
  const totalForms = 15;
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <Button>
            Generate Report
          </Button>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Users</CardTitle>
              <CardDescription>Registered users on the platform</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{totalUsers}</div>
                <p className="text-muted-foreground">
                  <span className="text-green-500">+5%</span> this month
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Total Courses</CardTitle>
              <CardDescription>Available courses for learning</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{totalCourses}</div>
                <p className="text-muted-foreground">
                  <span className="text-green-500">+12%</span> this month
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Total Reviews</CardTitle>
              <CardDescription>Student feedback and ratings</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{totalReviews}</div>
                <p className="text-muted-foreground">
                  <span className="text-red-500">-3%</span> this month
                </p>
              </div>
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Forms</CardTitle>
              <CardDescription>Surveys and feedback forms</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-2xl font-bold">{totalForms}</div>
                <p className="text-muted-foreground">
                  <span className="text-green-500">+8%</span> this month
                </p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions and events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">John Doe enrolled in Data Science 101</p>
                  <p className="text-sm text-muted-foreground">2 hours ago</p>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Jane Smith completed Machine Learning Module 3</p>
                  <p className="text-sm text-muted-foreground">5 hours ago</p>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">New course "Advanced Python" published</p>
                  <p className="text-sm text-muted-foreground">1 day ago</p>
                </div>
                <Badge variant="outline">New</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage and monitor platform activities</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button className="justify-start" variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </Button>
              <Button className="justify-start" variant="outline">
                <BookOpen className="h-4 w-4 mr-2" />
                Manage Courses
              </Button>
              <Button className="justify-start" variant="outline">
                <MessageSquare className="h-4 w-4 mr-2" />
                View Feedback
              </Button>
              <Button className="justify-start" variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Manage Forms
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-r from-green-50 to-teal-50 border-green-200">
          <CardHeader>
            <CardTitle>Insights and Analytics</CardTitle>
            <CardDescription>
              Key metrics and trends on the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium">User Engagement</h4>
                <p className="text-sm text-muted-foreground">
                  Active users: 1,256
                </p>
                <p className="text-sm text-muted-foreground">
                  Avg. session duration: 24 min
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Course Performance</h4>
                <p className="text-sm text-muted-foreground">
                  Avg. course completion rate: 78%
                </p>
                <p className="text-sm text-muted-foreground">
                  Top course: Data Science 101
                </p>
              </div>
            </div>
            <Button variant="secondary">
              View Detailed Analytics
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
