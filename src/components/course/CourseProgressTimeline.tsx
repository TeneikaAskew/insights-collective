// ABOUTME: Visual weekly checkpoint timeline for a course — one node per module.
// ABOUTME: Auto-updates via useCourseProgress and Supabase realtime on progressions/submissions.

import { useEffect } from 'react';
import { Check, Circle, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCourseProgress } from '@/hooks/useCourseProgress';

interface CourseProgressTimelineProps {
  courseId: string;
  modules: Array<{ id: string; title: string }>;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
}

type CheckpointState = 'not_started' | 'in_progress' | 'complete';

function stateOf(percent: number): CheckpointState {
  if (percent >= 100) return 'complete';
  if (percent > 0) return 'in_progress';
  return 'not_started';
}

const LABELS: Record<CheckpointState, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
};

export function CourseProgressTimeline({ courseId, modules, title = 'Weekly checkpoints', subtitle, headerRight }: CourseProgressTimelineProps) {
  const { user } = useAuth();
  const { data, refetch, isLoading } = useCourseProgress(courseId);

  // Realtime: refetch when the student's progressions change or an assignment is
  // submitted/graded for this student, so checkpoints update without a reload.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`course-progress-${courseId}-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'content_item_progressions', filter: `user_id=eq.${user.id}` },
        () => { void refetch(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assignment_submissions', filter: `student_id=eq.${user.id}` },
        () => { void refetch(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grades', filter: `student_id=eq.${user.id}` },
        () => { void refetch(); },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [courseId, user?.id, refetch]);

  if (!modules.length) return null;

  return (
    <section className="rounded-2xl bg-white border border-neutral-200 p-6 md:p-8">
      <h2 className="font-display text-2xl text-neutral-900 mb-2">{title}</h2>
      <p className="text-sm text-neutral-500 mb-4">
        {subtitle ?? "Each week's checkpoint updates automatically as you complete lessons, submit assignments, and receive feedback."}
      </p>
      <div className="flex items-center justify-between mb-6 gap-4">
        <span className="text-xs text-neutral-500">
          {data ? `${data.completedItems} / ${data.totalItems} lessons` : isLoading ? 'Loading…' : ''}
        </span>
        {headerRight}
      </div>

      <ol className="relative">
        {modules.map((m, idx) => {
          const mp = data?.modules.find((x) => x.moduleId === m.id);
          const percent = mp?.percent ?? 0;
          const state = stateOf(percent);
          const isLast = idx === modules.length - 1;

          return (
            <li key={m.id} className="relative pl-12 pb-8 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-[15px] top-8 bottom-0 w-0.5',
                    state === 'complete' ? 'bg-primary' : 'bg-neutral-200',
                  )}
                />
              )}
              <span
                className={cn(
                  'absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2',
                  state === 'complete' && 'bg-primary border-primary text-primary-foreground',
                  state === 'in_progress' && 'bg-white border-primary text-primary',
                  state === 'not_started' && 'bg-white border-neutral-300 text-neutral-400',
                )}
              >
                {state === 'complete' ? (
                  <Check className="h-4 w-4" />
                ) : state === 'in_progress' ? (
                  <CircleDot className="h-4 w-4" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </span>

              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  Week {idx + 1}
                </span>
                <h3 className="font-semibold text-neutral-900">{m.title || 'Untitled module'}</h3>
                <span
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-widest',
                    state === 'complete' && 'text-primary',
                    state === 'in_progress' && 'text-neutral-700',
                    state === 'not_started' && 'text-neutral-400',
                  )}
                >
                  {LABELS[state]}
                </span>
              </div>

              <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className={cn('h-full', state === 'complete' ? 'bg-primary' : 'bg-primary/70')}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {mp ? `${mp.completedItems} of ${mp.totalItems} lessons` : 'No lessons yet'} · {percent}%
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default CourseProgressTimeline;
