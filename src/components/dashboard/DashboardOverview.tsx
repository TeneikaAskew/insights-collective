
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Trophy, Calendar, TrendingUp, Users, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const DashboardOverview = () => {
  const { user } = useAuth();

  const stats = [
    {
      title: "Courses Enrolled",
      value: "3",
      icon: BookOpen,
      description: "Active enrollments",
      color: "text-blue-600"
    },
    {
      title: "Certificates Earned",
      value: "1",
      icon: Trophy,
      description: "Completed courses",
      color: "text-yellow-600"
    },
    {
      title: "Study Streak",
      value: "7 days",
      icon: Calendar,
      description: "Current streak",
      color: "text-green-600"
    },
    {
      title: "Progress",
      value: "67%",
      icon: TrendingUp,
      description: "Overall completion",
      color: "text-purple-600"
    }
  ];

  const recentActivity = [
    { title: "Completed Module 3 - React Hooks", time: "2 hours ago", type: "completion" },
    { title: "Started Data Science Fundamentals", time: "1 day ago", type: "enrollment" },
    { title: "Earned Python Basics Certificate", time: "3 days ago", type: "achievement" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user?.name || 'Student'}!
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your learning journey.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Courses */}
        <Card>
          <CardHeader>
            <CardTitle>Current Courses</CardTitle>
            <CardDescription>Your active learning paths</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">React Fundamentals</p>
                <span className="text-sm text-muted-foreground">75%</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">Data Science Basics</p>
                <span className="text-sm text-muted-foreground">45%</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">Python for Beginners</p>
                <span className="text-sm text-muted-foreground">100%</span>
              </div>
              <Progress value={100} className="h-2" />
            </div>
            <Button variant="outline" className="w-full">
              <BookOpen className="mr-2 h-4 w-4" />
              View All Courses
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest learning milestones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {activity.type === 'completion' && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    )}
                    {activity.type === 'enrollment' && (
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                    )}
                    {activity.type === 'achievement' && (
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4">
              <MessageSquare className="mr-2 h-4 w-4" />
              View All Activity
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Jump into your learning activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-auto flex flex-col space-y-2 p-4">
              <BookOpen className="h-6 w-6" />
              <span>Browse Courses</span>
            </Button>
            <Button variant="outline" className="h-auto flex flex-col space-y-2 p-4">
              <Users className="h-6 w-6" />
              <span>Join Community</span>
            </Button>
            <Button variant="outline" className="h-auto flex flex-col space-y-2 p-4">
              <Calendar className="h-6 w-6" />
              <span>View Events</span>
            </Button>
            <Button variant="outline" className="h-auto flex flex-col space-y-2 p-4">
              <Trophy className="h-6 w-6" />
              <span>Certificates</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardOverview;
