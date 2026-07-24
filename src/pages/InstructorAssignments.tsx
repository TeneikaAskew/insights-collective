// ABOUTME: Instructor dashboard listing all assignments in a course with submission counts
// ABOUTME: and a direct link into the SpeedGrader for each assignment.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, ClipboardCheck, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import CourseErrorState from '@/components/course/CourseErrorState';

interface Row {
  id: string;
  title: string;
  due_date: string | null;
  points: number | null;
  content_item_id: string | null;
  enrolled: number;
  submitted: number;
  graded: number;
}

const InstructorAssignments = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { canEdit, isInstructor, isAdmin, loading: permLoading } = useCoursePermissions(courseId);
  const canManage = canEdit || isInstructor || isAdmin;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!courseId || !canManage) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [assignmentsRes, enrollmentsRes] = await Promise.all([
          supabase
            .from('assignments')
            .select('id, title, due_date, points, content_item_id')
            .eq('course_id', courseId)
            .order('due_date', { ascending: true, nullsFirst: false }),
          supabase.from('enrollments').select('user_id', { count: 'exact', head: true }).eq('course_id', courseId),
        ]);
        if (assignmentsRes.error) throw assignmentsRes.error;
        if (enrollmentsRes.error) throw enrollmentsRes.error;
        const assignments = assignmentsRes.data ?? [];
        const enrolled = enrollmentsRes.count ?? 0;
        const withCounts = await Promise.all(
          assignments.map(async (a: any) => {
            const [subRes, gradedRes] = await Promise.all([
              supabase
                .from('assignment_submissions')
                .select('id', { count: 'exact', head: true })
                .eq('assignment_id', a.id)
                .in('workflow_state', ['submitted', 'graded', 'pending_review']),
              supabase
                .from('assignment_submissions')
                .select('id', { count: 'exact', head: true })
                .eq('assignment_id', a.id)
                .eq('workflow_state', 'graded'),
            ]);
            if (subRes.error) throw subRes.error;
            if (gradedRes.error) throw gradedRes.error;
            return {
              ...a,
              enrolled,
              submitted: subRes.count ?? 0,
              graded: gradedRes.count ?? 0,
            } as Row;
          }),
        );
        setRows(withCounts);
      } catch (e: any) {
        setRows([]);
        setLoadError(e?.message ?? 'Failed to load assignments');
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, canManage, reloadKey]);

  if (permLoading) {
    return (
      <CourseLayout>
        <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
      </CourseLayout>
    );
  }
  if (!canManage) {
    return (
      <CourseLayout>
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>You need instructor access to view this page.</AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <Link
            to={`/courses/${courseId}`}
            className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Back to course
          </Link>
          <h1 className="text-3xl font-bold mt-2">Assignments</h1>
          <p className="text-muted-foreground">Track submissions and open the grader for each assignment.</p>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : loadError ? (
              <div className="p-6">
                <CourseErrorState
                  title="Failed to load assignments"
                  error={loadError}
                  onRetry={() => setReloadKey((k) => k + 1)}
                />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No assignments have been created in this course yet.
              </div>
            ) : (
              <div className="divide-y">
                {rows.map((r) => {
                  const pending = Math.max(0, r.submitted - r.graded);
                  const missing = Math.max(0, r.enrolled - r.submitted);
                  return (
                    <div key={r.id} className="p-4 flex flex-wrap items-center gap-4">
                      <div className="flex-1 min-w-[220px] text-left">
                        <div className="font-semibold">{r.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {r.due_date ? `Due ${new Date(r.due_date).toLocaleDateString()}` : 'No due date'}
                          {r.points_possible != null ? ` • ${r.points_possible} pts` : ''}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{r.submitted} submitted</Badge>
                        <Badge variant="outline">{r.graded} graded</Badge>
                        {pending > 0 && (
                          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                            {pending} pending
                          </Badge>
                        )}
                        {missing > 0 && (
                          <Badge variant="outline" className="text-muted-foreground">
                            {missing} missing
                          </Badge>
                        )}
                      </div>
                      {r.content_item_id ? (
                        <Button asChild size="sm">
                          <Link to={`/courses/${courseId}/assignments/${r.content_item_id}/grade`}>
                            <ClipboardCheck className="h-4 w-4 mr-1" /> Grade submissions
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          No submissions target
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CourseLayout>
  );
};

export default InstructorAssignments;
