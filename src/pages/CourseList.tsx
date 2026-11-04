// ABOUTME: Student-facing course catalog page.
// ABOUTME: Teachable/Podia-style light card grid with serif titles and yellow CTAs.
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CourseImage } from '@/components/common/CourseImage';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Clock, BookOpen, ArrowRight } from 'lucide-react';
import { ESTIMATED_TIME_BUCKETS, formatEstimatedHours, matchesEstimatedTime, type EstimatedTimeBucket } from '@/lib/estimatedTime';
import { ALL_CATEGORIES, categorySlug, disambiguateCategoryMenu, resolveCategoryParam } from '@/lib/catalogCategory';
import { supabase } from '@/integrations/supabase/client';
import { PUBLISHED_COLUMN } from '@/utils/coursePublish';
import { Course } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logger';
import CourseOnboardingWalkthrough from '@/components/courses/CourseOnboardingWalkthrough';

const logger = createLogger('CourseList');

const CourseList = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState<EstimatedTimeBucket>('all');
  const { toast } = useToast();
  const navigate = useNavigate();

  const categories = [...new Set(courses.map(c => c.category).filter(Boolean))];

  // Category lives in the URL (?category=<slug>) so homepage/footer links, direct loads and Back/Forward all agree.
  // It is derived on every render from the location, never copied into state. Selector options carry slugs; two
  // stored names with the same slug share one option. An unknown slug filters nothing and is announced below.
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
  const categoryResolution = resolveCategoryParam(categoryParam, categories);
  const categoryOptions: [string, string][] = [];
  for (const c of categories) {
    const slug = categorySlug(c);
    if (slug && !categoryOptions.some(([s]) => s === slug)) categoryOptions.push([slug, c]); // first name labels the option
  }
  const categoryValue = categoryResolution.kind === 'match' ? categoryResolution.optionValue : ALL_CATEGORIES;
  // One menu, three kinds of entry (the All sentinel, each stored category, and a group entry while one is active).
  // Every visible text, and so every accessible name, is unique even when a stored name equals another caption.
  const categoryMenu = disambiguateCategoryMenu([
    { value: ALL_CATEGORIES, label: 'All categories', kind: 'all' },
    ...categoryOptions.map(([slug, name]) => ({ value: slug, label: name, kind: 'category' as const })),
    ...(categoryResolution.kind === 'match' && categoryResolution.groupOption
      ? [{ value: categoryResolution.optionValue, label: categoryResolution.optionLabel, kind: 'group' as const }]
      : []),
  ]);
  const setCategory = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    if (slug === ALL_CATEGORIES) next.delete('category'); else next.set('category', slug);
    setSearchParams(next); // a push entry, so Back steps to the previous category
  };
  const levels = [...new Set(courses.map(c => c.level).filter(Boolean))];

  // Component-scoped so the error UI can offer a real retry (re-fetch)
  // instead of a full page reload.
  const fetchCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('courses')
        .select(`*, instructor:profiles(id, first_name, last_name, avatar_url)`)
        .eq(PUBLISHED_COLUMN, true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data || [];
      // NOTE: no enrollment-count scan here. This page is public — `anon` has
      // no SELECT on `enrollments` by design (see
      // 20260731000800_restore_missing_select_grants.sql), so the cross-course
      // scan that used to run here returned 42501 for every signed-out visitor
      // and, because the failure was treated as fatal, replaced the whole
      // catalog with an error state. It populated `enrollmentCount`, which no
      // card on this page renders. Removing it fixes the catalog for anonymous
      // visitors and drops a cross-user query from a public page.
      const formatted = rows.map((c: any) => ({
        ...c,
        instructor: {
          id: c.instructor?.id || '',
          // No generic "Instructor" fallback — when the name is unknown the
          // card omits the instructor line entirely.
          name: c.instructor
            ? `${c.instructor?.first_name || ''} ${c.instructor?.last_name || ''}`.trim()
            : '',
          email: '',
          role: 'instructor',
          avatar: c.instructor?.avatar_url || '',
        },
        modules: [],
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        // No stock-photo fallback: missing artwork renders as a neutral
        // placeholder block rather than a stock image implying real course art.
        thumbnail: c.image_url || c.thumbnail || undefined,
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

  useEffect(() => {
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = courses.filter((c) => {
    const s = searchQuery.toLowerCase();
    const matchesSearch =
      !s ||
      c.title.toLowerCase().includes(s) ||
      (c.description || '').toLowerCase().includes(s) ||
      (c.category || '').toLowerCase().includes(s) ||
      (c.instructor?.name || '').toLowerCase().includes(s);
    const matchesCategory = categoryResolution.kind !== 'match' || categoryResolution.names.includes(c.category);
    const matchesLevel = levelFilter === 'all' || c.level === levelFilter;
    // Estimated time reads estimated_hours only; legacy `duration` has no defined unit and is not a schedule.
    const matchesTime = matchesEstimatedTime((c as any).estimated_hours, timeFilter);
    return matchesSearch && matchesCategory && matchesLevel && matchesTime;
  });

  return (
    <AppLayout fullWidth>
      {/* Was negative margins cancelling AppLayout's gutter so the catalog could
          run edge to edge. They did not cancel it — AppLayout's padding is a flat
          p-4 at every width, so -mx-6 and -mx-8 pulled 8px and 16px PAST the
          container at md and lg and the page overflowed horizontally. The
          mobile-overflow sweep measures at 390px only, which is the one width
          where the arithmetic happened to balance. fullWidth asks for the same
          thing directly and cannot drift out of step with the shell. */}
      <div className="bg-background text-foreground px-4 md:px-8 lg:px-12 py-10 min-h-full">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-10">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">Catalog</p>
          <h1 className="font-display text-5xl md:text-6xl text-foreground mb-3">Courses</h1>
          <p className="text-muted-foreground max-w-2xl">
            Browse the full library and jump into a lesson whenever you're ready.
          </p>
        </div>

        {/* Filter bar */}
        <div data-onboarding="course-filters" className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap gap-3 md:items-center">
          {/* The three selects are fixed-width from md; in the narrower md content area the search takes its own
              row (basis-full) instead of being squeezed to ~60px, and joins the row again from lg. */}
          <div className="relative flex-1 md:basis-full lg:basis-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-11 h-11 rounded-full border-border bg-card focus-visible:ring-ring"
              placeholder="Search courses"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={categoryValue} onValueChange={setCategory}>
            <SelectTrigger aria-label="Category" className="w-full md:w-[200px] h-11 rounded-full border-border bg-card">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {/* The group entry (present only while a several-name group or alias match is active) comes last. */}
              {categoryMenu.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.text}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-full md:w-[180px] h-11 rounded-full border-border bg-card">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {levels.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as EstimatedTimeBucket)}>
            <SelectTrigger aria-label="Estimated time" className="w-full md:w-[180px] h-11 rounded-full border-border bg-card">
              <SelectValue placeholder="Estimated time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any estimated time</SelectItem>
              {ESTIMATED_TIME_BUCKETS.map((b) => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!loading && !error && categoryResolution.kind === 'unknown' && (
          <div role="status" className="max-w-7xl mx-auto mb-6 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            No published courses match the category “{categoryResolution.raw}”, so courses from all categories are
            shown. Your search and other filters still apply.{' '}
            <button type="button" className="underline text-foreground" onClick={() => setCategory(ALL_CATEGORIES)}>
              Clear category
            </button>
          </div>
        )}

        {/* Grid */}
        <div data-onboarding="course-grid" className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-2xl border border-border overflow-hidden animate-pulse">
                  <div className="aspect-[16/9] bg-muted" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-6 bg-muted rounded w-4/5" />
                    <div className="h-4 bg-muted rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => void fetchCourses()}>
                Try again
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 border border-dashed rounded-2xl">
              <h3 className="font-display text-2xl text-foreground mb-2">No courses found</h3>
              <p className="text-muted-foreground mb-4">Try adjusting your search or filters.</p>
              <Button
                variant="outline"
                onClick={() => { setSearchQuery(''); setCategory(ALL_CATEGORIES); setLevelFilter('all'); setTimeFilter('all'); }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((course) => {
                const initials = (course.title || 'C')
                  .split(/\s+/)
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                return (
                  <button
                    key={course.id}
                    onClick={() => navigate(`/courses/${course.id}`)}
                    className="group text-left rounded-2xl border border-border bg-card hover:border-foreground hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] transition-all"
                  >
                    {/* Media (outer keeps rounded top; inner clips the image; avatar sits above) */}
                    <div className="relative">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-t-2xl bg-ss-teal-chip">
                        <CourseImage
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        />
                      </div>
                      {/* Circular logo badge overlapping bottom-left, above the image */}
                      <div className="absolute -bottom-6 left-5 z-10 h-14 w-14 rounded-full bg-card border-4 border-card shadow-md flex items-center justify-center overflow-hidden">
                        {course.instructor?.avatar ? (
                          <img
                            src={course.instructor.avatar}
                            alt={course.instructor.name}
                            className="h-full w-full object-cover rounded-full"
                          />
                        ) : (
                          <span className="text-xs font-bold text-foreground">{initials}</span>
                        )}
                      </div>
                    </div>
                    {/* Body */}
                    <div className="pt-9 px-6 pb-6">
                      <h3 className="font-display text-xl text-foreground mb-1 line-clamp-2 leading-snug">
                        {course.title}
                      </h3>
                      {(course.instructor?.name || course.category) && (
                        <p className="text-sm text-muted-foreground truncate">
                          {[course.instructor?.name, course.category].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                        {formatEstimatedHours((course as any).estimated_hours) && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> <span className="sr-only">Estimated time: </span>{formatEstimatedHours((course as any).estimated_hours)}
                          </span>
                        )}
                        {course.level && (
                          <span className="inline-flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" /> {course.level}
                          </span>
                        )}
                        <span className="ml-auto inline-flex items-center gap-1 text-foreground font-medium group-hover:gap-2 transition-all">
                          View <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <CourseOnboardingWalkthrough />
    </AppLayout>

  );
};

export default CourseList;
