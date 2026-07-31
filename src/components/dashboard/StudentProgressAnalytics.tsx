// ABOUTME: Progress analytics for the student dashboard.
// ABOUTME: Shows weekly module completion, assignment status, and clear next actions.

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  Trophy,
} from 'lucide-react';
import { createLogger } from '@/utils/logger';

const logger = createLogger('StudentProgressAnalytics');

interface WeekRow {
  moduleId: string;
  title: string;
  week: number | null;
  total: number;
  completed: number;
  percent: number;
  firstIncompleteItemId: string | null;
}

interface CourseAnalytics {
  courseId: string;
  courseTitle: string;
  overallPercent: number;
  weeks: WeekRow[];
  assignments: {
    total: number;
    submitted: number;
    graded: number;
    pending: number;
  };
  nextAction: {
    label: string;
    href: string;
    kind: 'lesson' | 'assignment' | 'complete';
  };
}

const StudentProgressAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [courses, setCourses] = useState<CourseAnalytics[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) return;
      try {
        setLoading(true);
        setLoadError(null);

        const { data: enrollments, error: enrollErr } = await supabase
          .from('enrollments')
          .select('course_id, courses(id, title)')
          .eq('user_id', user.id);
        if (enrollErr) throw enrollErr;

        const courseRows = (enrollments || [])
          .map((e: any) => e.courses)
          .filter(Boolean);
        if (courseRows.length === 0) {
          if (!cancelled) setCourses([]);
          return;
        }
        const courseIds = courseRows.map((c: any) => c.id);

        // Modules
        const { data: modules, error: modulesErr } = await supabase
          .from('modules')
          .select('id, title, week, course_id, position')
          .in('course_id', courseIds)
          .order('week', { ascending: true });
        if (modulesErr) throw modulesErr;

        const moduleIds = (modules || []).map((m) => m.id);

        // Content items
        const { data: items, error: itemsErr } = await supabase
          .from('content_items')
          .select('id, module_id, position, title')
          .in('module_id', moduleIds.length ? moduleIds : ['00000000-0000-0000-0000-000000000000'])
          .eq('published', true)
          .order('position', { ascending: true });
        if (itemsErr) throw itemsErr;

        const itemIds = (items || []).map((i) => i.id);

        // Progressions
        const { data: progressions, error: progErr } = itemIds.length
          ? await supabase
              .from('content_item_progressions')
              .select('content_item_id, workflow_state')
              .eq('user_id', user.id)
              .in('content_item_id', itemIds)
          : { data: [] as any[], error: null };
        if (progErr) throw progErr;

        const completedItems = new Set<string>(
          (progressions || [])
            .filter((p: any) => p.workflow_state === 'read' || p.workflow_state === 'completed')
            .map((p: any) => p.content_item_id),
        );

        // Assignments + submissions
        const { data: assignments, error: assignErr } = await supabase
          .from('assignments')
          .select('id, title, course_id, due_date')
          .in('course_id', courseIds);
        if (assignErr) throw assignErr;

        const assignmentIds = (assignments || []).map((a) => a.id);
        const { data: submissions, error: subErr } = assignmentIds.length
          ? await supabase
              .from('assignment_submissions')
              .select('assignment_id, workflow_state, grade')
              .eq('user_id', user.id)
              .in('assignment_id', assignmentIds)
          : { data: [] as any[], error: null };
        if (subErr) throw subErr;

        const subByAssignment = new Map<string, any>();
        (submissions || []).forEach((s: any) => subByAssignment.set(s.assignment_id, s));

        // Build per-course analytics
        const result: CourseAnalytics[] = courseRows.map((course: any) => {
          const courseModules = (modules || []).filter((m) => m.course_id === course.id);
          const weeks: WeekRow[] = courseModules.map((m) => {
            const modItems = (items || []).filter((i) => i.module_id === m.id);
            const completed = modItems.filter((i) => completedItems.has(i.id)).length;
            const total = modItems.length;
            const firstIncomplete = modItems.find((i) => !completedItems.has(i.id));
            return {
              moduleId: m.id,
              title: m.title || `Week ${m.week ?? ''}`.trim(),
              week: m.week ?? null,
              total,
              completed,
              percent: total ? Math.round((completed / total) * 100) : 0,
              firstIncompleteItemId: firstIncomplete?.id ?? null,
            };
          });

          const totalItems = weeks.reduce((s, w) => s + w.total, 0);
          const completedCount = weeks.reduce((s, w) => s + w.completed, 0);
          const overallPercent = totalItems ? Math.round((completedCount / totalItems) * 100) : 0;

          const courseAssignments = (assignments || []).filter((a) => a.course_id === course.id);
          // Drafts and unsubmitted rows are still the student's to-do, not
          // work awaiting feedback.
          const isPending = (sub: any) =>
            !sub || sub.workflow_state === 'draft' || sub.workflow_state === 'unsubmitted';
          let submitted = 0;
          let graded = 0;
          let pending = 0;
          courseAssignments.forEach((a) => {
            const sub = subByAssignment.get(a.id);
            if (isPending(sub)) pending += 1;
            else if (sub.workflow_state === 'graded' || sub.grade != null) graded += 1;
            else submitted += 1;
          });

          // Next action
          let nextAction: CourseAnalytics['nextAction'];
          const nextIncompleteWeek = weeks.find((w) => w.percent < 100 && w.firstIncompleteItemId);
          const nextPendingAssignment = courseAssignments
            .filter((a) => isPending(subByAssignment.get(a.id)))
            .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))[0];

          if (overallPercent >= 100 && pending === 0 && submitted === 0) {
            nextAction = {
              label: 'View certificate',
              href: `/profile?tab=certificates`,
              kind: 'complete',
            };
          } else if (nextPendingAssignment && overallPercent > 50) {
            nextAction = {
              label: `Submit: ${nextPendingAssignment.title}`,
              href: `/courses/${course.id}/learn`,
              kind: 'assignment',
            };
          } else if (nextIncompleteWeek) {
            nextAction = {
              label: `Continue ${nextIncompleteWeek.title}`,
              href: `/courses/${course.id}/learn`,
              kind: 'lesson',
            };
          } else {
            nextAction = {
              label: 'Open course',
              href: `/courses/${course.id}`,
              kind: 'lesson',
            };
          }

          return {
            courseId: course.id,
            courseTitle: course.title,
            overallPercent,
            weeks,
            assignments: {
              total: courseAssignments.length,
              submitted,
              graded,
              pending,
            },
            nextAction,
          };
        });

        if (!cancelled) setCourses(result);
      } catch (err: any) {
        // A failed load must not render zeroed stat tiles or the
        // "enroll in a course" empty state to an enrolled student.
        logger.error('Failed to load progress analytics', err);
        if (!cancelled) setLoadError(err?.message || 'Failed to load progress analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  const summary = useMemo(() => {
    const totals = courses.reduce(
      (acc, c) => {
        acc.assignments += c.assignments.total;
        acc.submitted += c.assignments.submitted;
        acc.graded += c.assignments.graded;
        acc.pending += c.assignments.pending;
        acc.percentSum += c.overallPercent;
        return acc;
      },
      { assignments: 0, submitted: 0, graded: 0, pending: 0, percentSum: 0 },
    );
    return {
      ...totals,
      avgPercent: courses.length ? Math.round(totals.percentSum / courses.length) : 0,
    };
  }, [courses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading progress…
      </div>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="py-10 text-center" role="alert">
          <p className="text-destructive font-medium mb-1">Failed to load progress analytics</p>
          <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
          <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (courses.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground mb-4">
            Enroll in a course to see your weekly progress and assignment status here.
          </p>
          <Button asChild>
            <Link to="/courses">Browse Courses</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="student-progress-analytics">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average course progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{summary.avgPercent}%</div>
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <Progress value={summary.avgPercent} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assignments graded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{summary.graded}</div>
              <CheckCircle2 className="h-5 w-5 text-ss-good" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">of {summary.assignments} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Awaiting feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{summary.submitted}</div>
              <Clock className="h-5 w-5 text-ss-warn" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">submitted, not yet graded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assignments to submit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{summary.pending}</div>
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">not started yet</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-course breakdown */}
      {courses.map((c) => (
        <Card key={c.courseId} data-testid={`analytics-course-${c.courseId}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg">
                  <Link to={`/courses/${c.courseId}`} className="hover:underline">
                    {c.courseTitle}
                  </Link>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {c.overallPercent}% complete • {c.assignments.graded}/{c.assignments.total} assignments graded
                </p>
              </div>
              <Button asChild size="sm">
                <Link to={c.nextAction.href}>
                  {c.nextAction.kind === 'assignment' ? (
                    <ClipboardList className="h-4 w-4 mr-2" />
                  ) : c.nextAction.kind === 'complete' ? (
                    <Trophy className="h-4 w-4 mr-2" />
                  ) : (
                    <BookOpen className="h-4 w-4 mr-2" />
                  )}
                  {c.nextAction.label}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
            <Progress value={c.overallPercent} className="mt-3 h-2" />
          </CardHeader>
          <CardContent>
            {c.weeks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No modules published yet.</p>
            ) : (
              <div className="space-y-2">
                {c.weeks.map((w) => (
                  <div
                    key={w.moduleId}
                    className="flex items-center gap-3 py-1"
                  >
                    <div className="flex-shrink-0 w-16 text-xs text-muted-foreground">
                      {w.week != null ? `Week ${w.week}` : '—'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate">{w.title}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {w.completed}/{w.total}
                        </span>
                      </div>
                      <Progress value={w.percent} className="h-1.5 mt-1" />
                    </div>
                    <Badge
                      variant={w.percent >= 100 ? 'default' : w.percent > 0 ? 'secondary' : 'outline'}
                      className="w-16 justify-center"
                    >
                      {w.percent}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {c.assignments.total > 0 && (
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-ss-good" />
                  {c.assignments.graded} graded
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3 text-ss-warn" />
                  {c.assignments.submitted} awaiting feedback
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3 text-primary" />
                  {c.assignments.pending} to submit
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StudentProgressAnalytics;
