// ABOUTME: Per-week (module) quiz results view. Students see their own scores;
// ABOUTME: instructors and admins see class averages and per-student breakdowns.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, GraduationCap, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import CourseErrorState from '@/components/course/CourseErrorState';

interface QuizRow {
  id: string;
  title: string;
  points_possible: number | null;
  module_id: string | null;
}
interface ModuleRow {
  id: string;
  title: string;
  week: number | null;
  position: number | null;
}
interface SubRow {
  quiz_id: string;
  user_id: string;
  score: number | null;
  kept_score: number | null;
  attempt: number;
  workflow_state: string;
  finished_at: string | null;
}
interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

const CourseQuizResults = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { canEdit, isInstructor, isAdmin } = useCoursePermissions(courseId);
  const canSeeAll = canEdit || isInstructor || isAdmin;

  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [submissions, setSubmissions] = useState<SubRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!courseId || !user?.id) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const modRes = await supabase
          .from('modules')
          .select('id, title, week, position')
          .eq('course_id', courseId)
          .order('position', { ascending: true, nullsFirst: false });
        if (modRes.error) throw modRes.error;
        const moduleIds = (modRes.data ?? []).map((m: any) => m.id);
        if (!moduleIds.length) {
          setModules([]);
          setQuizzes([]);
          setSubmissions([]);
          setLoading(false);
          return;
        }
        const quizRes = await supabase
          .from('quizzes')
          .select('id, title, points_possible, module_id')
          .in('module_id', moduleIds);
        if (quizRes.error) throw quizRes.error;
        const quizIds = (quizRes.data ?? []).map((q: any) => q.id);
        let subRes: any = { data: [] };
        if (quizIds.length) {
          let q = supabase
            .from('quiz_submissions')
            .select('quiz_id, user_id, score, kept_score, attempt, workflow_state, finished_at')
            .in('quiz_id', quizIds)
            .eq('workflow_state', 'complete');
          if (!canSeeAll) q = q.eq('user_id', user.id);
          subRes = await q;
          if (subRes.error) throw subRes.error;
        }
        setModules((modRes.data ?? []) as ModuleRow[]);
        setQuizzes((quizRes.data ?? []) as QuizRow[]);
        setSubmissions((subRes.data ?? []) as SubRow[]);

        if (canSeeAll) {
          const userIds = Array.from(new Set((subRes.data ?? []).map((s: any) => s.user_id))) as string[];
          if (userIds.length) {
            // profiles has first_name/last_name and no email at all — email
            // lives on auth.users, which the browser cannot read. Asking for
            // `full_name, email` returned 42703 for every instructor and admin;
            // students never hit it because this branch is staff-only, which is
            // why nothing noticed.
            const profRes = await supabase
              .from('profiles')
              .select('id, first_name, last_name')
              .in('id', userIds);
            if (profRes.error) throw profRes.error;
            const map: Record<string, Profile> = {};
            (profRes.data ?? []).forEach((p: any) => (map[p.id] = p));
            setProfiles(map);
          }
        }
      } catch (e: any) {
        setModules([]);
        setQuizzes([]);
        setSubmissions([]);
        setLoadError(e?.message ?? 'Failed to load quiz results');
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, user?.id, canSeeAll, reloadKey]);

  const grouped = useMemo(() => {
    return modules.map((m) => {
      const modQuizzes = quizzes.filter((q) => q.module_id === m.id);
      return {
        module: m,
        quizzes: modQuizzes.map((q) => {
          const subs = submissions.filter((s) => s.quiz_id === q.id);
          // Keep best (kept_score) per user
          const bestByUser = new Map<string, SubRow>();
          subs.forEach((s) => {
            const prev = bestByUser.get(s.user_id);
            const cur = s.kept_score ?? s.score ?? 0;
            const pv = prev ? prev.kept_score ?? prev.score ?? 0 : -1;
            if (!prev || cur > pv) bestByUser.set(s.user_id, s);
          });
          const bests = Array.from(bestByUser.values());
          const total = q.points_possible || 0;
          const avg = bests.length
            ? bests.reduce((s, r) => s + (r.kept_score ?? r.score ?? 0), 0) / bests.length
            : 0;
          const mine = bests.find((s) => s.user_id === user?.id);
          return { quiz: q, bests, total, avg, mine };
        }),
      };
    });
  }, [modules, quizzes, submissions, user?.id]);

  if (!courseId) return null;

  return (
    <CourseLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <Link
            to={`/courses/${courseId}`}
            className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Back to course
          </Link>
          <h1 className="text-3xl font-bold mt-2">Quiz results by week</h1>
          <p className="text-muted-foreground">
            {canSeeAll ? 'Class scores across every module.' : 'Your best score for each quiz.'}
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : loadError ? (
          <CourseErrorState
            title="Failed to load quiz results"
            error={loadError}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        ) : grouped.every((g) => g.quizzes.length === 0) ? (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>This course has no quizzes yet.</AlertDescription>
          </Alert>
        ) : (
          grouped.map(({ module, quizzes: qs }) =>
            qs.length === 0 ? null : (
              <Card key={module.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    {module.week != null ? `Week ${module.week}: ` : ''}
                    {module.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {qs.map(({ quiz, bests, total, avg, mine }) => (
                    <div key={quiz.id} className="border rounded-md p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div className="text-left">
                          <div className="font-semibold">{quiz.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {total} pts possible
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {canSeeAll ? (
                            <>
                              <Badge variant="secondary">{bests.length} students completed</Badge>
                              {bests.length > 0 && (
                                <Badge variant="outline">
                                  Class avg: {avg.toFixed(1)} / {total}
                                </Badge>
                              )}
                            </>
                          ) : mine ? (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                              Your best: {(mine.kept_score ?? mine.score ?? 0).toFixed(1)} / {total}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not attempted</Badge>
                          )}
                        </div>
                      </div>
                      {canSeeAll && bests.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            {bests
                              .sort(
                                (a, b) =>
                                  (b.kept_score ?? b.score ?? 0) - (a.kept_score ?? a.score ?? 0),
                              )
                              .map((s) => {
                                const p = profiles[s.user_id];
                                const score = s.kept_score ?? s.score ?? 0;
                                const pct = total ? Math.round((score / total) * 100) : 0;
                                return (
                                  <div
                                    key={s.user_id}
                                    className="flex justify-between text-foreground"
                                  >
                                    <span className="truncate">
                                      {[p?.first_name, p?.last_name].filter(Boolean).join(' ') || s.user_id.slice(0, 8)}
                                    </span>
                                    <span className="font-medium">
                                      {score.toFixed(1)} / {total} ({pct}%)
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ),
          )
        )}
      </div>
    </CourseLayout>
  );
};

export default CourseQuizResults;
