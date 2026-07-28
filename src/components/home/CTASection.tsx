// ABOUTME: CTA section on the homepage with dynamic platform statistics from the database
// ABOUTME: Shows real course count, student count, and average completion rate

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Reveal } from './motion/Reveal';
import { trackPersonas } from '@/data/careerQuizData';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';


/** Small presentational stat so the four trust markers stay identical. */
const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="text-3xl font-bold text-studio-ink tabular-nums">{value}</div>
    <div className="text-sm text-studio-muted mt-1">{label}</div>
  </div>
);

const CTASection = () => {
  const [stats, setStats] = useState({ courses: 0, students: 0, completionRate: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [coursesRes, studentsRes, enrollmentsRes] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('published', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('enrollments').select('completion_status'),
      ]);

      const courseCount = coursesRes.count || 0;
      const studentCount = studentsRes.count || 0;
      const enrollments = enrollmentsRes.data || [];
      const avgCompletion = enrollments.length > 0
        ? Math.round(enrollments.reduce((s, e) => s + (e.completion_status || 0), 0) / enrollments.length)
        : 0;

      setStats({ courses: courseCount, students: studentCount, completionRate: avgCompletion });
    };
    fetchStats();
  }, []);

  return (
    <section className="py-24 relative overflow-hidden border-t border-studio-border bg-studio-cardWarm">
      {/* Decorative washes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="studio-wash"
          style={{ width: 420, height: 420, top: -180, left: -120, background: 'var(--studio-wash-lav)' }}
        />
        <div
          className="studio-wash"
          style={{ width: 380, height: 380, bottom: -190, right: -110, background: 'var(--studio-wash-peach)' }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10 max-w-6xl">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            {stats.students > 0 && (
              <div className="inline-flex items-center justify-center mb-6 bg-studio-lavChip text-studio-lavDeeper px-4 py-2 rounded-full">
                <Sparkles className="h-4 w-4 mr-2" />
                <span className="text-sm font-semibold">
                  Join {stats.students.toLocaleString()}+ data professionals
                </span>
              </div>
            )}

            <h2 className="text-4xl md:text-5xl font-bold text-studio-ink">Ready to Start Learning?</h2>
            <p className="text-lg md:text-xl max-w-2xl mx-auto mt-5 text-studio-muted">
              Join thousands of students already learning on Insights Collective. Sign up today and
              take the first step towards your data career goals.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="flex flex-wrap justify-center gap-4 mt-9">
              <Button
                size="lg"
                asChild
                className="rounded-full bg-studio-lavDeep hover:bg-studio-lavDeeper text-white px-8 py-6 h-auto text-base"
              >
                <Link to="/register" className="flex items-center">
                  Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="rounded-full border-studio-border text-studio-ink hover:bg-studio-card px-8 py-6 h-auto text-base"
              >
                <Link to="/login">Log in to view Dashboard</Link>
              </Button>
            </div>
          </Reveal>

          {/* Every figure below is a query against the platform database. */}
          <Reveal delay={0.18}>
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
              <Stat value={stats.courses > 0 ? String(stats.courses) : '—'} label="Expert-Led Courses" />
              <Stat
                value={stats.students > 0 ? stats.students.toLocaleString() : '—'}
                label="Active Students"
              />
              <Stat
                value={stats.completionRate > 0 ? `${stats.completionRate}%` : '—'}
                label="Avg. Completion"
              />
              <Stat value={String(trackPersonas.length)} label="Career Paths" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
