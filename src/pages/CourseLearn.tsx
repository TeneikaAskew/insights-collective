// ABOUTME: Student-facing course player with the unified Teachable-inspired workspace shell.
// ABOUTME: Curriculum rail + reading column + floating pill footer (Previous / Mark done / Next).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import CourseWorkspaceShell from '@/components/course/workspace/CourseWorkspaceShell';
import {
  CurriculumTree,
  type CurriculumModule,
} from '@/components/course/builder/CurriculumTree';
import { LessonViewer } from '@/components/course/learn/LessonViewer';
import type { ContentItem } from '@/types/canvas';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseLearn');

interface CourseShell {
  id: string;
  title: string;
}

const CourseLearn = () => {
  const { courseId, itemId } = useParams<{
    courseId: string;
    moduleId?: string;
    itemId?: string;
  }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [course, setCourse] = useState<CourseShell | null>(null);
  const [modules, setModules] = useState<CurriculumModule[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [completedInCourse, setCompletedInCourse] = useState<Set<string>>(new Set());

  const { data: progress, markItemComplete } = useCourseProgress(courseId);

  const flatItems = useMemo(
    () => modules.flatMap((m) => m.items.map((i) => ({ module: m, item: i }))),
    [modules],
  );

  const selected = useMemo(() => {
    if (!itemId) return null;
    return flatItems.find((fi) => fi.item.id === itemId) || null;
  }, [flatItems, itemId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!courseId) return;
      setLoading(true);
      try {
        const { data: courseData, error: courseErr } = await supabase
          .from('courses')
          .select('id, title')
          .eq('id', courseId)
          .single();
        if (courseErr) throw courseErr;

        const rawModules = await CanvasContentService.getModules(courseId);
        const publishedModules = rawModules.filter((m) => m.published);
        const withItems = await Promise.all(
          publishedModules.map(async (m) => {
            const items = await CanvasContentService.getContentItems(m.id);
            return { ...m, items: items.filter((i) => i.published !== false) } as CurriculumModule;
          }),
        );

        if (cancelled) return;
        setCourse(courseData as CourseShell);
        setModules(withItems);
        setExpanded(new Set(withItems.map((m) => m.id)));

        if (!itemId) {
          const first = withItems.find((m) => m.items.length > 0);
          if (first) {
            navigate(`/courses/${courseId}/learn/${first.id}/${first.items[0].id}`, {
              replace: true,
            });
          }
        }
      } catch (err: any) {
        logger.error('Failed to load course for learn view', err);
        toast({
          title: 'Error',
          description: err?.message || 'Failed to load course',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [courseId, navigate, toast, itemId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id || flatItems.length === 0) {
        if (!cancelled) setCompletedInCourse(new Set());
        return;
      }
      const { data } = await supabase
        .from('content_item_progressions')
        .select('content_item_id, workflow_state')
        .eq('user_id', user.id)
        .in('content_item_id', flatItems.map((fi) => fi.item.id));
      if (cancelled) return;
      setCompletedInCourse(
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
  const prevItem: ContentItem | null =
    currentIndex > 0 ? flatItems[currentIndex - 1].item : null;
  const nextItem: ContentItem | null =
    currentIndex >= 0 && currentIndex < flatItems.length - 1
      ? flatItems[currentIndex + 1].item
      : null;
  const prevModuleId =
    currentIndex > 0 ? flatItems[currentIndex - 1].module.id : null;
  const nextModuleId =
    currentIndex >= 0 && currentIndex < flatItems.length - 1
      ? flatItems[currentIndex + 1].module.id
      : null;

  const isSelectedComplete = selected
    ? completedInCourse.has(selected.item.id)
    : false;

  const toggleExpand = useCallback((mid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(mid) ? next.delete(mid) : next.add(mid);
      return next;
    });
  }, []);

  const goTo = useCallback(
    (mid: string, iid: string) => {
      navigate(`/courses/${courseId}/learn/${mid}/${iid}`);
    },
    [courseId, navigate],
  );

  const handleMarkDone = useCallback(
    async (id: string) => {
      try {
        await markItemComplete(id);
        setCompletedInCourse((prev) => new Set(prev).add(id));
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [markItemComplete, toast],
  );

  if (loading) {
    return (
      <div className="fixed inset-0 flex justify-center items-center bg-white">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="fixed inset-0 flex justify-center items-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Course not found</h1>
          <Link to="/courses" className="text-sm underline">
            Back to courses
          </Link>
        </div>
      </div>
    );
  }

  const percent = progress?.percent ?? 0;

  return (
    <CourseWorkspaceShell
      sidebar={
        <CurriculumTree
          modules={modules}
          selectedItemId={selected?.item.id}
          expandedModuleIds={expanded}
          completedItemIds={completedInCourse}
          readOnly
          progressPercent={percent}
          onToggleExpand={toggleExpand}
          onSelectItem={goTo}
        />
      }
      header={
        <>
          <div className="flex items-center gap-4 min-w-0">
            <Link
              to="/courses"
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors flex-shrink-0"
              aria-label="Back to courses"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-bold text-lg truncate">{course.title}</h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div
              className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5"
              style={{ borderColor: 'hsl(var(--cw-border))' }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: 'hsl(var(--cw-accent))' }}
              />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {Math.round(percent)}% Complete
              </span>
            </div>
          </div>
        </>
      }
      footer={
        selected ? (
          <div
            className="flex items-center bg-white border rounded-2xl p-1.5 shadow-lg"
            style={{ borderColor: 'hsl(var(--cw-border))' }}
          >
            <button
              type="button"
              disabled={!prevItem}
              onClick={() => prevItem && prevModuleId && goTo(prevModuleId, prevItem.id)}
              className="px-5 py-2.5 text-gray-500 font-semibold text-sm rounded-xl hover:bg-gray-50 hover:text-gray-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              type="button"
              disabled={isSelectedComplete}
              onClick={() => selected && handleMarkDone(selected.item.id)}
              className="px-6 py-2.5 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2 disabled:opacity-70"
              style={{
                background: 'hsl(var(--cw-accent))',
                boxShadow: '0 4px 14px 0 hsl(var(--cw-accent) / 0.4)',
              }}
            >
              <Check className="w-4 h-4" strokeWidth={3} />
              {isSelectedComplete ? 'Completed' : 'Mark as Complete'}
            </button>
            <button
              type="button"
              disabled={!nextItem}
              onClick={() => nextItem && nextModuleId && goTo(nextModuleId, nextItem.id)}
              className="px-5 py-2.5 text-gray-500 font-semibold text-sm rounded-xl hover:bg-gray-50 hover:text-gray-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="p-8 lg:p-12 pb-32">
        <div className="max-w-4xl mx-auto">
          <LessonViewer
            item={selected?.item ?? null}
            prevItem={null}
            nextItem={null}
            isCompleted={isSelectedComplete}
            onNavigate={() => undefined}
            onMarkDone={handleMarkDone}
            actionBasePath={
              selected
                ? `/courses/${courseId}/modules/${selected.module.id}`
                : `/courses/${courseId}`
            }
            hideFooter
          />
        </div>
      </div>
    </CourseWorkspaceShell>
  );
};

export default CourseLearn;
