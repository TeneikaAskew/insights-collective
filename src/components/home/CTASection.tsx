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
    <section className="py-24 bg-gradient-to-r from-primary to-accent text-white relative overflow-hidden">
      {/* Abstract shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-white opacity-10 blur-2xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-white opacity-10 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-64 bg-gradient-to-r from-white/0 via-white/5 to-white/0 blur-xl rotate-12"></div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-30 mask-image: linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0));"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center mb-6 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
            <Sparkles className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">Join {stats.students > 0 ? `${stats.students.toLocaleString()}+` : ''} data professionals</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display">Ready to Start Learning?</h2>
          <p className="text-xl max-w-2xl mx-auto mb-10 text-white/80">
            Join thousands of students already learning on Insights Collective. Sign up today and take the first step towards your data career goals.
          </p>
          
          <div className="flex flex-wrap justify-center gap-5">
            <Button 
              size="lg" 
              variant="secondary" 
              asChild
              className="bg-white hover:bg-white/90 text-primary px-8 py-7 h-auto text-lg rounded-full shadow-xl hover:shadow-white/20 transform transition-all duration-300 hover:-translate-y-1"
            >
              <Link to="/register" className="flex items-center">
                Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              className="bg-white/15 hover:bg-white/25 backdrop-blur-sm border-2 border-white text-white px-8 py-7 h-auto text-lg rounded-full shadow-lg transform transition-all duration-300 hover:-translate-y-1"
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
              <div className="text-sm text-white/70">Expert-Led Courses</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold mb-1">{stats.students > 0 ? stats.students.toLocaleString() : '—'}</div>
              <div className="text-sm text-white/70">Active Students</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold mb-1">{stats.completionRate > 0 ? `${stats.completionRate}%` : '—'}</div>
              <div className="text-sm text-white/70">Avg. Completion</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold mb-1">24/7</div>
              <div className="text-sm text-white/70">Learning Support</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
