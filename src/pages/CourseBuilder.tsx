// ABOUTME: Teachable/Kajabi-style course builder. One page: header, left curriculum tree, right editor.
// ABOUTME: Replaces AdminCourseEdit + CourseManagement + CourseManagementDashboard + the module manager sprawl.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import { CourseHeaderBar } from '@/components/course/builder/CourseHeaderBar';
import {
  CurriculumTree,
  type CurriculumModule,
} from '@/components/course/builder/CurriculumTree';
import {
  LessonEditorPane,
  type LessonDraft,
} from '@/components/course/builder/LessonEditorPane';
import type { ContentItem, Module } from '@/types/canvas';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseBuilder');

interface CourseShell {
  id: string;
  title: string;
  published: boolean;
}

const CourseBuilder = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit, loading: permissionsLoading } = useCoursePermissions(
    courseId === 'new' ? undefined : courseId,
  );

  const [course, setCourse] = useState<CourseShell | null>(null);
  const [modules, setModules] = useState<CurriculumModule[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // --- Initial load ------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!courseId) return;
      setLoading(true);

      try {
        // Handle "new" course: create a skeleton and redirect to its builder URL.
        if (courseId === 'new') {
          const { data: created, error } = await supabase
            .from('courses')
            .insert({ title: 'Untitled course', published: false })
            .select('id, title, published')
            .single();
          if (error) throw error;
          navigate(`/courses/${created.id}/builder`, { replace: true });
          return;
        }

        // Course shell
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('id, title, published')
          .eq('id', courseId)
          .single();
        if (courseError) throw courseError;

        // Modules + their content items
        const rawModules = await CanvasContentService.getModules(courseId);
        const withItems = await Promise.all(
          rawModules.map(async (m) => {
            const items = await CanvasContentService.getContentItems(m.id);
            return { ...m, items } as CurriculumModule;
          }),
        );

        if (cancelled) return;
        setCourse(courseData as CourseShell);
        setModules(withItems);
        setExpanded(new Set(withItems.map((m) => m.id)));
        // Auto-select the first lesson if one exists
        const firstItem = withItems.flatMap((m) => m.items)[0];
        if (firstItem) setSelectedItemId(firstItem.id);
      } catch (err: any) {
        logger.error('Failed to load course for builder', err);
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
  }, [courseId, navigate, toast]);

  // --- Derived helpers ---------------------------------------------------
  const selectedItem: ContentItem | null = useMemo(() => {
    if (!selectedItemId) return null;
    for (const m of modules) {
      const found = m.items.find((i) => i.id === selectedItemId);
      if (found) return found;
    }
    return null;
  }, [modules, selectedItemId]);

  // --- Actions -----------------------------------------------------------
  const toggleExpand = useCallback((moduleId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }, []);

  const handleSelectItem = useCallback((_moduleId: string, itemId: string) => {
    setSelectedItemId(itemId);
  }, []);

  const handleAddModule = useCallback(async () => {
    if (!courseId) return;
    try {
      const created = await CanvasContentService.createModule(courseId, 'New module');
      const newCurriculumModule: CurriculumModule = { ...(created as Module), items: [] };
      setModules((prev) => [...prev, newCurriculumModule]);
      setExpanded((prev) => new Set(prev).add(created.id));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [courseId, toast]);

  const handleRenameModule = useCallback(
    async (moduleId: string, title: string) => {
      try {
        await CanvasContentService.updateModule(moduleId, { title });
        setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, title } : m)));
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const handleDeleteModule = useCallback(
    async (moduleId: string) => {
      if (!confirm('Delete this module and all its lessons?')) return;
      try {
        await CanvasContentService.deleteModule(moduleId);
        setModules((prev) => prev.filter((m) => m.id !== moduleId));
        if (selectedItem?.module_id === moduleId) setSelectedItemId(null);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [selectedItem, toast],
  );

  const handleAddItem = useCallback(
    async (moduleId: string) => {
      if (!courseId) return;
      try {
        const created = await CanvasContentService.createContentItem({
          course_id: courseId,
          module_id: moduleId,
          type: 'page',
          title: 'New lesson',
          content: '',
        });
        setModules((prev) =>
          prev.map((m) =>
            m.id === moduleId ? { ...m, items: [...m.items, created] } : m,
          ),
        );
        setSelectedItemId(created.id);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [courseId, toast],
  );

  const handleRenameItem = useCallback(
    async (itemId: string, title: string) => {
      try {
        await CanvasContentService.updateContentItem(itemId, { title });
        setModules((prev) =>
          prev.map((m) => ({
            ...m,
            items: m.items.map((i) => (i.id === itemId ? { ...i, title } : i)),
          })),
        );
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (!confirm('Delete this lesson?')) return;
      try {
        await CanvasContentService.deleteContentItem(itemId);
        setModules((prev) =>
          prev.map((m) => ({ ...m, items: m.items.filter((i) => i.id !== itemId) })),
        );
        if (selectedItemId === itemId) setSelectedItemId(null);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [selectedItemId, toast],
  );

  const handleReorderModules = useCallback(
    async (orderedIds: string[]) => {
      if (!courseId) return;
      // Optimistic reorder
      setModules((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m] as const));
        return orderedIds.map((id, i) => ({ ...(byId.get(id) as CurriculumModule), position: i }));
      });
      try {
        await CanvasContentService.reorderModules(courseId, orderedIds);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [courseId, toast],
  );

  const handleReorderItems = useCallback(
    async (moduleId: string, orderedIds: string[]) => {
      setModules((prev) =>
        prev.map((m) => {
          if (m.id !== moduleId) return m;
          const byId = new Map(m.items.map((i) => [i.id, i] as const));
          return {
            ...m,
            items: orderedIds.map((id, i) => ({ ...(byId.get(id) as ContentItem), position: i })),
          };
        }),
      );
      try {
        await CanvasContentService.reorderContentItems(moduleId, orderedIds);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const handleLessonSave = useCallback(
    async (itemId: string, draft: LessonDraft) => {
      try {
        await CanvasContentService.updateContentItem(itemId, {
          title: draft.title,
          type: draft.type,
          content: draft.content,
        } as any);
        setModules((prev) =>
          prev.map((m) => ({
            ...m,
            items: m.items.map((i) =>
              i.id === itemId
                ? { ...i, title: draft.title, type: draft.type, content: draft.content }
                : i,
            ),
          })),
        );
        setLastSavedAt(new Date());
      } catch (err: any) {
        toast({ title: 'Error saving lesson', description: err.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const handleCourseTitleChange = useCallback(
    async (title: string) => {
      if (!course) return;
      setCourse((c) => (c ? { ...c, title } : c));
      // Debounce the course title save via a short timeout
      setSaving(true);
      try {
        await supabase
          .from('courses')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('id', course.id);
        setLastSavedAt(new Date());
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    },
    [course, toast],
  );

  const handlePublishedChange = useCallback(
    async (next: boolean) => {
      if (!course) return;
      setCourse((c) => (c ? { ...c, published: next } : c));
      try {
        await supabase
          .from('courses')
          .update({ published: next, updated_at: new Date().toISOString() })
          .eq('id', course.id);
        toast({
          title: next ? 'Course published' : 'Course unpublished',
        });
        setLastSavedAt(new Date());
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [course, toast],
  );

  // --- Render ------------------------------------------------------------
  if (loading || permissionsLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[60vh]">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (!canEdit) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <h1 className="text-2xl font-semibold mb-2">Not authorized</h1>
          <p className="text-muted-foreground">
            You don't have permission to edit this course.
          </p>
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
        <CourseHeaderBar
          courseId={course.id}
          title={course.title}
          published={course.published}
          saving={saving}
          lastSavedAt={lastSavedAt}
          onPublishedChange={handlePublishedChange}
          onTitleChange={handleCourseTitleChange}
        />
        <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr] gap-0">
          <aside className="border-r bg-muted/20 min-h-0">
            <CurriculumTree
              modules={modules}
              selectedItemId={selectedItemId}
              expandedModuleIds={expanded}
              onToggleExpand={toggleExpand}
              onSelectItem={handleSelectItem}
              onAddModule={handleAddModule}
              onRenameModule={handleRenameModule}
              onDeleteModule={handleDeleteModule}
              onAddItem={handleAddItem}
              onRenameItem={handleRenameItem}
              onDeleteItem={handleDeleteItem}
              onReorderModules={handleReorderModules}
              onReorderItems={handleReorderItems}
            />
          </aside>
          <main className="p-4 overflow-y-auto min-h-0">
            <LessonEditorPane
              item={selectedItem}
              onSave={handleLessonSave}
              onDelete={handleDeleteItem}
              onSavingChange={setSaving}
            />
          </main>
        </div>
      </div>
    </AppLayout>
  );
};

export default CourseBuilder;
