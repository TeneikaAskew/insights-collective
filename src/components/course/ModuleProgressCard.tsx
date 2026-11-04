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
  ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import CourseErrorState from '@/components/course/CourseErrorState';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

/**
 * One module's slice of the canonical progress snapshot (useCourseProgress). T-10 r2 (2): the card's completion
 * figures, percent and badge come ONLY from this slice, the same eligible universe and DONE set as every other view.
 * The card never recounts completion from the assignments/quizzes tables (that double-counted content items and used
 * different predicates than the snapshot).
 */
export interface ModuleSnapshot {
  totalItems: number;
  completedItems: number;
  /** Display-only (capped, see displayPercent). */
  percent: number;
  /** Exact: every eligible item of the module is done. */
  isComplete: boolean;
  /** The module's eligible item IDs. */
  itemIds: string[];
}

interface ModuleProgressCardProps {
  moduleId: string;
  moduleTitle: string;
  studentId: string;
  snapshot: ModuleSnapshot;
  /** The snapshot's DONE IDs (stored progress, not assessment evidence). */
  doneItemIds: ReadonlySet<string>;
  /** Type of each eligible item; null while unknown. Any of this module's items missing means the breakdown is unknown. */
  typeById: ReadonlyMap<string, string> | null;
  isLocked?: boolean;
  unlockDate?: string;
  prerequisites?: Array<{
    moduleTitle: string;
    completed: boolean;
  }>;
  onLessonClick?: (lessonId: string) => void;
  showDetails?: boolean;
}

type Bucket = { done: number; total: number };
export type ModuleBreakdown = { page: Bucket; assignment: Bucket; quiz: Bucket } | null;

/** Per-type counts from the snapshot; null (unknown) when any of the module's items has no known type. */
export function moduleBreakdown(
  itemIds: string[],
  done: ReadonlySet<string>,
  typeById: ReadonlyMap<string, string> | null,
): ModuleBreakdown {
  if (!typeById || itemIds.some((id) => !typeById.has(id))) return null;
  const b = { page: { done: 0, total: 0 }, assignment: { done: 0, total: 0 }, quiz: { done: 0, total: 0 } };
  for (const id of itemIds) {
    const t = typeById.get(id) as keyof typeof b;
    if (!(t in b)) continue;
    b[t].total += 1;
    if (done.has(id)) b[t].done += 1;
  }
  return b;
}

/** Assessment evidence is its OWN fact, shown next to (never instead of) the stored-progress checkmark. */
function assignmentStatus(a: any): string {
  const subs: any[] = a?.submissions || [];
  // A stored 'graded' state is graded whatever the grade column holds: a NULL grade means the SCORE is unavailable,
  // never that the work is ungraded or missing. A numeric grade (including 0) is shown as the score.
  const graded = subs.find((s) => s.workflow_state === 'graded' && s.grade != null) ?? subs.find((s) => s.workflow_state === 'graded');
  if (graded) {
    if (graded.grade == null) return 'Graded, score unavailable';
    return a.points ? `Graded ${graded.grade}/${a.points}` : `Graded ${graded.grade}`;
  }
  if (subs.some((s) => s.workflow_state === 'submitted' || s.submitted_at)) return 'Submitted, not graded';
  return 'No submission';
}

function quizStatus(q: any): string {
  const finished = (q?.attempts || []).find((at: any) => at.workflow_state === 'complete');
  if (!finished) return 'No completed attempt';
  return finished.score != null && q.points_possible
    ? `Attempt complete ${finished.score}/${q.points_possible}`
    : 'Attempt complete';
}

const TYPE_LABEL: Record<string, string> = {
  page: 'Lessons',
  assignment: 'Assignments',
  quiz: 'Quizzes',
};

