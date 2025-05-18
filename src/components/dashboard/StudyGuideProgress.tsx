import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Book, CheckCircle2 } from 'lucide-react';

interface StudyGuideProgressProps extends React.HTMLAttributes<HTMLDivElement> {}

export function StudyGuideProgress({ className, ...props }: StudyGuideProgressProps) {
  // This would be fetched from your backend in a real application
  const studyGuides = [
    {
      id: '1',
      title: 'Frontend Developer',
      company: 'Tech Corp',
      progress: 75,
      totalTopics: 20,
      completedTopics: 15,
    },
    {
      id: '2',
      title: 'Full Stack Engineer',
      company: 'Startup Inc',
      progress: 40,
      totalTopics: 30,
      completedTopics: 12,
    },
  ];

  return (
    <Card className={cn('col-span-4', className)} {...props}>
      <CardHeader>
        <CardTitle>Study Guide Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {studyGuides.length === 0 ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <Book className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No study guides created yet.
              </p>
            </div>
          ) : (
            studyGuides.map((guide) => (
              <div key={guide.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {guide.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {guide.company}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">
                      {guide.completedTopics}/{guide.totalTopics}
                    </span>
                  </div>
                </div>
                <Progress value={guide.progress} />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
} 