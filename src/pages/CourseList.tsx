// ABOUTME: Student-facing course catalog page.
// ABOUTME: Teachable/Podia-style light card grid with serif titles and yellow CTAs.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Clock, BookOpen, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Course } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseList');

const CourseList = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const { toast } = useToast();
  const navigate = useNavigate();

  const categories = [...new Set(courses.map(c => c.category).filter(Boolean))];
  const levels = [...new Set(courses.map(c => c.level).filter(Boolean))];

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select(`*, instructor:profiles(id, first_name, last_name, avatar_url)`)
          .eq('status', 'published')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const formatted = (data || []).map((c: any) => ({
          ...c,
          instructor: {
            id: c.instructor?.id || '',
            name: c.instructor
              ? `${c.instructor?.first_name || ''} ${c.instructor?.last_name || ''}`.trim() || 'Instructor'
              : 'Instructor',
            email: '',
            role: 'instructor',
            avatar: c.instructor?.avatar_url || '',
          },
          enrollmentCount: 0,
          modules: [],
          rating: 4.5,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          thumbnail:
            c.image_url ||
            c.thumbnail ||
            'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=70',
        }));
        setCourses(formatted);
      } catch (e: any) {
        logger.error('Error fetching courses:', e);
        setError(e.message);
        toast({ title: 'Failed to load courses', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [toast]);

  const filtered = courses.filter((c) => {
    const s = searchQuery.toLowerCase();
    const matchesSearch =
      !s ||
      c.title.toLowerCase().includes(s) ||
      (c.description || '').toLowerCase().includes(s);
    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
    const matchesLevel = levelFilter === 'all' || c.level === levelFilter;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  return (
    <AppLayout>
      <div className="teachable-workspace bg-white -mx-4 md:-mx-6 lg:-mx-8 -my-4 px-4 md:px-8 lg:px-12 py-10 min-h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-10">
          <p className="text-xs uppercase tracking-[0.15em] text-neutral-500 mb-3">Catalog</p>
          <h1 className="font-display text-5xl md:text-6xl text-neutral-900 mb-3">Courses</h1>
          <p className="text-neutral-600 max-w-2xl">
            Browse the full library and jump into a lesson whenever you're ready.
          </p>
        </div>

        {/* Filter bar */}
        <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              className="pl-11 h-11 rounded-full border-neutral-300 bg-white focus-visible:ring-neutral-900"
              placeholder="Search courses"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-[200px] h-11 rounded-full border-neutral-300 bg-white">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-full md:w-[180px] h-11 rounded-full border-neutral-300 bg-white">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {levels.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-2xl border border-neutral-200 overflow-hidden animate-pulse">
                  <div className="aspect-[16/9] bg-neutral-100" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-neutral-100 rounded w-1/3" />
                    <div className="h-6 bg-neutral-100 rounded w-4/5" />
                    <div className="h-4 bg-neutral-100 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-neutral-600">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 border border-dashed rounded-2xl">
              <h3 className="font-display text-2xl text-neutral-900 mb-2">No courses found</h3>
              <p className="text-neutral-500 mb-4">Try adjusting your search or filters.</p>
              <Button
                variant="outline"
                onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setLevelFilter('all'); }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((course) => (
                <button
                  key={course.id}
                  onClick={() => navigate(`/courses/${course.id}`)}
                  className="group text-left rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:border-neutral-900 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] transition-all"
                >
                  <div className="aspect-[16/9] overflow-hidden bg-neutral-100">
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-3 text-[11px] uppercase tracking-[0.15em] text-neutral-500">
                      <span>{course.category || 'Course'}</span>
                      {course.level && <><span>•</span><span>{course.level}</span></>}
                    </div>
                    <h3 className="font-display text-2xl text-neutral-900 mb-2 line-clamp-2 leading-tight">
                      {course.title}
                    </h3>
                    <p className="text-sm text-neutral-600 line-clamp-2 mb-5">
                      {course.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        {course.duration && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" /> {course.duration}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" /> {course.instructor?.name}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-neutral-900 group-hover:gap-2 transition-all">
                        View <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default CourseList;
