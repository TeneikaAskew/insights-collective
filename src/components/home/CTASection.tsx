// ABOUTME: CTA section on the homepage with dynamic platform statistics from the database
// ABOUTME: Shows real course count, student count, and average completion rate

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CTASection = () => {
  const [stats, setStats] = useState({ courses: 0, students: 0, completionRate: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      // One aggregate call rather than three table reads. The enrollments read
      // could never succeed from here: `anon` has no SELECT grant on that table,
      // and Index redirects authenticated visitors to /dashboard, so every
      // visitor this section renders for is anonymous. It failed with 42501 on
      // every page load and left "Avg. Completion" showing a dash. Granting anon
      // access to the rows would publish who is enrolled in what, so
      // platform_stats() returns the three counters and no rows.
      const { data, error } = await supabase.rpc('platform_stats');
      if (error) {
        console.error('[CTASection] platform_stats failed', error);
        return;
      }

      const row = data?.[0];
      if (!row) return;

      setStats({
        courses: row.published_courses ?? 0,
        students: row.community_members ?? 0,
        completionRate: row.avg_completion ?? 0,
      });
    };
    fetchStats();
  }, []);

  return (
    <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center mb-6 bg-primary-foreground/10 px-4 py-2 rounded-full">
            <Sparkles className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">Join {stats.students > 0 ? `${stats.students.toLocaleString()}+` : ''} data professionals</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display">Ready to Start Learning?</h2>
          <p className="text-xl max-w-2xl mx-auto mb-10 text-primary-foreground/80">
            Join thousands of students already learning on Insights Collective. Sign up today and take the first step towards your data career goals.
          </p>
          
          <div className="flex flex-wrap justify-center gap-5">
            <Button 
              size="lg" 
              variant="secondary" 
              asChild
              className="bg-background hover:bg-background/90 text-primary px-8 py-7 h-auto text-lg rounded-full shadow-xl transform transition-all duration-300 hover:-translate-y-1"
            >
              <Link to="/register" className="flex items-center">
                Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              className="bg-primary-foreground/15 hover:bg-primary-foreground/25 border-2 border-primary-foreground text-primary-foreground px-8 py-7 h-auto text-lg rounded-full shadow-lg transform transition-all duration-300 hover:-translate-y-1"
              asChild
            >
              <Link to="/login">
                Log in to view Dashboard
              </Link>
            </Button>
          </div>
          
          {/* Trust markers - real data */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8">
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold mb-1">{stats.courses || '—'}</div>
              <div className="text-sm text-primary-foreground/70">Expert-Led Courses</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold mb-1">{stats.students > 0 ? stats.students.toLocaleString() : '—'}</div>
              {/* profiles counts every account (students, instructors, admins),
                  so label it honestly. */}
              <div className="text-sm text-primary-foreground/70">Community Members</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold mb-1">{stats.completionRate > 0 ? `${stats.completionRate}%` : '—'}</div>
              <div className="text-sm text-primary-foreground/70">Avg. Completion</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold mb-1">24/7</div>
              <div className="text-sm text-primary-foreground/70">Learning Support</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
