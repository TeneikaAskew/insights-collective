import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface WeeklyProgressProps extends React.HTMLAttributes<HTMLDivElement> {}

export function WeeklyProgress({ className, ...props }: WeeklyProgressProps) {
  // This would be fetched from your backend in a real application
  const weeklyGoals = [
    {
      name: 'STAR Responses',
      progress: 60,
      target: 10,
      completed: 6,
    },
    {
      name: 'Code Challenges',
      progress: 40,
      target: 5,
      completed: 2,
    },
    {
      name: 'Mock Interviews',
      progress: 75,
      target: 4,
      completed: 3,
    },
  ];

  return (
    <Card className={cn('col-span-4', className)} {...props}>
      <CardHeader>
        <CardTitle>Weekly Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {weeklyGoals.map((goal) => (
          <div key={goal.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">{goal.name}</p>
                <p className="text-sm text-muted-foreground">
                  {goal.completed} / {goal.target} completed
                </p>
              </div>
              <p className="text-sm font-medium">{goal.progress}%</p>
            </div>
            <Progress value={goal.progress} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
} 