// ABOUTME: Admin per-course progress dashboard with CSV export across all courses.
// ABOUTME: Aggregates enrollments, completion percentages, and issued certificates.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { Course } from '@/types/course';

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

interface Props {
  courses: Course[];
}

export function CourseProgressDashboard({ courses }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      if (!courses.length) { setRows([]); setLoading(false); return; }
      const ids = courses.map((c) => c.id);

      const [enrollRes, itemsRes, progRes, certRes] = await Promise.all([
        supabase.from('enrollments').select('course_id, user_id, progress').in('course_id', ids),
        supabase.from('content_items').select('id, module_id, modules!inner(course_id)').in('modules.course_id', ids),
        supabase.from('content_item_progressions').select('user_id, content_item_id, completed_at'),
        supabase.from('certificates').select('course_id').in('course_id', ids),
      ]);

      if (!alive) return;

      const enrollments = enrollRes.data ?? [];
      const items = (itemsRes.data ?? []) as any[];
      const progressions = progRes.data ?? [];
      const certs = certRes.data ?? [];

      // course -> item ids
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

      // completions per user per course
      const completedPerUserCourse: Record<string, Set<string>> = {};
      for (const p of progressions) {
        if (!p.completed_at) continue;
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
          const pct = total > 0 ? Math.round((done / total) * 100) : (e.progress ?? 0);
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
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [courses]);

  const totals = useMemo(() => rows.reduce(
    (a, r) => ({
      enrolled: a.enrolled + r.enrolled,
      completed: a.completed + r.completed,
      certificates: a.certificates + r.certificates,
    }),
    { enrolled: 0, completed: 0, certificates: 0 },
  ), [rows]);

  const exportCsv = () => {
    const header = ['Course', 'Category', 'Status', 'Enrolled', 'Completed', 'Avg progress %', 'Certificates issued'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const cells = [
        r.title, r.category ?? '', r.published ? 'Published' : 'Draft',
        r.enrolled, r.completed, r.avgProgress, r.certificates,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `course-progress-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Total enrollments</p>
          <p className="text-3xl font-semibold mt-1">{totals.enrolled}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Completed learners</p>
          <p className="text-3xl font-semibold mt-1">{totals.completed}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Certificates issued</p>
          <p className="text-3xl font-semibold mt-1">{totals.certificates}</p>
        </CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={exportCsv} variant="outline" className="rounded-full">
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Enrolled</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="w-[220px]">Avg progress</TableHead>
                <TableHead className="text-right">Certificates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-neutral-500">No courses yet.</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.courseId}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.category ?? '—'}</TableCell>
                  <TableCell>{r.published ? 'Published' : 'Draft'}</TableCell>
                  <TableCell className="text-right">{r.enrolled}</TableCell>
                  <TableCell className="text-right">{r.completed}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={r.avgProgress} className="h-2" />
                      <span className="text-xs text-neutral-600 w-10 text-right">{r.avgProgress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{r.certificates}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
