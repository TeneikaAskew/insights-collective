import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { CheckCircle2, Code2, Timer, TrendingUp } from 'lucide-react';

interface CodingStatsProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CodingStats({ className, ...props }: CodingStatsProps) {
  // This would be fetched from your backend in a real application
  const stats = {
    totalAttempts: 15,
    passRate: 80,
    averageTime: '25 mins',
    completedTopics: ['Arrays', 'Hash Tables', 'Trees'],
    topicProgress: {
      'Data Structures': 75,
      'Algorithms': 60,
      'System Design': 40,
    },
  };

  return (
    <Card className={cn('col-span-3', className)} {...props}>
      <CardHeader>
        <CardTitle>Your Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Total Attempts</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalAttempts}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Pass Rate</span>
            </div>
            <p className="text-2xl font-bold">{stats.passRate}%</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Avg. Time</span>
            </div>
            <p className="text-2xl font-bold">{stats.averageTime}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Topics</span>
            </div>
            <p className="text-2xl font-bold">{stats.completedTopics.length}</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">Topic Progress</h3>
          {Object.entries(stats.topicProgress).map(([topic, progress]) => (
            <div key={topic} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{topic}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">Completed Topics</h3>
          <div className="flex flex-wrap gap-2">
            {stats.completedTopics.map((topic) => (
              <div
                key={topic}
                className="rounded-md bg-secondary px-2 py-1 text-xs font-medium"
              >
                {topic}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 