export const ModuleProgressCard: React.FC<ModuleProgressCardProps> = ({
  moduleId,
  moduleTitle,
  studentId,
  snapshot,
  doneItemIds,
  typeById,
  isLocked = false,
  unlockDate,
  prerequisites = [],
  onLessonClick,
  showDetails = true,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const itemKey = React.useMemo(() => [...snapshot.itemIds].sort().join(','), [snapshot.itemIds]);
  const breakdown = moduleBreakdown(snapshot.itemIds, doneItemIds, typeById);

  // Details only: titles of the module's ELIGIBLE items, plus each assessment's own status. None of this feeds a count.
  const {
    data: details,
    error: detailsError,
    refetch,
  } = useQuery({
    queryKey: ['module-progress-details', moduleId, studentId, itemKey],
    queryFn: async () => {
      const ids = snapshot.itemIds;
      const [itemsRes, assignmentsRes, quizzesRes] = await Promise.all([
        supabase.from('content_items').select('id, title, type, position').in('id', ids).order('position'),
        supabase
          .from('assignments')
          .select(`
            id,
            points,
            content_item_id,
            submissions:assignment_submissions!left(
              id,
              workflow_state,
              grade,
              submitted_at
            )
          `)
          .in('content_item_id', ids)
          .eq('submissions.user_id', studentId),
        supabase
          .from('quizzes')
          .select(`
            id,
            points_possible,
            content_item_id,
            attempts:quiz_submissions!left(
              id,
              score,
              finished_at,
              workflow_state
            )
          `)
          .in('content_item_id', ids)
          .eq('attempts.user_id', studentId),
      ]);
      const queryError = itemsRes.error ?? assignmentsRes.error ?? quizzesRes.error;
      if (queryError) throw new Error(queryError.message || 'Failed to load module content');
      const eligible = new Set(ids);
      const items = (itemsRes.data || []).filter((i: any) => eligible.has(i.id));
      const assignmentByItem = new Map((assignmentsRes.data || []).map((a: any) => [a.content_item_id, a]));
      const quizByItem = new Map((quizzesRes.data || []).map((q: any) => [q.content_item_id, q]));
      return { items, assignmentByItem, quizByItem, complete: items.length === ids.length };
    },
    enabled: showDetails && !isLocked && !!moduleId && !!studentId && snapshot.itemIds.length > 0,
  });

  const getStatusBadge = () => {
    if (isLocked) {
      return <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" />Locked</Badge>;
    }
    if (snapshot.isComplete) {
      return <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    }
    if (snapshot.completedItems > 0) {
      return <Badge variant="default">In Progress</Badge>;
    }
    return <Badge variant="outline">Not Started</Badge>;
  };

  const renderContentItem = (item: any) => {
    // The checkmark is stored progress (the snapshot's DONE set), the same fact the counts use.
    const isItemDone = doneItemIds.has(item.id);
    const assessment =
      item.type === 'assignment' && details?.assignmentByItem.has(item.id)
        ? assignmentStatus(details.assignmentByItem.get(item.id))
        : item.type === 'quiz' && details?.quizByItem.has(item.id)
          ? quizStatus(details.quizByItem.get(item.id))
          : null;
    const icon = item.type === 'assignment'
      ? <FileText className="h-4 w-4" />
      : item.type === 'quiz'
        ? <ClipboardList className="h-4 w-4" />
        : <BookOpen className="h-4 w-4" />;

    return (
      <div
        key={item.id}
        data-testid={`module-item-${item.id}`}
        data-done={isItemDone ? 'true' : 'false'}
        className={cn(
          'flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer',
          isItemDone ? 'bg-ss-good-chip border-ss-good hover:bg-ss-good-chip' : 'hover:bg-accent',
        )}
        onClick={() => item.type === 'page' && onLessonClick?.(item.id)}
      >
        <div className="flex items-center gap-3">
          {isItemDone ? (
            <CheckCircle2 className="h-5 w-5 text-ss-good" aria-label="Marked done" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" aria-label="Not marked done" />
          )}
          <div className="flex items-center gap-2">
            {icon}
            <span className={cn('text-sm', isItemDone && 'text-ss-good font-medium')}>{item.title}</span>
          </div>
        </div>
        {assessment && (
          <Badge variant="outline" data-testid={`assessment-${item.id}`}>
            {assessment}
          </Badge>
        )}
      </div>
    );
  };

  const groups = details
    ? ['page', 'assignment', 'quiz', 'other'].map((t) => ({
        t,
        items: details.items.filter((i: any) => (t === 'other' ? !(i.type in TYPE_LABEL) : i.type === t)),
      }))
    : [];

  const cell = (b: Bucket | undefined) => (breakdown && b ? `${b.done}/${b.total}` : 'Unknown');

  return (
    <Card className={cn(isLocked && 'opacity-75')} data-testid={`module-card-${moduleId}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{moduleTitle}</CardTitle>
            <CardDescription>
              {snapshot.completedItems}/{snapshot.totalItems} items completed
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{snapshot.percent}%</span>
          </div>
          <Progress value={snapshot.percent} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Lessons</span>
            </div>
            <p className="text-2xl font-bold" data-testid="module-breakdown-page">{cell(breakdown?.page)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Assignments</span>
            </div>
            <p className="text-2xl font-bold" data-testid="module-breakdown-assignment">{cell(breakdown?.assignment)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Quizzes</span>
            </div>
            <p className="text-2xl font-bold" data-testid="module-breakdown-quiz">{cell(breakdown?.quiz)}</p>
          </div>
        </div>

        {isLocked && (
          <div className="bg-muted rounded-lg p-4 space-y-2">
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
                      <CheckCircle2 className="h-3 w-3 text-ss-good" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className={prereq.completed ? 'line-through text-muted-foreground' : ''}>
                      {prereq.moduleTitle}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showDetails && !isLocked && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2">
                <span className="text-sm font-medium">View Details</span>
                <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-3">
              {detailsError ? (
                <CourseErrorState
                  title={`Failed to load details for ${moduleTitle}`}
                  error={detailsError}
                  onRetry={() => void refetch()}
                />
              ) : (
                <>
                  {details && !details.complete && (
                    <p className="text-sm text-muted-foreground">Some items in this module could not be loaded.</p>
                  )}
                  {groups.map(({ t, items }) =>
                    items.length > 0 ? (
                      <div key={t} className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">{TYPE_LABEL[t] ?? 'Other items'}</h4>
                        {items.map(renderContentItem)}
                      </div>
                    ) : null,
                  )}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};
