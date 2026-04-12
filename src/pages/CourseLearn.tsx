// ABOUTME: Student-facing course consumption page. Reuses CurriculumTree (read-only) + LessonViewer.
// ABOUTME: Replaces the nested module/lesson route sprawl with a single predictable URL shape.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import { useCourseProgress } from '@/hooks/useCourseProgress';
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
  const { courseId, moduleId, itemId } = useParams<{
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

  const { data: progress, markItemComplete, getModulePercent } = useCourseProgress(courseId);

  // Flatten items for prev/next navigation
  const flatItems = useMemo(
    () => modules.flatMap((m) => m.items.map((i) => ({ module: m, item: i }))),
    [modules],
  );

  // Find selected lesson from URL
  const selected = useMemo(() => {
    if (!itemId) return null;
    return flatItems.find((fi) => fi.item.id === itemId) || null;
  }, [flatItems, itemId]);

  // --- Load course + modules + items -----------------------------------
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

        // If no lesson is selected, redirect to the first one
        if (!itemId) {
          const first = withItems.find((m) => m.items.length > 0);
          if (first) {
            navigate(
              `/courses/${courseId}/learn/${first.id}/${first.items[0].id}`,
              { replace: true },
            );
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
  }, [courseId, itemId, navigate, toast]);

  // --- Load completion state across the course --------------------------
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
        .in(
          'content_item_id',
          flatItems.map((fi) => fi.item.id),
        );
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

  // --- Derived prev/next ------------------------------------------------
  const currentIndex = selected
    ? flatItems.findIndex((fi) => fi.item.id === selected.item.id)
    : -1;
  const prevItem: ContentItem | null =
    currentIndex > 0 ? flatItems[currentIndex - 1].item : null;
  const nextItem: ContentItem | null =
    currentIndex >= 0 && currentIndex < flatItems.length - 1
      ? flatItems[currentIndex + 1].item
      : null;

  // --- Handlers ---------------------------------------------------------
  const toggleExpand = useCallback((moduleId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }, []);

  const goTo = useCallback(
    (moduleIdTarget: string, itemIdTarget: string) => {
      navigate(`/courses/${courseId}/learn/${moduleIdTarget}/${itemIdTarget}`);
    },
    [courseId, navigate],
  );

  const handleNavigate = useCallback(
    (targetId: string) => {
      const target = flatItems.find((fi) => fi.item.id === targetId);
      if (target) goTo(target.module.id, target.item.id);
    },
    [flatItems, goTo],
  );

  const handleMarkDone = useCallback(
    async (id: string) => {
      try {
        await markItemComplete(id);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [markItemComplete, toast],
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[60vh]">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (!course) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <h1 className="text-2xl font-semibold mb-2">Course not found</h1>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Minimal header — the curriculum tree is the primary nav */}
        <div className="border-b bg-background px-4 py-3 flex items-center gap-4">
          <h1 className="text-lg font-semibold truncate flex-1">{course.title}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[180px]">
            <span>{progress?.percent ?? 0}% complete</span>
            <Progress value={progress?.percent ?? 0} className="h-2 flex-1" />
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr] gap-0">
          <aside className="border-r bg-muted/20 min-h-0">
            <CurriculumTree
              modules={modules}
              selectedItemId={selected?.item.id}
              expandedModuleIds={expanded}
              completedItemIds={completedInCourse}
              readOnly
              onToggleExpand={toggleExpand}
              onSelectItem={goTo}
            />
          </aside>

          <main className="p-4 overflow-y-auto min-h-0">
            <LessonViewer
              item={selected?.item ?? null}
              prevItem={prevItem}
              nextItem={nextItem}
              isCompleted={selected ? completedInCourse.has(selected.item.id) : false}
              onNavigate={handleNavigate}
              onMarkDone={handleMarkDone}
              actionBasePath={
                selected
                  ? `/courses/${courseId}/modules/${selected.module.id}`
                  : `/courses/${courseId}`
              }
            />
          </main>
        </div>
      </div>
    </AppLayout>
  );
};

export default CourseLearn;
