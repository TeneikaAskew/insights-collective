// ABOUTME: Teachable-style student course player.
// ABOUTME: Dark admin top bar + dark left curriculum rail + centered lesson content + pill Prev/Next controls.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  FileText,
  Home,
  Settings,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
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

const logger = createLogger('CourseLearn');

interface CourseShell {
  id: string;
  title: string;
  thumbnail: string | null;
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

  const [course, setCourse] = useState<CourseShell | null>(null);
  const [modules, setModules] = useState<CurriculumModule[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const { data: progress, markItemComplete } = useCourseProgress(courseId);

  const flatItems = useMemo(
    () => modules.flatMap((m) => m.items.map((i) => ({ module: m, item: i }))),
    [modules],
  );

  const selected = useMemo(() => {
    if (!itemId) return null;
    return flatItems.find((fi) => fi.item.id === itemId) || null;
  }, [flatItems, itemId]);

  // --- Load ---
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!courseId) return;
      setLoading(true);
      try {
        const { data: courseData, error } = await supabase
          .from('courses')
          .select('id, title, thumbnail')
          .eq('id', courseId)
          .single();
        if (error) throw error;

        const rawModules = await CanvasContentService.getModules(courseId);
        const visible = canEdit ? rawModules : rawModules.filter((m) => m.published);
        const withItems = await Promise.all(
          visible.map(async (m) => {
            const items = await CanvasContentService.getContentItems(m.id);
            const filtered = canEdit ? items : items.filter((i) => i.published !== false);
            return { id: m.id, title: m.title, items: filtered } as CurriculumModule;
          }),
        );

        if (cancelled) return;
        setCourse(courseData as CourseShell);
        setModules(withItems);
        setExpanded(new Set(withItems.map((m) => m.id)));
      } catch (err: any) {
        logger.error('Failed to load learn view', err);
        toast({ title: 'Error', description: err?.message, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [courseId, canEdit, toast]);

  // --- Progress fetch ---
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id || flatItems.length === 0) {
        if (!cancelled) setCompleted(new Set());
        return;
      }
      const { data } = await supabase
        .from('content_item_progressions')
        .select('content_item_id, workflow_state')
        .eq('user_id', user.id)
        .in('content_item_id', flatItems.map((fi) => fi.item.id));
      if (cancelled) return;
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
  }, [user?.id, flatItems, progress?.completedItems]);

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

  const goTo = useCallback(
    (mid: string, iid: string) => {
      navigate(`/courses/${courseId}/learn/${mid}/${iid}`);
    },
    [courseId, navigate],
  );

  const toggleExpand = useCallback((mid: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(mid) ? n.delete(mid) : n.add(mid);
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
    if (next) goTo(next.module.id, next.item.id);
  }, [selected, isSelectedComplete, handleMarkDone, next, goTo]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Course not found</h1>
          <Link to="/courses" className="text-sm underline">
            Back to courses
          </Link>
        </div>
      </div>
    );
  }

  // --- Course home (no lesson selected) ---
  if (!selected) {
    return (
      <div
        className="teachable-workspace fixed inset-0 flex flex-col"
        style={{ background: '#F5F5F0', color: 'hsl(var(--tw-text))' }}
      >
        <AdminTopBar canEdit={canEdit} courseId={course.id} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-8 py-14">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
              <div>
                <h1 className="font-display text-5xl mb-3">{course.title}</h1>
                <p className="text-sm text-gray-600 mb-8">
                  {flatItems.length} lessons · Continue where you left off
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const first = flatItems[0];
                    if (first) goTo(first.module.id, first.item.id);
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-md font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Start Lesson
                </button>

                <div className="mt-10 space-y-4">
                  {modules.map((m) => (
                    <HomeSection
                      key={m.id}
                      module={m}
                      expanded={expanded.has(m.id)}
                      onToggle={() => toggleExpand(m.id)}
                      completed={completed}
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
                  <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, percent))}%`,
                        background: 'hsl(var(--tw-accent))',
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-6" style={{ borderTop: '1px solid #E5E5E5' }}>
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ background: 'hsl(var(--tw-accent))' }}
                  >
                    {course.thumbnail ? (
                      <img
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-2xl">
                        {course.title.charAt(0).toUpperCase()}
                      </span>
                    )}
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
    <div
      className="teachable-workspace fixed inset-0 flex flex-col bg-background text-foreground"
    >
      <AdminTopBar canEdit={canEdit} courseId={course.id} />

      {/* Player top bar with prev/next pills */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            to={`/courses/${course.id}/learn`}
            className="w-9 h-9 rounded-md flex items-center justify-center text-foreground hover:bg-muted"
            aria-label="Course home"
          >
            <Home className="w-4 h-4" />
          </Link>
          <Link
            to={`/courses/${course.id}`}
            className="w-9 h-9 rounded-md flex items-center justify-center text-primary hover:bg-muted"
            aria-label="Course settings"
            title="Course settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && goTo(prev.module.id, prev.item.id)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Lesson
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSelectedComplete ? 'Continue' : 'Complete and Continue'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>


      <div className="flex-1 flex min-h-0">
        {/* Left curriculum rail */}
        <aside className="w-72 flex-shrink-0 overflow-y-auto bg-muted/40 border-r border-border">
          <nav className="p-3 space-y-5">
            {modules.map((m) => (
              <div key={m.id}>
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2">
                  {m.title || 'Untitled section'}
                </div>
                <ul className="space-y-0.5">
                  {m.items.map((it) => {
                    const active = selected?.item.id === it.id;
                    const done = completed.has(it.id);
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => goTo(m.id, it.id)}
                          className={cn(
                            'w-full flex items-start gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors',
                            active
                              ? 'bg-primary/10 text-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                          style={
                            active
                              ? { borderLeft: '2px solid hsl(var(--primary))', paddingLeft: 10 }
                              : undefined
                          }
                        >
                          <span className="mt-0.5 flex-shrink-0">
                            {done ? (
                              <div className="w-4 h-4 rounded-full bg-primary" />
                            ) : active ? (
                              <div
                                className="w-4 h-4 rounded-full border-2 border-primary"
                                style={{
                                  background:
                                    'radial-gradient(circle, hsl(var(--primary)) 40%, transparent 42%)',
                                }}
                              />
                            ) : (
                              <Circle className="w-4 h-4 text-muted-foreground/60" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="truncate">
                              {it.title || 'Untitled lesson'}
                            </div>
                            {canEdit && !it.published && (
                              <span className="inline-block mt-1 text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                Draft
                              </span>
                            )}
                          </div>
                        </button>

                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-10 pb-32">
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-primary text-primary-foreground">
                <FileText className="w-3 h-3" />
                {selected.item.type === 'quiz'
                  ? 'Quiz'
                  : selected.item.type === 'assignment'
                  ? 'Assignment'
                  : selected.item.type === 'external_url'
                  ? 'External Link'
                  : 'Lesson'}
              </span>
            </div>
            <h1 className="font-display text-4xl mb-6">{selected.item.title}</h1>
            <LessonViewer
              item={selected.item}
              isCompleted={isSelectedComplete}
              onNavigate={() => undefined}
              onMarkDone={handleMarkDone}
              actionBasePath={`/courses/${course.id}/modules/${selected.module.id}`}
              hideFooter
            />

            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold"
                style={{ background: '#111', color: '#fff' }}
              >
                {isSelectedComplete ? 'Continue' : 'Complete and Continue'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// --- Admin top strip ("Edit in Admin" / "Preview as admin") ---
function AdminTopBar({ canEdit, courseId }: { canEdit: boolean; courseId: string }) {
  if (!canEdit) return null;
  return (
    <div
      className="flex items-center gap-4 px-4 py-2 flex-shrink-0 text-sm"
      style={{ background: '#000', color: '#fff' }}
    >
      <Link
        to={`/courses/${courseId}/builder`}
        className="inline-flex items-center gap-1.5 font-semibold hover:opacity-80"
      >
        <ArrowLeft className="w-4 h-4" />
        Edit in Admin
      </Link>
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold"
        style={{ background: '#222' }}
      >
        Preview as admin
        <ChevronDown className="w-3 h-3" />
      </div>
      <div className="text-xs text-gray-400">
        You can see both published and unpublished content
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
  onSelect,
}: {
  module: CurriculumModule;
  expanded: boolean;
  onToggle: () => void;
  completed: Set<string>;
  onSelect: (itemId: string) => void;
}) {
  const doneCount = module.items.filter((i) => completed.has(i.id)).length;
  return (
    <div
      className="rounded-xl bg-white overflow-hidden"
      style={{ border: '1px solid #E5E5E5' }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <div className="font-bold text-base">{module.title || 'Untitled section'}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {doneCount} / {module.items.length} complete
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {expanded && module.items.length > 0 && (
        <ul style={{ borderTop: '1px solid #F0F0F0' }}>
          {module.items.map((it) => {
            const done = completed.has(it.id);
            return (
              <li
                key={it.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 border-b last:border-b-0"
                style={{ borderColor: '#F0F0F0' }}
              >
                <span className="flex-shrink-0">
                  {done ? (
                    <div
                      className="w-5 h-5 rounded-full"
                      style={{ background: 'hsl(var(--tw-accent))' }}
                    />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {it.title || 'Untitled lesson'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(it.id)}
                  className="text-xs font-bold px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
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
