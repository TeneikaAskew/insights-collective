// ABOUTME: Admin unified cross-course export report.
// ABOUTME: Aggregates courses, enrollments, completions, and certificates into a single CSV.
import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toCsv } from '@/utils/csv';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Loader2, Users, GraduationCap, Award, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Course } from '@/types/course';

interface Props {
  courses: Course[];
}

type ReportRow = {
  courseId: string;
  courseTitle: string;
  category: string;
  published: boolean;
  userId: string;
  learnerName: string;
  learnerEmail: string;
  enrolledAt: string;
  itemsCompleted: number;
  totalItems: number;
  progressPct: number;
  fullyCompleted: boolean;
  certificateIssued: boolean;
  certificateCode: string;
  certificateIssuedAt: string;
};

type Summary = {
  courses: number;
  enrollments: number;
  completions: number;
  certificates: number;
};

function download(filename: string, contents: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function UnifiedExportReport({ courses }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ReportRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const buildRows = async (): Promise<{ rows: ReportRow[]; summary: Summary }> => {
    if (!courses.length) return { rows: [], summary: { courses: 0, enrollments: 0, completions: 0, certificates: 0 } };
    const ids = courses.map((c) => c.id);

    const [enrollRes, itemsRes, progRes, certRes, usersRes] = await Promise.all([
      // completion_status, not progress, and enrolled_at, not created_at —
      // enrollments has neither `progress` nor `created_at`, so this select
      // returned 42703 and the whole export aborted before writing a row.
      supabase.from('enrollments').select('course_id, user_id, completion_status, enrolled_at').in('course_id', ids),
      supabase.from('content_items').select('id, module_id, modules!inner(course_id)').in('modules.course_id', ids),
      // workflow_state, not completed_at — same 42703. 'read' and 'completed'
      // both count as done.
      supabase.from('content_item_progressions').select('user_id, content_item_id, workflow_state'),
      supabase.from('certificates').select('user_id, course_id, verification_code, issued_at').in('course_id', ids),
      supabase.functions.invoke('admin-users', { body: { action: 'listUsers' } }),
    ]);

    // A failed query must abort the report — otherwise the export "succeeds"
    // with fabricated zeros for enrollments/completions/certificates.
    if (enrollRes.error) throw enrollRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (progRes.error) throw progRes.error;
    if (certRes.error) throw certRes.error;
    if (usersRes.error) throw usersRes.error;

    const enrollments = (enrollRes.data ?? []) as any[];
    const items = (itemsRes.data ?? []) as any[];
    const progressions = (progRes.data ?? []) as any[];
    const certs = (certRes.data ?? []) as any[];
    const users = ((usersRes.data as any)?.users ?? []) as any[];

    const itemsByCourse: Record<string, Set<string>> = {};
    const itemToCourse: Record<string, string> = {};
    for (const it of items) {
      const cid = it.modules?.course_id;
      if (!cid) continue;
      (itemsByCourse[cid] ??= new Set()).add(it.id);
      itemToCourse[it.id] = cid;
    }

    const completedByUserCourse: Record<string, number> = {};
    for (const p of progressions) {
      if (p.workflow_state !== 'read' && p.workflow_state !== 'completed') continue;
      const cid = itemToCourse[p.content_item_id];
      if (!cid) continue;
      const k = `${p.user_id}::${cid}`;
      completedByUserCourse[k] = (completedByUserCourse[k] ?? 0) + 1;
    }

    const certByUserCourse: Record<string, { code: string; issued_at: string }> = {};
    for (const c of certs) {
      certByUserCourse[`${c.user_id}::${c.course_id}`] = {
        code: c.verification_code ?? '',
        issued_at: c.issued_at ?? '',
      };
    }

    const userMap: Record<string, { name: string; email: string }> = {};
    for (const u of users) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || u.id;
      userMap[u.id] = { name, email: u.email ?? '' };
    }

    const courseMap: Record<string, Course> = Object.fromEntries(courses.map((c) => [c.id, c]));

    const rows: ReportRow[] = enrollments.map((e) => {
      const course = courseMap[e.course_id];
      const total = itemsByCourse[e.course_id]?.size ?? 0;
      const done = completedByUserCourse[`${e.user_id}::${e.course_id}`] ?? 0;
      const pct = total > 0 ? Math.round((done / total) * 100) : (e.completion_status === 'completed' ? 100 : 0);
      const cert = certByUserCourse[`${e.user_id}::${e.course_id}`];
      const learner = userMap[e.user_id] ?? { name: e.user_id, email: '' };
      return {
        courseId: e.course_id,
        courseTitle: course?.title ?? '(unknown course)',
        category: course?.category ?? '',
        published: !!course?.published,
        userId: e.user_id,
        learnerName: learner.name,
        learnerEmail: learner.email,
        enrolledAt: e.enrolled_at ?? '',
        itemsCompleted: done,
        totalItems: total,
        progressPct: pct,
        fullyCompleted: total > 0 && done >= total,
        certificateIssued: !!cert,
        certificateCode: cert?.code ?? '',
        certificateIssuedAt: cert?.issued_at ?? '',
      };
    });

    return {
      rows,
      summary: {
        courses: courses.length,
        enrollments: enrollments.length,
        completions: rows.filter((r) => r.fullyCompleted).length,
        certificates: certs.length,
      },
    };
  };

  const generate = async () => {
    setLoading(true);
    try {
      const { rows, summary } = await buildRows();
      setPreview(rows);
      setSummary(summary);
      setGeneratedAt(new Date());
      toast({ title: 'Report generated', description: `${rows.length} enrollment rows across ${summary.courses} courses.` });
    } catch (err: any) {
      toast({ title: 'Report failed', description: err?.message ?? 'Could not aggregate report data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!preview) return;
    const header = [
      'Course ID', 'Course Title', 'Category', 'Course Published',
      'Learner ID', 'Learner Name', 'Learner Email', 'Enrolled At',
      'Items Completed', 'Total Items', 'Progress %', 'Fully Completed',
      'Certificate Issued', 'Certificate Code', 'Certificate Issued At',
    ];
    const rows = preview.map((r) => [
      r.courseId, r.courseTitle, r.category, r.published ? 'Yes' : 'No',
      r.userId, r.learnerName, r.learnerEmail, r.enrolledAt,
      r.itemsCompleted, r.totalItems, r.progressPct, r.fullyCompleted ? 'Yes' : 'No',
      r.certificateIssued ? 'Yes' : 'No', r.certificateCode, r.certificateIssuedAt,
    ]);
    download(`cross-course-report-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(header, rows));
  };

  const exportJson = () => {
    if (!preview) return;
    download(
      `cross-course-report-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows: preview }, null, 2),
      'application/json',
    );
  };

  const previewRows = useMemo(() => (preview ?? []).slice(0, 10), [preview]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Unified cross-course report
              </CardTitle>
              <CardDescription>
                One export combining course metadata, enrollments, per-learner progress, and issued certificates
                across every course. One row per learner-course pair.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={generate} disabled={loading} variant="default">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                {preview ? 'Regenerate' : 'Generate report'}
              </Button>
              <Button onClick={exportCsv} disabled={!preview || loading} variant="outline">
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
              <Button onClick={exportJson} disabled={!preview || loading} variant="outline">
                <Download className="h-4 w-4 mr-2" /> JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryTile icon={BookOpen} label="Courses" value={summary.courses} />
              <SummaryTile icon={Users} label="Enrollments" value={summary.enrollments} />
              <SummaryTile icon={GraduationCap} label="Full completions" value={summary.completions} />
              <SummaryTile icon={Award} label="Certificates" value={summary.certificates} />
            </div>
          )}

          {generatedAt && preview && (
            <p className="text-xs text-muted-foreground">
              Generated {generatedAt.toLocaleString()} • {preview.length} rows • preview shows first {previewRows.length}
            </p>
          )}

          {preview && (
            <div className="rounded-md border overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2">Course</th>
                    <th className="px-3 py-2">Learner</th>
                    <th className="px-3 py-2 text-right">Progress</th>
                    <th className="px-3 py-2 text-center">Completed</th>
                    <th className="px-3 py-2 text-center">Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No enrollments yet.</td></tr>
                  ) : previewRows.map((r, i) => (
                    <tr key={`${r.userId}-${r.courseId}-${i}`} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.courseTitle}</div>
                        <div className="text-xs text-muted-foreground">{r.category || '—'}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{r.learnerName}</div>
                        <div className="text-xs text-muted-foreground">{r.learnerEmail}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.progressPct}% <span className="text-xs text-muted-foreground">({r.itemsCompleted}/{r.totalItems})</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.fullyCompleted ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200" variant="outline">Yes</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.certificateIssued ? <Badge className="bg-amber-100 text-amber-800 border-amber-200" variant="outline">Issued</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!preview && !loading && (
            <p className="text-sm text-muted-foreground">
              Click <strong>Generate report</strong> to aggregate the latest data. You can then download it as CSV or JSON.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </div>
      <div className="rounded-md bg-primary/10 text-primary p-2"><Icon className="h-4 w-4" /></div>
    </div>
  );
}
