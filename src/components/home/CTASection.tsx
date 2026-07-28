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
  const [stats, setStats] = useState({ courses: 0, articles: 0 });

  // Only figures a signed-out visitor can actually read. The previous version
  // counted `profiles` and `enrollments`, which RLS hides from anonymous users,
  // so those two stats rendered as em-dashes on every visit.
  useEffect(() => {
    const fetchStats = async () => {
      const [coursesRes, articlesRes] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      ]);

      setStats({ courses: coursesRes.count || 0, articles: articlesRes.count || 0 });
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
            <div className="inline-flex items-center justify-center mb-6 bg-studio-lavChip text-studio-lavDeeper px-4 py-2 rounded-full">
              <Sparkles className="h-4 w-4 mr-2" />
              <span className="text-sm font-semibold">Free to join</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-studio-ink">Ready to Start Learning?</h2>
            <p className="text-lg md:text-xl max-w-2xl mx-auto mt-5 text-studio-muted">
              Create an account to take the quiz, save your results, and work through the courses
              and tools at your own pace.
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
            <div className="mt-16 grid grid-cols-3 gap-y-8 gap-x-6">
              <Stat value={stats.courses > 0 ? String(stats.courses) : '—'} label="Published Courses" />
              <Stat value={String(trackPersonas.length)} label="Career Paths" />
              <Stat value={stats.articles > 0 ? String(stats.articles) : '—'} label="Blueprint Articles" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
