// ABOUTME: Teachable-style student course player.
// ABOUTME: Dark admin top bar + dark left curriculum rail + centered lesson content + pill Prev/Next controls.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  ClipboardCheck,
  ExternalLink,
  FileText,
  HelpCircle,
  Home,
  Link2,
  Menu,
  MessageSquare,
  Play,
  RotateCcw,
  Settings,
  X,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import CourseErrorState from '@/components/course/CourseErrorState';
import { CourseImage } from '@/components/common/CourseImage';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { LessonViewer } from '@/components/course/learn/LessonViewer';
import type { ContentItem } from '@/types/canvas';
import { createLogger } from '@/utils/logger';
import { cn } from '@/lib/utils';
import { sidebarNavItemClass, SIDEBAR_NAV_RAIL } from '@/lib/sidebarNav';
import { Hint } from '@/components/ui/hint';
import { StudentLearnTour } from '@/components/onboarding/StudentLearnTour';

const logger = createLogger('CourseLearn');

// Thinkific/Teachable-style per-content-type icon.
function TypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? 'w-3.5 h-3.5';
  switch (type) {
    case 'assignment':
      return <ClipboardCheck className={cls} />;
    case 'quiz':
      return <HelpCircle className={cls} />;
    case 'discussion':
      return <MessageSquare className={cls} />;
    case 'external_url':
      return <ExternalLink className={cls} />;
    case 'external_tool':
      return <Link2 className={cls} />;
    case 'page':
    default:
      return <FileText className={cls} />;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'assignment':
      return 'Assignment';
    case 'quiz':
      return 'Quiz';
    case 'discussion':
      return 'Discussion';
    case 'external_url':
      return 'External Link';
    case 'external_tool':
      return 'External Tool';
    case 'page':
    default:
      return 'Lesson';
  }
}

interface CourseShell {
  id: string;
  title: string;
  thumbnail: string | null;
  /** courses.settings JSON — read for the discussions toggle in the builder's Settings tab. */
  settings?: { discussions?: { enabled?: boolean } } | null;
}

interface CurriculumModule {
  id: string;
  title: string;
  items: ContentItem[];
}

