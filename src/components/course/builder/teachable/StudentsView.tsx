// ABOUTME: Instructor builder "Students" tab — the real course roster with search, sort and attention filter.
// ABOUTME: Data comes from courseRosterService (RLS-scoped); rows link to the course gradebook for detail.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  NOT_STARTED_DAYS,
  averageProgress,
  fetchCourseRoster,
  filterAndSortRoster,
  type RosterSort,
} from '@/services/courseRosterService';
import { TeachableBreadcrumb } from './TeachableBreadcrumb';

interface StudentsViewProps {
  courseId: string;
  courseTitle: string;
}

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export function StudentsView({ courseId, courseTitle }: StudentsViewProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RosterSort>('enrolled_desc');
  const [attentionOnly, setAttentionOnly] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['builder-roster', courseId],
    queryFn: () => fetchCourseRoster(courseId),
    retry: false,
  });

  const learners = data ?? [];
  const visible = useMemo(
    () => filterAndSortRoster(learners, query, sort, attentionOnly),
    [learners, query, sort, attentionOnly],
  );
  const attentionCount = learners.filter((l) => l.needsAttention).length;
  const avg = averageProgress(learners);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1200px] mx-auto">
      <TeachableBreadcrumb courseId={courseId} courseTitle={courseTitle} current="Students" />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl mb-2">Students</h2>
          <p className="text-sm text-muted-foreground">Everyone enrolled in this course.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/courses/${courseId}/gradebook`}>Open gradebook</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="ss-card bg-card p-12 flex items-center justify-center" role="status" aria-label="Loading students">
          <Spinner />
        </div>
      ) : error ? (
        <div className="ss-card bg-card p-10 text-center" role="alert">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-destructive" />
          <h3 className="text-lg font-semibold mb-1">Couldn't load students</h3>
          <p className="text-sm text-muted-foreground mb-4">{(error as Error).message}</p>
          <Button onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="h-4 w-4 mr-2" /> Try again
          </Button>
        </div>
      ) : learners.length === 0 ? (
        <div className="ss-card bg-card p-12 text-center">
          <div className="ss-chip rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <Users className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No students yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Learners appear here as soon as they enroll from the course page.
          </p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="ss-card bg-card p-4">
              <dt className="text-xs text-muted-foreground">Enrolled</dt>
              <dd className="text-2xl font-semibold">{learners.length}</dd>
            </div>
            <div className="ss-card bg-card p-4">
              <dt className="text-xs text-muted-foreground">Average progress</dt>
              <dd className="text-2xl font-semibold" data-testid="roster-avg-progress">{avg === null ? '—' : `${avg}%`}</dd>
              {avg === null && (
                <p className="text-xs text-muted-foreground mt-1">No published lessons to measure yet.</p>
              )}
            </div>
            <div className="ss-card bg-card p-4">
              <dt className="text-xs text-muted-foreground">Not started after {NOT_STARTED_DAYS} days</dt>
              <dd className="text-2xl font-semibold">{attentionCount}</dd>
            </div>
          </dl>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Search students"
                placeholder="Search by name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as RosterSort)}>
              <SelectTrigger className="sm:w-56" aria-label="Sort students">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enrolled_desc">Newest enrollment</SelectItem>
                <SelectItem value="enrolled_asc">Oldest enrollment</SelectItem>
                <SelectItem value="progress_desc">Most progress</SelectItem>
                <SelectItem value="progress_asc">Least progress</SelectItem>
                <SelectItem value="name_asc">Name A–Z</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={attentionOnly ? 'default' : 'outline'}
              aria-pressed={attentionOnly}
              onClick={() => setAttentionOnly((v) => !v)}
            >
              Needs attention
            </Button>
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-left">No students match these filters.</p>
          ) : (
            <ul className="ss-card bg-card divide-y divide-border" aria-label="Enrolled students">
              {visible.map((l) => (
                <li key={l.userId} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 sm:w-1/3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center text-sm font-medium">
                      {l.avatarUrl ? <img src={l.avatarUrl} alt="" className="h-full w-full object-cover" /> : l.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{l.name}</p>
                      <p className="text-xs text-muted-foreground">Enrolled {formatDate(l.enrolledAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-1">
                    <Progress value={l.progress ?? 0} className="h-2 flex-1" aria-label={`${l.name} progress`} />
                    <span
                      className="text-sm tabular-nums w-24 text-right"
                      title={l.progress === null ? 'No published lessons yet' : `${l.completedItems} of ${l.totalItems} lessons finished`}
                    >
                      {l.progress === null ? '—' : `${l.progress}%`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end sm:w-48">
                    {l.needsAttention && (
                      <span className="text-xs rounded-full px-2 py-0.5 bg-destructive/10 text-destructive">Not started</span>
                    )}
                    <Link
                      to={`/courses/${courseId}/gradebook`}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                      aria-label={`View grades for ${l.name}`}
                    >
                      View grades
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default StudentsView;
