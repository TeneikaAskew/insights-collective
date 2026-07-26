import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Circle, 
  FileText, 
  ClipboardList, 
  BookOpen,
  Lock,
  Unlock,
  ChevronRight,
  Target
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ModuleProgress } from '@/types/course';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import CourseErrorState from '@/components/course/CourseErrorState';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ModuleProgressCardProps {
  moduleId: string;
  moduleTitle: string;
  studentId: string;
  isLocked?: boolean;
  unlockDate?: string;
  prerequisites?: Array<{
    moduleTitle: string;
    completed: boolean;
  }>;
  onLessonClick?: (lessonId: string) => void;
  showDetails?: boolean;
}

export const ModuleProgressCard: React.FC<ModuleProgressCardProps> = ({
  moduleId,
  moduleTitle,
  studentId,
  isLocked = false,
  unlockDate,
  prerequisites = [],
  onLessonClick,
  showDetails = true,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  // Single query against the live schema: content_items + progressions for
  // lessons, plus assignments/quizzes with their student submissions/attempts.
  // Progress is computed client-side — there is no calculate_module_progress
  // RPC in the live database.
  const {
    data: moduleData,
    isLoading,
    error: moduleError,
    refetch,
  } = useQuery({
    queryKey: ['module-progress', moduleId, studentId],
    queryFn: async () => {
      // 1. Published content items in this module.
      const itemsRes = await supabase
        .from('content_items')
        .select('id, title, type, position')
        .eq('module_id', moduleId)
        .eq('published', true)
        .order('position');
      if (itemsRes.error) throw new Error(itemsRes.error.message);
      const items = itemsRes.data || [];
      const itemIds = items.map((i) => i.id);

      // 2. The student's progressions, assignments, and quizzes in parallel.
      const [progressionsRes, assignmentsRes, quizzesRes] = await Promise.all([
        itemIds.length
          ? supabase
              .from('content_item_progressions')
              .select('content_item_id, workflow_state')
              .eq('user_id', studentId)
              .in('content_item_id', itemIds)
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from('assignments')
          .select(`
            id,
            title,
            due_date,
            points,
            submissions:assignment_submissions!left(
              id,
              workflow_state,
              grade
            )
          `)
          .eq('module_id', moduleId)
          .eq('submissions.user_id', studentId),
        supabase
          .from('quizzes')
          .select(`
            id,
            title,
            points_possible,
            attempts:quiz_submissions!left(
              id,
              score,
              finished_at,
              workflow_state
            )
          `)
          .eq('module_id', moduleId)
          .eq('attempts.user_id', studentId),
      ]);

      // A failed query must surface as an error — silently rendering empty
      // lists would misrepresent the module content.
      const queryError =
        progressionsRes.error ?? assignmentsRes.error ?? quizzesRes.error;
      if (queryError) throw new Error(queryError.message || 'Failed to load module content');

      const doneItems = new Set(
        (progressionsRes.data || [])
          .filter((p: any) => p.workflow_state === 'read' || p.workflow_state === 'completed')
          .map((p: any) => p.content_item_id)
      );
      const lessons = items.map((i) => ({ ...i, completed: doneItems.has(i.id) }));
      const assignments = assignmentsRes.data || [];
      const quizzes = quizzesRes.data || [];

      const isAssignmentDone = (a: any) =>
        (a.submissions || []).some(
          (s: any) => s.workflow_state === 'graded' || s.grade != null
        );
      // quiz_submissions is the table the live quiz flow writes; quiz_attempts
      // was only ever written by the deleted QuizTaker and is empty, so this
      // previously counted zero completed quizzes for everyone.
      const isQuizDone = (q: any) =>
        (q.attempts || []).some((at: any) => at.workflow_state === 'complete');

      const progress: ModuleProgress = {
        total_lessons: lessons.length,
        completed_lessons: lessons.filter((l) => l.completed).length,
        total_assignments: assignments.length,
        completed_assignments: assignments.filter(isAssignmentDone).length,
        total_quizzes: quizzes.length,
        completed_quizzes: quizzes.filter(isQuizDone).length,
        progress_percentage: 0,
      };
      const total = progress.total_lessons + progress.total_assignments + progress.total_quizzes;
      const done = progress.completed_lessons + progress.completed_assignments + progress.completed_quizzes;
      progress.progress_percentage = total ? Math.round((done / total) * 100) : 0;

      return { progress, lessons, assignments, quizzes };
    },
    enabled: !!moduleId && !!studentId,
  });

  // A failed progress fetch must render an error with retry — never the
  // loading skeleton forever (isLoading is false once the query errors).
  if (moduleError) {
    return (
      <Card>
        <CardContent className="p-6">
          <CourseErrorState
            title={`Failed to load progress for ${moduleTitle}`}
            error={moduleError}
            onRetry={() => void refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !moduleData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { progress, lessons, assignments, quizzes } = moduleData;
  const totalItems = progress.total_lessons + progress.total_assignments + progress.total_quizzes;
  const completedItems = progress.completed_lessons + progress.completed_assignments + progress.completed_quizzes;
  const isCompleted = progress.progress_percentage === 100;

  const getStatusBadge = () => {
    if (isLocked) {
      return <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" />Locked</Badge>;
    }
    if (isCompleted) {
      return <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    }
    if (progress.progress_percentage > 0) {
      return <Badge variant="default">In Progress</Badge>;
    }
    return <Badge variant="outline">Not Started</Badge>;
  };

  const renderContentItem = (item: any, type: 'lesson' | 'assignment' | 'quiz') => {
    const isItemCompleted = type === 'lesson'
      ? item.completed === true
      : type === 'assignment'
      ? item.submissions?.some((s: any) => s.workflow_state === 'graded' || s.grade != null)
      // Same predicate as isQuizDone above — quiz_submissions rows are
      // finished when workflow_state is 'complete'. Checking completed_at here
      // (a quiz_attempts column) would leave completed quizzes greyed out in
      // the detail list while still counting toward the percentage.
      : item.attempts?.some((a: any) => a.workflow_state === 'complete');

    const icon = type === 'lesson' 
      ? <BookOpen className="h-4 w-4" />
      : type === 'assignment'
      ? <FileText className="h-4 w-4" />
      : <ClipboardList className="h-4 w-4" />;

    return (
      <div
        key={item.id}
        className={cn(
          "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
          isItemCompleted 
            ? "bg-green-50 border-green-200 hover:bg-green-100" 
            : "hover:bg-gray-50"
        )}
        onClick={() => type === 'lesson' && onLessonClick?.(item.id)}
      >
        <div className="flex items-center gap-3">
          {isItemCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Circle className="h-5 w-5 text-gray-400" />
          )}
          <div className="flex items-center gap-2">
            {icon}
            <span className={cn(
              "text-sm",
              isItemCompleted && "text-green-700 font-medium"
            )}>
              {item.title}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {type === 'assignment' && (
            <>
              {item.points && <span>{item.points} pts</span>}
              {item.submissions?.[0]?.grade && (
                <Badge variant="outline">
                  {item.submissions[0].grade}/{item.points}
                </Badge>
              )}
            </>
          )}
          {type === 'quiz' && (
            <>
              {item.points_possible && <span>{item.points_possible} pts</span>}
              {item.attempts?.[0]?.score && (
                <Badge variant="outline">
                  {item.attempts[0].score}/{item.points_possible}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className={cn(isLocked && "opacity-75")}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{moduleTitle}</CardTitle>
            <CardDescription>
              {completedItems}/{totalItems} items completed
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progress.progress_percentage)}%</span>
          </div>
          <Progress value={progress.progress_percentage} className="h-2" />
        </div>

        {/* Progress breakdown */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Lessons</span>
            </div>
            <p className="text-2xl font-bold">
              {progress.completed_lessons}/{progress.total_lessons}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Assignments</span>
            </div>
            <p className="text-2xl font-bold">
              {progress.completed_assignments}/{progress.total_assignments}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Quizzes</span>
            </div>
            <p className="text-2xl font-bold">
              {progress.completed_quizzes}/{progress.total_quizzes}
            </p>
          </div>
        </div>

        {/* Lock/Prerequisites info */}
        {isLocked && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4" />
              Module Locked
            </div>
            {unlockDate && (
              <p className="text-sm text-muted-foreground">
                Unlocks on {new Date(unlockDate).toLocaleDateString()}
              </p>
            )}
            {prerequisites.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Complete these first:</p>
                {prerequisites.map((prereq, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {prereq.completed ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <Circle className="h-3 w-3 text-gray-400" />
                    )}
                    <span className={prereq.completed ? "line-through text-gray-500" : ""}>
                      {prereq.moduleTitle}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detailed content list. */}
        {showDetails && !isLocked && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2">
                <span className="text-sm font-medium">View Details</span>
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform",
                  isOpen && "rotate-90"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-3">
              {lessons.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Lessons</h4>
                  {lessons.map(lesson => renderContentItem(lesson, 'lesson'))}
                </div>
              )}

              {assignments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Assignments</h4>
                  {assignments.map(assignment => renderContentItem(assignment, 'assignment'))}
                </div>
              )}

              {quizzes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Quizzes</h4>
                  {quizzes.map(quiz => renderContentItem(quiz, 'quiz'))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};