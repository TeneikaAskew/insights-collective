import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Code2, FileText, MessageSquare, Star } from 'lucide-react';

interface RecentActivityProps extends React.HTMLAttributes<HTMLDivElement> {}

type ActivityType = 'star' | 'code' | 'interview' | 'guide';

interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  timestamp: string;
}

const getActivityIcon = (type: ActivityType) => {
  switch (type) {
    case 'star':
      return <Star className="h-4 w-4" />;
    case 'code':
      return <Code2 className="h-4 w-4" />;
    case 'interview':
      return <MessageSquare className="h-4 w-4" />;
    case 'guide':
      return <FileText className="h-4 w-4" />;
  }
};

export function RecentActivity({ className, ...props }: RecentActivityProps) {
  // This would be fetched from your backend in a real application
  const activities: Activity[] = [
    {
      id: '1',
      type: 'star',
      description: 'Completed STAR response for leadership question',
      timestamp: '2 hours ago',
    },
    {
      id: '2',
      type: 'code',
      description: 'Solved Binary Tree traversal challenge',
      timestamp: '4 hours ago',
    },
    {
      id: '3',
      type: 'interview',
      description: 'Completed mock interview with Sarah',
      timestamp: '1 day ago',
    },
    {
      id: '4',
      type: 'guide',
      description: 'Created study guide for Frontend Developer role',
      timestamp: '2 days ago',
    },
  ];

  return (
    <Card className={cn('col-span-3', className)} {...props}>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted">
                {getActivityIcon(activity.type)}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {activity.description}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activity.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 