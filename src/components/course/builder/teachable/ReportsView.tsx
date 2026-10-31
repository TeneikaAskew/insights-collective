// ABOUTME: Instructor builder "Reports" tab — course KPIs, module progression and work status, each with a definition.
// ABOUTME: Data from courseReportService (RLS-scoped); links to the Students tab and gradebook. No revenue or video metrics.

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { NOT_STARTED_DAYS } from '@/services/courseRosterService';
import { fetchCourseReport } from '@/services/courseReportService';
import { TeachableBreadcrumb } from './TeachableBreadcrumb';

interface ReportsViewProps {
  courseId: string;
  courseTitle: string;
}

function Kpi({ label, value, definition }: { label: string; value: string; definition: string }) {
  return (
    <div className="ss-card bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
      <p className="text-xs text-muted-foreground mt-1">{definition}</p>
    </div>
  );
}

const show = (v: number | null, suffix = '%') => (v === null ? '—' : `${v}${suffix}`);

export function ReportsView({ courseId, courseTitle }: ReportsViewProps) {
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['builder-report', courseId],
    queryFn: () => fetchCourseReport(courseId),
    retry: false,
  });
  const studentsHref = `/courses/${courseId}/builder?view=students`;
  const gradebookHref = `/courses/${courseId}/gradebook`;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1200px] mx-auto">
      <TeachableBreadcrumb courseId={courseId} courseTitle={courseTitle} current="Reports" />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl mb-2">Reports</h2>
          {data && (
            <p className="text-sm text-muted-foreground">
              As of {new Date(dataUpdatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="ss-card bg-card p-12 flex items-center justify-center" role="status" aria-label="Loading reports">
          <Spinner />
        </div>
      ) : error ? (
        <div className="ss-card bg-card p-10 text-center" role="alert">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-destructive" />
          <h3 className="text-lg font-semibold mb-1">Couldn't load reports</h3>
          <p className="text-sm text-muted-foreground mb-4">{(error as Error).message}</p>
          <Button onClick={() => refetch()} disabled={isFetching}>Try again</Button>
        </div>
      ) : !data || data.enrolled === 0 ? (
        <div className="ss-card bg-card p-12 text-center">
          <div className="ss-chip rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <BarChart3 className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No enrollments yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Reports fill in once learners enroll in this course.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="kpi-heading">
            <h3 id="kpi-heading" className="text-lg font-semibold mb-3 text-left">Overview</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="Enrolled" value={String(data.enrolled)} definition="Learners with an enrollment in this course." />
              <Kpi label="Completion rate" value={show(data.completionRate)} definition={`${data.completed} of ${data.enrolled} learners at 100% progress.`} />
              <Kpi label="Average progress" value={show(data.avgProgress)} definition="Mean course progress across enrolled learners — same as the Students tab." />
              <Kpi label="Not started" value={String(data.notStarted)} definition={`0% progress ${NOT_STARTED_DAYS}+ days after enrolling.`} />
            </dl>
            <Link to={studentsHref} className="inline-block mt-3 text-sm text-primary underline-offset-4 hover:underline">
              View students
            </Link>
          </section>

          <section aria-labelledby="modules-heading">
            <h3 id="modules-heading" className="text-lg font-semibold mb-1 text-left">Module progression</h3>
            <p className="text-xs text-muted-foreground mb-3 text-left">
              Published sections only. "Finished" counts learners who completed every published lesson in the section.
            </p>
            {data.modules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-left">No published sections yet.</p>
            ) : (
              <ul className="ss-card bg-card divide-y divide-border" aria-label="Module progression">
                {data.modules.map((m) => (
                  <li key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="sm:w-1/3 min-w-0">
                      <p className="font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{m.itemCount} lessons · {m.learnersCompleted} finished</p>
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                      <Progress value={m.avgCompletion ?? 0} className="h-2 flex-1" aria-label={`${m.title} average completion`} />
                      <span className="text-sm tabular-nums w-10 text-right">{show(m.avgCompletion)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="work-heading">
            <h3 id="work-heading" className="text-lg font-semibold mb-1 text-left">Assignments & quizzes</h3>
            <p className="text-xs text-muted-foreground mb-3 text-left">
              One count per learner per graded item, using the latest attempt — same rules as the gradebook.
            </p>
            {data.work.total === 0 ? (
              <p className="text-sm text-muted-foreground text-left">This course has no assignments or quizzes.</p>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Kpi label="Graded" value={String(data.work.graded)} definition="Has a score." />
                <Kpi label="Needs grading" value={String(data.work.awaitingGrading)} definition="Submitted, no score yet." />
                <Kpi label="Not submitted" value={String(data.work.notSubmitted)} definition="No submission from the learner." />
              </dl>
            )}
            <Link to={gradebookHref} className="inline-block mt-3 text-sm text-primary underline-offset-4 hover:underline">
              Open gradebook
            </Link>
          </section>

          <section aria-labelledby="unavailable-heading" className="ss-card bg-card p-4">
            <h3 id="unavailable-heading" className="text-sm font-semibold mb-1 text-left">Not available yet</h3>
            <p className="text-xs text-muted-foreground text-left">
              Video watch time and revenue aren't recorded for this course, so they aren't shown.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export default ReportsView;