const CourseLearn = () => {
  const { courseId, moduleId, itemId } = useParams<{
    courseId: string;
    moduleId?: string;
    itemId?: string;
  }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { canEdit } = useCoursePermissions(courseId);
  const [previewAsStudent, setPreviewAsStudent] = useState(false);
  const effectiveEdit = canEdit && !previewAsStudent;

  const [course, setCourse] = useState<CourseShell | null>(null);
  const [modules, setModules] = useState<CurriculumModule[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  // Load ERROR (backend failure) — distinct from "no such course".
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  // The progress fetch failed: completion state is unknown, so completion
  // views must not render fabricated "0 of N" numbers.
  const [progressError, setProgressError] = useState(false);
  const [progressReloadKey, setProgressReloadKey] = useState(0);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);

  const { data: progress, markItemComplete } = useCourseProgress(courseId);

  const flatItems = useMemo(
    () => modules.flatMap((m) => m.items.map((i) => ({ module: m, item: i }))),
    [modules],
  );

  const isCompletionRoute = moduleId === 'complete';

  const selected = useMemo(() => {
    if (!itemId || isCompletionRoute) return null;
    return flatItems.find((fi) => fi.item.id === itemId) || null;
  }, [flatItems, itemId, isCompletionRoute]);

  // --- Load ---
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!courseId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const { data: courseData, error } = await supabase
          .from('courses')
          .select('id, title, thumbnail, settings')
          .eq('id', courseId)
          .single();
        if (error) {
          // PGRST116 = zero rows: the course genuinely doesn't exist, which
          // is the not-found screen — anything else is a load ERROR.
          if ((error as any).code === 'PGRST116') {
            if (!cancelled) setCourse(null);
            return;
          }
          throw new Error(error.message);
        }

        const rawModules = await CanvasContentService.getModules(courseId);
        const visible = effectiveEdit ? rawModules : rawModules.filter((m) => m.published);
        const withItems = await Promise.all(
          visible.map(async (m) => {
            const items = await CanvasContentService.getContentItems(m.id);
            const filtered = effectiveEdit ? items : items.filter((i) => i.published !== false);
            return { id: m.id, title: m.title, items: filtered } as CurriculumModule;
          }),
        );

        if (cancelled) return;
        setCourse(courseData as CourseShell);
        setModules(withItems);
        // Only expand the first module by default — Teachable-style focused view.
        // The resume module will expand automatically once progress loads (see effect below).
        setExpanded(new Set(withItems.slice(0, 1).map((m) => m.id)));
      } catch (err: any) {
        logger.error('Failed to load learn view', err);
        if (!cancelled) {
          setLoadError(err instanceof Error ? err : new Error(String(err?.message ?? err)));
        }
        toast({ title: 'Error', description: err?.message, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [courseId, effectiveEdit, toast, reloadKey]);

  // --- Progress fetch ---
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id || flatItems.length === 0) {
        if (!cancelled) {
          setCompleted(new Set());
          setProgressError(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from('content_item_progressions')
        .select('content_item_id, workflow_state')
        .eq('user_id', user.id)
        .in('content_item_id', flatItems.map((fi) => fi.item.id));
      if (cancelled) return;
      if (error) {
        // Don't blank the checkmarks with fabricated zero-progress — keep
        // whatever we last knew and surface a visible notice instead.
        logger.error('Failed to load lesson progress', error);
        setProgressError(true);
        return;
      }
      setProgressError(false);
      setCompleted(
        new Set(
          (data || [])
            .filter(
              (p: any) => p.workflow_state === 'read' || p.workflow_state === 'completed',
            )
            .map((p: any) => p.content_item_id),
        ),
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, flatItems, progress?.completedItems, progressReloadKey]);

  const currentIndex = selected
    ? flatItems.findIndex((fi) => fi.item.id === selected.item.id)
    : -1;
  const prev = currentIndex > 0 ? flatItems[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < flatItems.length - 1
      ? flatItems[currentIndex + 1]
      : null;
  const isSelectedComplete = selected ? completed.has(selected.item.id) : false;
  const percent = progress?.percent ?? 0;

  // Resume target: first unfinished lesson, else first lesson.
  const resumeItem = useMemo(() => {
    if (flatItems.length === 0) return null;
    return flatItems.find((fi) => !completed.has(fi.item.id)) ?? flatItems[0];
  }, [flatItems, completed]);
  const lessonNumber = currentIndex >= 0 ? currentIndex + 1 : 0;
  const totalLessons = flatItems.length;

  // Auto-expand the module that contains the resume/current lesson, once known.
  const autoExpandedRef = useRef<string | null>(null);
  useEffect(() => {
    const target = selected?.module.id ?? resumeItem?.module.id;
    if (!target) return;
    if (autoExpandedRef.current === target) return;
    autoExpandedRef.current = target;
    setExpanded((prev) => {
      if (prev.has(target)) return prev;
      const n = new Set(prev);
      n.add(target);
      return n;
    });
  }, [selected?.module.id, resumeItem?.module.id]);

  const goTo = useCallback(
    (mid: string, iid: string) => {
      navigate(`/courses/${courseId}/learn/${mid}/${iid}`);
    },
    [courseId, navigate],
  );

  const retryProgress = useCallback(() => setProgressReloadKey((k) => k + 1), []);

  const toggleExpand = useCallback((mid: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(mid)) {
        n.delete(mid);
      } else {
        n.add(mid);
      }
      return n;
    });
  }, []);

  const handleMarkDone = useCallback(
    async (id: string) => {
      try {
        await markItemComplete(id);
        setCompleted((prev) => new Set(prev).add(id));
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [markItemComplete, toast],
  );

  const handleContinue = useCallback(async () => {
    if (!selected) return;
    if (!isSelectedComplete) await handleMarkDone(selected.item.id);
    if (next) {
      goTo(next.module.id, next.item.id);
    } else {
      navigate(`/courses/${courseId}/learn/complete/summary`);
    }
  }, [selected, isSelectedComplete, handleMarkDone, next, goTo, navigate, courseId]);

  // Keyboard shortcuts: ←/→ navigate lessons while in the player.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' && next) {
        e.preventDefault();
        goTo(next.module.id, next.item.id);
      } else if (e.key === 'ArrowLeft' && prev) {
        e.preventDefault();
        goTo(prev.module.id, prev.item.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, next, prev, goTo]);


  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  // Load ERROR — the course may well exist; don't claim it doesn't.
  if (loadError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-full max-w-md px-4">
          <CourseErrorState
            title="Couldn't load this course"
            error={loadError}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
          <div className="mt-4 text-center">
            <Link to="/courses" className="text-sm underline">
              Back to courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Course not found</h1>
          <Link to="/courses" className="text-sm underline">
            Back to courses
          </Link>
        </div>
      </div>
    );
  }

  // --- Completion / end-of-course view ---
  if (isCompletionRoute) {
    const totalItems = flatItems.length;
    const completedCount = flatItems.filter((fi) => completed.has(fi.item.id)).length;
    // When the progress fetch failed, the completed set may be stale — never
    // assert "Course complete" (or offer the certificate) on unverifiable data.
    const allComplete = !progressError && totalItems > 0 && completedCount === totalItems;
    const firstItem = flatItems[0];
    return (
      <div className="fixed inset-0 flex flex-col bg-background text-foreground">
        <AdminTopBar canEdit={canEdit} courseId={course.id} previewAsStudent={previewAsStudent} onPreviewChange={setPreviewAsStudent} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              {allComplete ? (
                <Award className="h-10 w-10 text-primary" />
              ) : (
                <CheckCircle2 className="h-10 w-10 text-primary" />
              )}
            </div>
            <div className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
              {allComplete ? 'Course complete' : 'End of course'}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl mb-3 break-words">
              {allComplete ? `Congratulations! You finished ${course.title}` : `You've reached the end of ${course.title}`}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-8">
              {progressError
                ? 'We couldn’t load your progress right now, so your completion status is unavailable.'
                : allComplete
                  ? 'Every lesson is checked off. Download your certificate, revisit lessons anytime, or head back to your courses.'
                  : `You've completed ${completedCount} of ${totalItems} lessons. Finish the remaining lessons to unlock your certificate.`}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
              {allComplete && (
                <Link
                  to={`/courses/${course.id}/certificate`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Award className="w-4 h-4" />
                  View certificate
                </Link>
              )}
              <Link
                to="/enrolled-courses"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold border border-primary text-primary hover:bg-primary/10"
              >
                Exit to my courses
              </Link>
              {firstItem && (
                <button
                  type="button"
                  onClick={() => goTo(firstItem.module.id, firstItem.item.id)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-4 h-4" />
                  Review course
                </button>
              )}
            </div>

            {progressError ? (
              <div className="text-left">
                <CourseErrorState
                  title="Couldn't load your progress"
                  error="Your completion status could not be loaded."
                  onRetry={retryProgress}
                />
              </div>
            ) : (
              <div className="text-left rounded-xl border border-border bg-card p-5">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Your progress
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${totalItems ? Math.round((completedCount / totalItems) * 100) : 0}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {completedCount} of {totalItems} lessons complete
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Course home (no lesson selected) ---
  if (!selected) {
    return (
      <div data-testid="course-learn-home" className="fixed inset-0 flex flex-col bg-background text-foreground">
        <AdminTopBar canEdit={canEdit} courseId={course.id} previewAsStudent={previewAsStudent} onPreviewChange={setPreviewAsStudent} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 lg:gap-10">
              <div>
                <div className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                  {completed.size > 0 ? 'Pick up where you left off' : 'Start your journey'}
                </div>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl mb-3">{course.title}</h1>
                <p className="text-sm text-muted-foreground mb-6">
                  {flatItems.length} lessons · {Math.round(percent)}% complete
                </p>
                {resumeItem && (
                  <div className="mb-8">
                    <div className="text-xs text-muted-foreground mb-2">
                      {completed.size > 0 ? 'Up next' : 'First lesson'} · {resumeItem.module.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => goTo(resumeItem.module.id, resumeItem.item.id)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      >
                        <Play className="w-4 h-4" />
                        {completed.size > 0 ? 'Resume' : 'Start course'}: {resumeItem.item.title || 'Lesson 1'}
                      </button>
                      {completed.size > 0 && flatItems[0] && flatItems[0].item.id !== resumeItem.item.id && (
                        <button
                          type="button"
                          onClick={() => {
                            const first = flatItems[0];
                            if (first) goTo(first.module.id, first.item.id);
                          }}
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Start from beginning
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-10 space-y-4">
                  {progressError && (
                    <CourseErrorState
                      title="Couldn't load your progress"
                      error="Lesson completion status is unavailable right now."
                      onRetry={retryProgress}
                    />
                  )}
                  {modules.map((m) => (
                    <HomeSection
                      key={m.id}
                      module={m}
                      expanded={expanded.has(m.id)}
                      onToggle={() => toggleExpand(m.id)}
                      completed={completed}
                      progressUnavailable={progressError}
                      onSelect={(iid) => goTo(m.id, iid)}
                    />
                  ))}
                </div>
              </div>

              <aside className="space-y-6">
                <div className="text-center">
                  <div className="text-[11px] font-bold tracking-widest uppercase mb-3">
                    {Math.round(percent)}% Complete
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-ss-track overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, Math.max(0, percent))}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-6 border-t border-border">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-primary text-primary-foreground">
                    <CourseImage src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="font-sans text-xl">{course.title}</div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Lesson player ---
  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      <AdminTopBar canEdit={canEdit} courseId={course.id} previewAsStudent={previewAsStudent} onPreviewChange={setPreviewAsStudent} />

      {/* Player top bar with prev/next pills */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-3 flex-shrink-0 bg-card border-b border-border flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3">
          <Hint label="Show course outline">
            <button
              type="button"
              onClick={() => setMobileRailOpen(true)}
              className="lg:hidden w-9 h-9 rounded-md flex items-center justify-center text-foreground hover:bg-muted"
              aria-label="Open curriculum"
            >
              <Menu className="w-4 h-4" />
            </button>
          </Hint>
          <Hint label="Back to course home">
            <Link
              to={`/courses/${course.id}/learn`}
              className="w-9 h-9 rounded-md flex items-center justify-center text-foreground hover:bg-muted"
              aria-label="Course home"
            >
              <Home className="w-4 h-4" />
            </Link>
          </Hint>
          <Hint label="Course overview and settings">
            <Link
              to={`/courses/${course.id}`}
              className="w-9 h-9 rounded-md flex items-center justify-center text-primary hover:bg-muted"
              aria-label="Course settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </Hint>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          <Hint label="Go to the previous lesson">
            <button
              type="button"
              disabled={!prev}
              onClick={() => prev && goTo(prev.module.id, prev.item.id)}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous Lesson</span>
              <span className="sm:hidden">Prev</span>
            </button>
          </Hint>
          <Hint label={isSelectedComplete ? 'Move to the next lesson' : 'Mark this lesson done and continue'}>
            <button
              data-onboarding="learn-continue"
              type="button"
              onClick={handleContinue}
              className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <span className="hidden sm:inline">{isSelectedComplete ? 'Continue' : 'Complete and Continue'}</span>
              <span className="sm:hidden">{isSelectedComplete ? 'Next' : 'Complete'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </Hint>
        </div>
      </div>

      {/* Slim progress strip: lesson counter + course completion */}
      <div data-onboarding="learn-progress" className="flex items-center gap-3 px-3 sm:px-6 py-2 flex-shrink-0 bg-card border-b border-border text-[11px] text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">
          Lesson {lessonNumber} of {totalLessons}
        </span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline truncate">{selected.module.title || 'Section'}</span>
        <div className="ml-auto flex items-center gap-2 min-w-[140px]">
          <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
          <span className="tabular-nums font-semibold text-foreground">
            {Math.round(percent)}%
          </span>
        </div>
      </div>




      <div className="flex-1 flex min-h-0">
        {/* Mobile curriculum drawer */}
        {mobileRailOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <button
              type="button"
              aria-label="Close curriculum"
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileRailOpen(false)}
            />
            <aside
              className={cn(
                'relative w-80 max-w-[85vw] overflow-y-auto border-r shadow-xl',
                SIDEBAR_NAV_RAIL,
              )}
            >
              <div className="flex items-center justify-between p-3 border-b border-border">
                <div className="text-sm font-semibold truncate pr-2">{course.title}</div>
                <button
                  type="button"
                  onClick={() => setMobileRailOpen(false)}
                  className="p-2 rounded-md hover:bg-muted"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <RailNav
                modules={modules}
                selectedId={selected?.item.id}
                completed={completed}
                canEdit={canEdit}
                progressUnavailable={progressError}
                onRetryProgress={retryProgress}
                onSelect={(mid, iid) => {
                  goTo(mid, iid);
                  setMobileRailOpen(false);
                }}
              />
            </aside>
          </div>
        )}

        {/* Desktop left curriculum rail */}
        <aside
          data-onboarding="learn-rail"
          className={cn(
            'hidden lg:block w-72 flex-shrink-0 overflow-y-auto border-r',
            SIDEBAR_NAV_RAIL,
          )}
        >
          <RailNav
            modules={modules}
            selectedId={selected?.item.id}
            completed={completed}
            canEdit={canEdit}
            progressUnavailable={progressError}
            onRetryProgress={retryProgress}
            onSelect={goTo}
          />
        </aside>

        {/* Content */}
        <main data-testid="course-learn-viewer" className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 pb-32">
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-primary text-primary-foreground">
                <TypeIcon type={selected.item.type} className="w-3 h-3" />
                {typeLabel(selected.item.type)}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl mb-6 break-words">{selected.item.title}</h1>
            <LessonViewer
              item={selected.item}
              isCompleted={isSelectedComplete}
              onNavigate={() => undefined}
              onMarkDone={handleMarkDone}
              actionBasePath={`/courses/${course.id}/modules/${selected.module.id}`}
              hideFooter
              discussionsEnabled={course.settings?.discussions?.enabled !== false}
            />

            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSelectedComplete ? 'Continue' : 'Complete and Continue'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
      <StudentLearnTour active={!canEdit || previewAsStudent} />
    </div>
  );
};

function RailNav({
  modules,
  selectedId,
  completed,
  canEdit,
  progressUnavailable = false,
  onRetryProgress,
  onSelect,
}: {
  modules: CurriculumModule[];
  selectedId?: string;
  completed: Set<string>;
  canEdit: boolean;
  progressUnavailable?: boolean;
  onRetryProgress?: () => void;
  onSelect: (moduleId: string, itemId: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  return (
    <nav className="p-3 space-y-5">
      {progressUnavailable && (
        <div className="px-1">
          <CourseErrorState
            title="Couldn't load your progress"
            error="Completion checkmarks are unavailable right now."
            onRetry={onRetryProgress}
          />
        </div>
      )}
      {modules.map((m, mi) => {
        const doneInModule = m.items.filter((i) => completed.has(i.id)).length;
        return (
          <div key={m.id}>
            <div className="flex items-baseline justify-between gap-2 px-3 py-2">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
                {`Section ${mi + 1} · ${m.title || 'Untitled'}`}
              </div>
              <div className="text-[10px] tabular-nums text-muted-foreground/80">
                {progressUnavailable ? '—' : `${doneInModule}/${m.items.length}`}
              </div>
            </div>
            <ul className="space-y-1">
              {m.items.map((it) => {
                const active = selectedId === it.id;
                const done = completed.has(it.id);
                return (
                  <li key={it.id}>
                    <button
                      ref={active ? activeRef : undefined}
                      type="button"
                      onClick={() => onSelect(m.id, it.id)}
                      className={cn(
                        // Colours come from `.ss-nav-*` in src/index.css, the same
                        // block the app, course and builder rails read. The pill
                        // shape stays: this rail is a lesson checklist, and its
                        // rounded-full row is what separates it from a menu.
                        'group w-full gap-3 pl-3 pr-4 py-2 rounded-full text-left text-sm',
                        sidebarNavItemClass(active),
                      )}
                    >
                      <span className="flex-shrink-0" aria-hidden>
                        {/* Completion state is this rail's own vocabulary — a menu
                            has no equivalent — so it keeps explicit colours rather
                            than riding .ss-nav-icon. Both sides are sidebar tokens
                            so they stay legible on the accent pill. */}
                        {done ? (
                          <CheckCircle2
                            className={cn(
                              'w-4 h-4',
                              active ? 'text-sidebar-accent-foreground' : 'text-sidebar-accent',
                            )}
                          />
                        ) : active ? (
                          <div className="w-4 h-4 rounded-full border-2 border-sidebar-accent-foreground bg-sidebar-accent-foreground/20" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/60" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <TypeIcon
                          type={it.type}
                          className={cn(
                            'w-3 h-3 flex-shrink-0',
                            active ? 'text-sidebar-accent-foreground/80' : 'text-muted-foreground/70',
                          )}
                        />
                        <span className="truncate">{it.title || 'Untitled lesson'}</span>
                      </div>
                      {canEdit && !it.published && (
                        <span
                          className={cn(
                            'text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
                            active
                              ? 'bg-sidebar-accent-foreground/20 text-sidebar-accent-foreground'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          Draft
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

// --- Admin top strip ("Edit in Admin" / "Preview as admin") ---
function AdminTopBar({
  canEdit,
  courseId,
  previewAsStudent,
  onPreviewChange,
}: {
  canEdit: boolean;
  courseId: string;
  previewAsStudent: boolean;
  onPreviewChange: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;
  return (
    <div className="flex items-center gap-4 px-4 py-2 flex-shrink-0 text-sm bg-foreground text-background">
      <Link
        to={`/courses/${courseId}/builder`}
        className="inline-flex items-center gap-1.5 font-semibold hover:opacity-80"
      >
        <ArrowLeft className="w-4 h-4" />
        Edit in Admin
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-background/10 hover:bg-background/20"
        >
          {previewAsStudent ? 'Preview as student' : 'Preview as admin'}
          <ChevronDown className="w-3 h-3" />
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-md shadow-lg overflow-hidden bg-foreground border border-background/20">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPreviewChange(false);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-background/10"
            >
              Preview as admin
              <div className="text-[10px] text-background/60">See all content</div>
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPreviewChange(true);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-background/10"
            >
              Preview as student
              <div className="text-[10px] text-background/60">Published content only</div>
            </button>
          </div>
        )}
      </div>
      <div className="text-xs text-background/60">
        {previewAsStudent
          ? 'You are viewing only published content'
          : 'You can see both published and unpublished content'}
      </div>
    </div>
  );
}

// --- Course-home section accordion ---
function HomeSection({
  module,
  expanded,
  onToggle,
  completed,
  progressUnavailable = false,
  onSelect,
}: {
  module: CurriculumModule;
  expanded: boolean;
  onToggle: () => void;
  completed: Set<string>;
  progressUnavailable?: boolean;
  onSelect: (itemId: string) => void;
}) {
  const doneCount = module.items.filter((i) => completed.has(i.id)).length;
  return (
    <div className="rounded-xl bg-card overflow-hidden border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <div className="font-bold text-base">{module.title || 'Untitled section'}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {progressUnavailable
              ? 'Progress unavailable'
              : `${doneCount} / ${module.items.length} complete`}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {expanded && module.items.length > 0 && (
        <ul className="border-t border-border">
          {module.items.map((it) => {
            const done = completed.has(it.id);
            return (
              <li
                key={it.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-muted border-b last:border-b-0"
              >
                <span className="flex-shrink-0">
                  {done ? (
                    // The filled disc alone reads as "current", not "done" — the
                    // tick is what marks completion, the same signal the rail
                    // gives with CheckCircle2.
                    <div
                      role="img"
                      aria-label="Completed"
                      className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                    </div>
                  ) : (
                    <Circle
                      role="img"
                      aria-label="Not started"
                      className="w-5 h-5 text-muted-foreground/40"
                    />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium min-w-0">
                    <TypeIcon type={it.type} className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{it.title || 'Untitled lesson'}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{typeLabel(it.type)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(it.id)}
                  className={`text-xs font-bold px-4 py-1.5 rounded-md ${
                    done
                      ? 'bg-muted text-foreground hover:bg-muted/80'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {done ? 'Review' : 'Start'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CourseLearn;
