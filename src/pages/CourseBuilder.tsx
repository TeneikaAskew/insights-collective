// ABOUTME: Teachable/Podia-style unified course builder built on the shared workspace shell.
// ABOUTME: Left curriculum rail (drag-reorder) + right lesson editor pane + sticky top bar controls.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Loader2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import CourseWorkspaceShell from '@/components/course/workspace/CourseWorkspaceShell';
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!courseId) return;
      setLoading(true);
      try {
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

        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('id, title, published')
          .eq('id', courseId)
          .single();
        if (courseError) throw courseError;

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

  const selectedItem: ContentItem | null = useMemo(() => {
    if (!selectedItemId) return null;
    for (const m of modules) {
      const found = m.items.find((i) => i.id === selectedItemId);
      if (found) return found;
    }
    return null;
  }, [modules, selectedItemId]);

  const toggleExpand = useCallback((mid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(mid) ? next.delete(mid) : next.add(mid);
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
        toast({ title: next ? 'Course published' : 'Course unpublished' });
        setLastSavedAt(new Date());
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [course, toast],
  );

  if (loading || permissionsLoading) {
    return (
      <div className="fixed inset-0 flex justify-center items-center bg-white">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="fixed inset-0 flex justify-center items-center bg-white">
        <div className="text-center px-6">
          <h1 className="text-2xl font-semibold mb-2">Not authorized</h1>
          <p className="text-muted-foreground">You don't have permission to edit this course.</p>
          <Link to="/courses" className="mt-4 inline-block text-sm underline">
            Back to courses
          </Link>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="fixed inset-0 flex justify-center items-center bg-white">
        <h1 className="text-2xl font-semibold">Course not found</h1>
      </div>
    );
  }

  return (
    <CourseWorkspaceShell
      sidebar={
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
      }
      header={
        <>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link
              to="/admin/courses"
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors flex-shrink-0"
              aria-label="Back to courses"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <input
              className="flex-1 min-w-0 bg-transparent font-bold text-lg outline-none focus:ring-2 focus:ring-teal-400 rounded px-2 py-1 -mx-2"
              value={course.title}
              placeholder="Untitled course"
              onChange={(e) => handleCourseTitleChange(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {saving && (
              <span className="hidden md:flex items-center gap-1 text-xs text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving…
              </span>
            )}
            {!saving && lastSavedAt && (
              <span className="hidden md:inline text-xs text-gray-400">Saved</span>
            )}
            <Link
              to={`/courses/${course.id}/learn`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              style={{ borderColor: 'hsl(var(--cw-border))' }}
            >
              <Eye className="w-4 h-4" />
              Preview
            </Link>
            <div
              className="flex items-center gap-2 border rounded-full px-3 py-1.5"
              style={{
                borderColor: 'hsl(var(--cw-border))',
                background: course.published ? 'hsl(var(--cw-accent) / 0.08)' : '#f9fafb',
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: course.published ? 'hsl(var(--cw-accent))' : '#d1d5db',
                }}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                {course.published ? 'Published' : 'Draft'}
              </span>
              <Switch
                checked={course.published}
                onCheckedChange={handlePublishedChange}
                className="ml-1"
              />
            </div>
          </div>
        </>
      }
    >
      <div className="p-8 lg:p-12">
        <div className="max-w-4xl mx-auto">
          <LessonEditorPane
            item={selectedItem}
            onSave={handleLessonSave}
            onDelete={handleDeleteItem}
            onSavingChange={setSaving}
          />
        </div>
      </div>
    </CourseWorkspaceShell>
  );
};

export default CourseBuilder;
