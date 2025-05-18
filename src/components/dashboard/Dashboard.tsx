import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Code2, 
  FileText, 
  Video, 
  BookOpen,
  TrendingUp,
  Calendar 
} from 'lucide-react';

interface ActivityCard {
  title: string;
  icon: React.ReactNode;
  value: number;
  total: number;
  link: string;
}

export function Dashboard() {
  const activities: ActivityCard[] = [
    {
      title: 'Code Challenges',
      icon: <Code2 className="h-6 w-6" />,
      value: 12,
      total: 30,
      link: '/code-practice'
    },
    {
      title: 'STAR Responses',
      icon: <FileText className="h-6 w-6" />,
      value: 8,
      total: 15,
      link: '/star-responses'
    },
    {
      title: 'Mock Interviews',
      icon: <Video className="h-6 w-6" />,
      value: 3,
      total: 5,
      link: '/mock-interviews'
    },
    {
      title: 'Study Guides',
      icon: <BookOpen className="h-6 w-6" />,
      value: 4,
      total: 10,
      link: '/study-guides'
    }
  ];

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Interview Preparation Dashboard</h1>
        <Button asChild>
          <Link to="/mock-interviews/schedule">Schedule Mock Interview</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {activities.map((activity) => (
          <Card key={activity.title}>
            <Link to={activity.link}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {activity.title}
                </CardTitle>
                {activity.icon}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activity.value}/{activity.total}
                </div>
                <Progress
                  value={(activity.value / activity.total) * 100}
                  className="mt-2"
                />
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Add recent activity items here */}
              <p className="text-sm text-muted-foreground">
                No recent activity to display.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Add upcoming interview items here */}
              <p className="text-sm text-muted-foreground">
                No upcoming interviews scheduled.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 