// ABOUTME: Admin landing page — the "Command Center". Shows real platform KPIs,
// ABOUTME: a launcher grid deep-linking to each admin area, an honest activity
// ABOUTME: link-out, and the ResourceManagement panel. No fabricated metrics.

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Users, BookOpen, Award, CheckCircle, GraduationCap, Calendar,
  FormInput, Newspaper, Eye, Activity, ArrowRight,
} from 'lucide-react';
import { useCoursesManagement } from '@/hooks/useCoursesManagement';
import { supabase } from '@/integrations/supabase/client';
import ResourceManagement from '@/components/admin/ResourceManagement';
import { cn } from '@/lib/utils';

const AdminDashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user && (!user.roles || !user.roles.includes('admin'))) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  // Load real counts so nothing on this page is a hardcoded placeholder. A
  // failed count renders as "—" and is never presented as an authoritative 0.
  const [userCount, setUserCount] = useState<number | null>(null);
  const [enrollmentCount, setEnrollmentCount] = useState<number | null>(null);
  const [certificateCount, setCertificateCount] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [formCount, setFormCount] = useState<number | null>(null);
  const [blogCount, setBlogCount] = useState<number | null>(null);
  const [pageVisibilityCount, setPageVisibilityCount] = useState<number | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsReloadKey, setStatsReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsError(null);
      const headCount = (table: string) =>
        (supabase.from(table as any) as any).select('id', { count: 'exact', head: true });
      const [
        enrollRes, certRes, profileRes, eventRes, formRes, blogRes, pvRes,
      ] = await Promise.all([
        headCount('enrollments'),
        headCount('certificates'),
        headCount('profiles'),
        headCount('events'),
        headCount('forms'),
        headCount('blog_posts'),
        headCount('page_visibility'),
      ]);
      if (cancelled) return;
      const setFrom = (
        res: { error: unknown; count: number | null },
        set: (n: number | null) => void,
      ) => set(res.error ? null : res.count ?? 0);
      setFrom(enrollRes, setEnrollmentCount);
      setFrom(certRes, setCertificateCount);
      setFrom(profileRes, setUserCount);
      setFrom(eventRes, setEventCount);
      setFrom(formRes, setFormCount);
      setFrom(blogRes, setBlogCount);
      setFrom(pvRes, setPageVisibilityCount);
      const failure =
        enrollRes.error || certRes.error || profileRes.error ||
        eventRes.error || formRes.error || blogRes.error || pvRes.error;
      if (failure) setStatsError((failure as { message?: string }).message ?? 'Unknown error');
    })();
    return () => { cancelled = true; };
  }, [statsReloadKey]);

  // Hooks must run unconditionally on every render.
  const { courses } = useCoursesManagement();
  const courseCount = courses.length;

  if (!user || !user.roles || !user.roles.includes('admin')) return null;

  const fmt = (n: number | null) => (n === null ? '—' : n.toLocaleString());

  const kpis = [
    { label: 'Total Users', value: userCount, icon: Users, to: '/admin/users' },
    { label: 'Total Courses', value: courseCount, icon: BookOpen, to: '/admin/courses' },
    { label: 'Active Enrollments', value: enrollmentCount, icon: CheckCircle, to: '/admin/courses' },
    { label: 'Certificates Issued', value: certificateCount, icon: Award, to: '/admin/courses' },
  ];

  const launchers = [
    { title: 'Manage Users', desc: 'Roles, access, and accounts', icon: Users, to: '/admin/users', count: userCount },
    { title: 'Manage Courses', desc: 'Courses, enrollments, certificates', icon: GraduationCap, to: '/admin/courses', count: courseCount },
    { title: 'Manage Events', desc: 'Sessions and registrations', icon: Calendar, to: '/admin/events', count: eventCount },
    { title: 'Manage Forms', desc: 'Forms and submissions', icon: FormInput, to: '/admin/forms', count: formCount },
    { title: 'Manage Blog', desc: 'Posts, drafts, and categories', icon: Newspaper, to: '/admin/blog', count: blogCount },
    { title: 'Page Visibility', desc: 'Control who sees each page', icon: Eye, to: '/admin/page-visibility', count: pageVisibilityCount },
  ];

  return (
    <>
      {/* Header */}
      <header className="mb-7">
        <p className="ss-serif text-ss-lav-deep text-lg mb-1">Insights Collective · Admin</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage courses, users, and platform settings.</p>
      </header>

      {statsError && (
        <div
          className="rounded-2xl border border-ss-bad/40 bg-ss-bad-chip px-4 py-3 text-sm flex items-center justify-between gap-4 mb-4"
          role="alert"
        >
          <span className="text-ss-bad font-medium">
            Failed to load platform statistics: {statsError}
          </span>
          <Button variant="outline" size="sm" className="rounded-xl bg-card" onClick={() => setStatsReloadKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      )}

      {/* KPI tiles — real counts only, no fabricated trend data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              to={kpi.to}
              className="group rounded-2xl border border-border bg-card px-5 py-5 shadow-[var(--ss-shadow)] transition hover:border-ss-lav"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ss-lav-chip">
                  <Icon className="h-5 w-5 text-ss-lav-deep" />
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-1 transition group-hover:opacity-100 group-hover:translate-x-0" />
              </div>
              <div className="text-3xl font-bold tracking-tight tabular-nums">{fmt(kpi.value)}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{kpi.label}</div>
            </Link>
          );
        })}
      </div>

      {/* Quick-action launcher grid */}
      <section className="mb-6">
        <h2 className="text-lg font-bold mb-3">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {launchers.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-[var(--ss-shadow)] transition hover:border-ss-lav"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ss-lav-chip">
                  <Icon className="h-5 w-5 text-ss-lav-deep" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{item.title}</span>
                    {item.count !== null && (
                      <span className="ss-chip !px-2 !py-0.5 !text-xs tabular-nums">{item.count.toLocaleString()}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{item.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-ss-lav-deep" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent activity — honest link-out, no fabricated feed */}
      <section className="mb-6">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--ss-shadow)]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold">Recent Activity</h2>
              <p className="text-sm text-muted-foreground">Latest platform interactions</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl bg-card" asChild>
              <Link to="/admin/activity">View All</Link>
            </Button>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
            <Activity className="h-5 w-5 shrink-0 text-ss-lav-deep" />
            <span>
              Live activity is available on the{' '}
              <Link to="/admin/activity" className="text-ss-lav-deep font-medium underline underline-offset-4">
                full activity log
              </Link>
              . This card intentionally does not show a fabricated feed.
            </span>
          </div>
        </div>
      </section>

      {/* Resources — this is the only home for ResourceManagement */}
      <section>
        <div className={cn('rounded-3xl border border-border bg-card p-5 shadow-[var(--ss-shadow)]')}>
          <h2 className="text-lg font-bold mb-1">Resources</h2>
          <p className="text-sm text-muted-foreground mb-4">Manage downloadable resources and links.</p>
          <ResourceManagement />
        </div>
      </section>
    </>
  );
};

export default AdminDashboard;
