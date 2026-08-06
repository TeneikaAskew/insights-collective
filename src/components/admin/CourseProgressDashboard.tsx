// ABOUTME: Admin per-course progress dashboard with search, sort, filters, and CSV export.
// ABOUTME: Aggregates enrollments, completion percentages, and issued certificates.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  Download,
  GraduationCap,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { downloadCsv } from '@/utils/csv';
import { createLogger } from '@/utils/logger';
import type { Course } from '@/types/course';

const logger = createLogger('CourseProgressDashboard');

type Row = {
  courseId: string;
  title: string;
  category: string | null;
  published: boolean;
  enrolled: number;
  completed: number;
  avgProgress: number;
  certificates: number;
};

type SortKey = 'title' | 'enrolled' | 'completed' | 'avgProgress' | 'certificates';
type StatusFilter = 'all' | 'published' | 'draft';

interface Props {
  courses: Course[];
}

export function CourseProgressDashboard({ courses }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('enrolled');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      if (!courses.length) { setRows([]); setLoading(false); return; }
      const ids = courses.map((c) => c.id);

      const [enrollRes, itemsRes, certRes] = await Promise.all([
        // completion_status, not progress: enrollments has no `progress` column,
        // so this select returned 42703 and the dashboard showed zeros for every
        // course. Confirmed against the live schema by the query gate.
        supabase.from('enrollments').select('course_id, user_id, completion_status').in('course_id', ids),
        supabase.from('content_items').select('id, module_id, modules!inner(course_id)').in('modules.course_id', ids),
        supabase.from('certificates').select('course_id').in('course_id', ids),
      ]);

      if (!alive) return;

      // Every one of these reads used to be `res.data ?? []`, so an RLS denial,
      // a schema drift or a network failure produced empty arrays and the table
      // below rendered 0 enrolled / 0 completed / 0% / 0 certificates for every
      // course — styled exactly like real data, with a fresh "refreshed at"
      // timestamp under it. The 42703 incident this file's comments describe was
      // found only because someone doubted the zeros. An admin reading this
      // dashboard has no way to tell a quiet course from a broken query, so the
      // failure has to reach the screen.
      const failed = [
        enrollRes.error && 'enrollments',
        itemsRes.error && 'content items',
        certRes.error && 'certificates',
      ].filter(Boolean) as string[];

      if (failed.length) {
        logger.error('aggregate query failed', {
          enrollments: enrollRes.error,
          items: itemsRes.error,
          certificates: certRes.error,
        });
        setLoadError(`Could not load ${failed.join(', ')}.`);
        setRows([]);
        setLoading(false);
        return;
      }

      const enrollments = enrollRes.data ?? [];
      const items = (itemsRes.data ?? []) as any[];
      const certs = certRes.data ?? [];

      // Fetch progressions only for THIS course set's content items. The
      // previous query selected the entire content_item_progressions table and
      // filtered client-side, which does not scale. Chunk the id list to keep
      // each request URL within limits.
      const itemIds = items.map((it) => it.id);
      const progressions: any[] = [];
      const CHUNK = 200;
      for (let i = 0; i < itemIds.length; i += CHUNK) {
        const chunk = itemIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from('content_item_progressions')
          // workflow_state, not completed_at — same 42703 as above. 'read' and
          // 'completed' both count as done, matching the predicate
          // CourseProgressOverview and StudentProgressAnalytics already use.
          .select('user_id, content_item_id, workflow_state')
          .in('content_item_id', chunk);
        if (!alive) return;
        // A failed chunk silently shrank the completion numbers rather than
        // zeroing them, which is worse: partially-true progress is indistinguishable
        // from students falling behind.
        if (error) {
          logger.error('progression chunk failed', error);
          setLoadError('Could not load lesson progress.');
          setRows([]);
          setLoading(false);
          return;
        }
        if (data) progressions.push(...data);
      }

      const itemsByCourse: Record<string, Set<string>> = {};
      for (const it of items) {
        const cid = it.modules?.course_id;
        if (!cid) continue;
        (itemsByCourse[cid] ??= new Set()).add(it.id);
      }
      const itemToCourse: Record<string, string> = {};
      for (const [cid, set] of Object.entries(itemsByCourse)) {
        set.forEach((iid) => (itemToCourse[iid] = cid));
      }

      const completedPerUserCourse: Record<string, Set<string>> = {};
      for (const p of progressions) {
        if (p.workflow_state !== 'read' && p.workflow_state !== 'completed') continue;
        const cid = itemToCourse[p.content_item_id];
        if (!cid) continue;
        const k = `${p.user_id}::${cid}`;
        (completedPerUserCourse[k] ??= new Set()).add(p.content_item_id);
      }

      const certCount: Record<string, number> = {};
      for (const c of certs) certCount[c.course_id] = (certCount[c.course_id] ?? 0) + 1;

      const out: Row[] = courses.map((c) => {
        const total = itemsByCourse[c.id]?.size ?? 0;
        const enrolled = enrollments.filter((e) => e.course_id === c.id);
        let completedUsers = 0;
        let sumPct = 0;
        for (const e of enrolled) {
          const done = completedPerUserCourse[`${e.user_id}::${c.id}`]?.size ?? 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : (Number(e.completion_status) === 100 ? 100 : 0);
          sumPct += pct;
          if (total > 0 && done >= total) completedUsers += 1;
        }
        return {
          courseId: c.id,
          title: c.title,
          category: c.category ?? null,
          published: !!c.published,
          enrolled: enrolled.length,
          completed: completedUsers,
          avgProgress: enrolled.length ? Math.round(sumPct / enrolled.length) : 0,
          certificates: certCount[c.id] ?? 0,
        };
      });

      setRows(out);
      setRefreshedAt(new Date());
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [courses, reloadToken]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (statusFilter === 'published' && !r.published) return false;
      if (statusFilter === 'draft' && r.published) return false;
      if (category !== 'all' && (r.category ?? '') !== category) return false;
      if (q && !r.title.toLowerCase().includes(q) && !(r.category ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, search, statusFilter, category, sortKey, sortDir]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (a, r) => ({
          enrolled: a.enrolled + r.enrolled,
          completed: a.completed + r.completed,
          certificates: a.certificates + r.certificates,
          avgWeighted: a.avgWeighted + r.avgProgress * r.enrolled,
          enrolledForAvg: a.enrolledForAvg + r.enrolled,
        }),
        { enrolled: 0, completed: 0, certificates: 0, avgWeighted: 0, enrolledForAvg: 0 },
      ),
    [filtered],
  );
  const avgProgress = totals.enrolledForAvg ? Math.round(totals.avgWeighted / totals.enrolledForAvg) : 0;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'title' ? 'asc' : 'desc'); }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const progressTone = (pct: number) => {
    if (pct >= 75) return 'bg-ss-good';
    if (pct >= 40) return 'bg-ss-warn';
    return 'bg-ss-bad';
  };

  const exportCsv = () => {
    const header = ['Course', 'Category', 'Status', 'Enrolled', 'Completed', 'Avg progress %', 'Certificates issued'];
    const rows = filtered.map((r) => [
      r.title, r.category ?? '', r.published ? 'Published' : 'Draft',
      r.enrolled, r.completed, r.avgProgress, r.certificates,
    ]);
    downloadCsv(`course-progress-${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  // Shown INSTEAD of the table, never alongside it. A partial render here would
  // put real-looking numbers next to a warning and leave the admin to guess
  // which columns to trust.
  if (loadError) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <p className="font-semibold">Course progress is unavailable</p>
          <p className="text-sm text-muted-foreground">
            {loadError} These figures are not being shown because they would read as
            zeros rather than as an error.
          </p>
          <Button variant="outline" onClick={() => setReloadToken((n) => n + 1)}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const StatCard = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: React.ReactNode; hint?: string }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-3xl font-semibold mt-1 tabular-nums">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 text-primary p-2">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total enrollments" value={totals.enrolled} hint={`${filtered.length} course${filtered.length === 1 ? '' : 's'}`} />
        <StatCard icon={GraduationCap} label="Completed learners" value={totals.completed} hint={totals.enrolled ? `${Math.round((totals.completed / totals.enrolled) * 100)}% completion rate` : '—'} />
        <StatCard icon={TrendingUp} label="Avg progress" value={`${avgProgress}%`} hint="Weighted by enrollment" />
        <StatCard icon={Award} label="Certificates issued" value={totals.certificates} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search course or category…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
        <Button onClick={exportCsv} variant="outline">
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {refreshedAt && (
        <p className="text-xs text-muted-foreground -mt-3">
          Updated {refreshedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} • {filtered.length} of {rows.length} courses shown
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('title')}>
                    Course {sortIcon('title')}
                  </button>
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('enrolled')}>
                    Enrolled {sortIcon('enrolled')}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('completed')}>
                    Completed {sortIcon('completed')}
                  </button>
                </TableHead>
                <TableHead className="w-[240px]">
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('avgProgress')}>
                    Avg progress {sortIcon('avgProgress')}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="inline-flex items-center gap-1 hover:text-foreground ml-auto" onClick={() => toggleSort('certificates')}>
                    Certificates {sortIcon('certificates')}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    {rows.length === 0 ? 'No courses yet.' : 'No courses match your filters.'}
                  </TableCell>
                </TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.courseId}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell className="text-muted-foreground">{r.category ?? '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={r.published ? 'bg-ss-good-chip text-ss-good border-ss-good' : 'bg-muted text-muted-foreground'}
                    >
                      {r.published ? 'Published' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.enrolled}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.completed}
                    {r.enrolled > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({Math.round((r.completed / r.enrolled) * 100)}%)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`absolute inset-y-0 left-0 ${progressTone(r.avgProgress)} transition-all`} style={{ width: `${r.avgProgress}%` }} />
                      </div>
                      <span className="text-xs font-medium tabular-nums w-10 text-right">{r.avgProgress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.certificates}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
