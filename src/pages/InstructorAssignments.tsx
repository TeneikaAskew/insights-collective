// ABOUTME: Instructor-facing hub listing every assignment in a course with submission
// ABOUTME: counts (submitted / graded / pending) and quick links into the grading interface.
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FileText, ListChecks, Users, ClipboardCheck, Shield, ArrowLeft } from 'lucide-react';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useAssignments } from '@/hooks/useAssignments';

interface SubmissionRow {
  id: string;
  assignment_id: string;
  user_id: string;
  grade: number | null;
  submitted_at: string | null;
  workflow_state?: string | null;
  status?: string | null;
}

const InstructorAssignments = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { canEdit, isInstructor } = useCoursePermissions(courseId);
  const { data: assignments = [], isLoading } = useAssignments(courseId);

  const assignmentIds = useMemo(() => assignments.map((a: any) => a.id), [assignments]);

  const { data: submissions = [], isLoading: subsLoading } = useQuery({
    queryKey: ['instructor-submissions', courseId, assignmentIds],
    enabled: !!courseId && assignmentIds.length > 0,
    queryFn: async (): Promise<SubmissionRow[]> => {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('id, assignment_id, user_id, grade, submitted_at, workflow_state, status')
        .in('assignment_id', assignmentIds);
      if (error) throw error;
      return (data ?? []) as SubmissionRow[];
    },
  });

  const { data: enrollmentCount = 0 } = useQuery({
    queryKey: ['course-enrollment-count', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { count } = await supabase
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', courseId!);
      return count ?? 0;
    },
  });

  if (!isInstructor && !canEdit) {
    return (
      <CourseLayout>
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Only instructors can view the assignments dashboard.
          </AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  const buckets = useMemo(() => {
    const byAssignment = new Map<string, SubmissionRow[]>();
    for (const s of submissions) {
      const list = byAssignment.get(s.assignment_id) ?? [];
      list.push(s);
      byAssignment.set(s.assignment_id, list);
    }
    return byAssignment;
  }, [submissions]);

  const totals = useMemo(() => {
    let submitted = 0;
    let graded = 0;
    for (const s of submissions) {
      if (s.submitted_at) submitted += 1;
      const isGraded = s.grade != null || s.workflow_state === 'graded' || s.status === 'graded';
      if (isGraded) graded += 1;
    }
    return { submitted, graded, pending: Math.max(0, submitted - graded) };
  }, [submissions]);

  return (
    <CourseLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-left">
            <Link
              to={`/courses/${courseId}`}
              className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Back to course
            </Link>
            <h1 className="text-3xl font-bold mt-2">Assignments</h1>
            <p className="text-muted-foreground">Review submissions, grade, and publish feedback.</p>
          </div>
          <Button asChild variant="outline">
            <Link to={`/courses/${courseId}/gradebook`}>Open gradebook</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={<Users className="h-4 w-4" />} label="Enrolled students" value={enrollmentCount} />
          <StatCard icon={<FileText className="h-4 w-4" />} label="Total submissions" value={totals.submitted} />
          <StatCard
            icon={<ClipboardCheck className="h-4 w-4" />}
            label="Pending grading"
            value={totals.pending}
            highlight={totals.pending > 0}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ListChecks className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="text-lg font-semibold">No assignments yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add an assignment from the course builder to start collecting submissions.
              </p>
              <Button asChild>
                <Link to={`/courses/${courseId}/builder`}>Open builder</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment: any) => {
              const subs = buckets.get(assignment.id) ?? [];
              const submitted = subs.filter((s) => s.submitted_at).length;
              const graded = subs.filter(
                (s) => s.grade != null || s.workflow_state === 'graded' || s.status === 'graded',
              ).length;
              const pending = Math.max(0, submitted - graded);
              const missing = Math.max(0, enrollmentCount - submitted);
              const contentItemId = assignment.content_item_id;

              return (
                <Card key={assignment.id} className="hover:border-primary/40 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">{assignment.title}</CardTitle>
                          {assignment.is_published === false && (
                            <Badge variant="outline">Draft</Badge>
                          )}
                          {assignment.module?.title && (
                            <Badge variant="secondary">{assignment.module.title}</Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1">
                          {assignment.due_date
                            ? `Due ${format(new Date(assignment.due_date), 'MMM d, yyyy')}`
                            : 'No due date'}
                          {assignment.points ? ` • ${assignment.points} points` : ''}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {contentItemId ? (
                          <Button asChild size="sm">
                            <Link to={`/courses/${courseId}/assignments/${contentItemId}/grade`}>
                              Grade submissions
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/courses/${courseId}/gradebook`}>Grade in gradebook</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <MiniStat label="Submitted" value={submitted} />
                      <MiniStat
                        label="Pending"
                        value={pending}
                        tone={pending > 0 ? 'warn' : 'muted'}
                      />
                      <MiniStat label="Graded" value={graded} tone="success" />
                      <MiniStat label="Missing" value={missing} tone="muted" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {subsLoading && (
          <p className="text-xs text-muted-foreground text-center">Loading submissions…</p>
        )}
      </div>
    </CourseLayout>
  );
};

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-primary/60' : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={`mt-2 text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: number;
  tone?: 'muted' | 'success' | 'warn';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'warn'
      ? 'text-amber-600'
      : 'text-foreground';
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

export default InstructorAssignments;
