import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Trophy } from 'lucide-react';
import { ModuleProgress, AssignmentProgress, QuizProgress } from '@/hooks/useModuleProgress';

interface ModuleCompletionCardProps {
  moduleProgress: ModuleProgress | null;
  assignmentProgress: AssignmentProgress[];
  quizProgress: QuizProgress[];
  assignmentCount: number;
  quizCount: number;
  onMarkComplete: () => void;
  loading?: boolean;
}

export const ModuleCompletionCard: React.FC<ModuleCompletionCardProps> = ({
  moduleProgress,
  assignmentProgress,
  quizProgress,
  assignmentCount,
  quizCount,
  onMarkComplete,
  loading = false
}) => {
  const isModuleCompleted = moduleProgress?.completed || false;
  const completedAssignments = assignmentProgress.filter(a => a.completed).length;
  const completedQuizzes = quizProgress.length; // Quiz attempts count as completed
  
  // Calculate overall progress
  const totalItems = assignmentCount + quizCount + 1; // +1 for module itself
  const completedItems = completedAssignments + completedQuizzes + (isModuleCompleted ? 1 : 0);
  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const getCompletionStatus = () => {
    if (isModuleCompleted) {
      return { text: 'Completed', variant: 'success' as const, icon: CheckCircle };
    }
    if (overallProgress > 0) {
      return { text: 'In Progress', variant: 'secondary' as const, icon: Clock };
    }
    return { text: 'Not Started', variant: 'outline' as const, icon: Clock };
  };

  const status = getCompletionStatus();
  const StatusIcon = status.icon;

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Module Progress</CardTitle>
          <Badge variant={status.variant} className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {status.text}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span>Assignments</span>
            <span className="flex items-center gap-1">
              {completedAssignments > 0 && <CheckCircle className="h-3 w-3 text-green-600" />}
              {completedAssignments} / {assignmentCount}
            </span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span>Quizzes</span>
            <span className="flex items-center gap-1">
              {completedQuizzes > 0 && <CheckCircle className="h-3 w-3 text-green-600" />}
              {completedQuizzes} / {quizCount}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span>Module Completion</span>
            <span className="flex items-center gap-1">
              {isModuleCompleted && <CheckCircle className="h-3 w-3 text-green-600" />}
              {isModuleCompleted ? 'Complete' : 'Pending'}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t">
          {!isModuleCompleted ? (
            <Button 
              onClick={onMarkComplete}
              disabled={loading}
              className="w-full"
              size="sm"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Mark Module Complete
            </Button>
          ) : (
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800">Module Completed!</p>
              <p className="text-xs text-green-600">
                {moduleProgress?.completed_at && 
                  `Completed on ${new Date(moduleProgress.completed_at).toLocaleDateString()}`
                }
              </p>
            </div>
          )}
        </div>

        {moduleProgress?.time_spent && moduleProgress.time_spent > 0 && (
          <div className="text-xs text-muted-foreground text-center pt-2">
            Time spent: {Math.round(moduleProgress.time_spent / 60)} minutes
          </div>
        )}
      </CardContent>
    </Card>
  );
};