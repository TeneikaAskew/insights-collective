// ABOUTME: Instructor course builder — Teachable-mirrored shell with Setup guide, Curriculum, and Lesson views.
// ABOUTME: Handles the new-course 5-step wizard and orchestrates all lesson/section CRUD.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import type { ContentItem, ContentItemType, Module } from '@/types/canvas';
import { createLogger } from '@/utils/logger';
import { publishPatch, publishReadinessIssues, updateCourse } from '@/utils/coursePublish';
import { TeachableShell, type BuilderNavKey } from '@/components/course/builder/teachable/TeachableShell';
import { SetupGuideView } from '@/components/course/builder/teachable/SetupGuideView';
import { CurriculumView } from '@/components/course/builder/teachable/CurriculumView';
import { LessonEditView } from '@/components/course/builder/teachable/LessonEditView';
import { PlaceholderView } from '@/components/course/builder/teachable/PlaceholderView';
import { CourseInformationView } from '@/components/course/builder/teachable/CourseInformationView';
import { CourseDesignView } from '@/components/course/builder/teachable/CourseDesignView';
import { CourseCertificatesView } from '@/components/course/builder/teachable/CourseCertificatesView';
import { CourseSettingsView } from '@/components/course/builder/teachable/CourseSettingsView';
import { StudentsView } from '@/components/course/builder/teachable/StudentsView';
import { ReportsView } from '@/components/course/builder/teachable/ReportsView';
import { InstructorBuilderTour } from '@/components/onboarding/InstructorBuilderTour';
import {
  NewCourseWizard,
  type NewCourseWizardResult,
} from '@/components/course/builder/teachable/NewCourseWizard';
import type { BuilderCourse, BuilderModule } from '@/components/course/builder/teachable/types';
import { ConfirmDialog } from '@/components/course/builder/teachable/ConfirmDialog';
import { applyIdOrder, createReorderSequencer } from '@/components/course/builder/reorderReconcile';
import { planFor, runCreationPlan, type CreationPlan } from '@/components/course/builder/courseCreation';
import {
  LessonSaveQueue,
  getSharedLessonSaveQueue,
  resolveSessionStorage,
  suspendForeignLessonSaveQueues,
  type LessonSaveSnapshot,
  type PersistedLesson,
} from '@/components/course/builder/lessonSaveQueue';

const logger = createLogger('CourseBuilder');

const PLACEHOLDER_COPY: Record<
  Exclude<BuilderNavKey, 'setup' | 'curriculum' | 'lesson'>,
  { title: string; description: string }
> = {
  design: {
    title: 'Design templates',
    description: 'Pick a color scheme and layout for how learners see this course.',
  },
  certificates: {
    title: 'Certificates',
    description: 'Award a completion certificate when students finish this course.',
  },
  information: {
    title: 'Course information',
    description: 'Category, level, tags, and course-level metadata.',
  },
  pricing: {
    title: 'Pricing',
    description:
      'Once this ships, you will be able to set a one-time price, payment plan, subscription, or free enrollment.',
  },
  sales: {
    title: 'Sales pages',
    description:
      'Once this ships, you will be able to design the sales page learners see before enrolling.',
  },
  students: {
    title: 'Students',
    description:
      'Once this ships, you will be able to view, enroll, and manage students in this course.',
  },
  settings: {
    title: 'Settings',
    description: 'Configure additional course settings.',
  },
  reports: {
    title: 'Reports',
    description:
      'Once this ships, you will get enrollment, revenue, and lesson-progress reports here.',
  },
};

const CourseBuilder = () => {
  const { courseId: rawCourseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  // Treat both `/courses/new/builder` (no :courseId param) and `/courses/:courseId/builder`
  // with `courseId === 'new'` as the new-course flow.
  const isNew =
    !rawCourseId ||
    rawCourseId === 'new' ||
    (typeof window !== 'undefined' && window.location.pathname.includes('/courses/new/builder'));
  const courseId = isNew ? undefined : rawCourseId;
  const { canEdit, loading: permissionsLoading } = useCoursePermissions(courseId);
  const { user } = useAuth();

  const [course, setCourse] = useState<BuilderCourse | null>(null);
  const [modules, setModules] = useState<BuilderModule[]>([]);
  // Latest committed modules, read by the reorder handlers to capture the order they replace.
  const modulesRef = useRef(modules);
  modulesRef.current = modules;
  const reorderSeq = useRef(createReorderSequencer()).current;
  // The in-flight or failed wizard creation, kept so a retry resumes it (T-56).
  const creationPlanRef = useRef<CreationPlan | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [showWizard, setShowWizard] = useState(isNew);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const activeView: BuilderNavKey = (searchParams.get('view') as BuilderNavKey) || 'setup';
  const lessonFromUrl = searchParams.get('lesson');
  // The URL is the source of truth for the open lesson, so a deep link or a
  // reload of `?view=lesson&lesson=B` opens B, not the first lesson.
  const effectiveLessonId = lessonFromUrl || selectedLessonId;
  const lessonFromUrlRef = useRef(lessonFromUrl);
  lessonFromUrlRef.current = lessonFromUrl;

  // --- Lesson drafts ---
  // Drafts live here, not in the editor, so switching lesson, switching view or
  // leaving the builder never silently drops an edit made inside the debounce.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const mountedRef = useRef(true);
  const openLessonRef = useRef<string | null>(null);
  openLessonRef.current = activeView === 'lesson' ? effectiveLessonId : null;

  // One queue per (signed-in user, course) for the lifetime of the tab: a remounted builder reuses the
  // queue that still owns in-flight writes, and another user's drafts are never visible here.
  const userId = user?.id ?? null;
  const queueScope = userId && courseId ? `${userId}:${courseId}` : null;
  const saveQueue = useMemo(() => {
    const create = () =>
      new LessonSaveQueue({
        persist: (id, fields, expected) => CanvasContentService.saveLessonDraft(id, fields, expected),
        read: (id) => CanvasContentService.getLessonDraftRow(id),
        storage: queueScope ? resolveSessionStorage() : null,
        storageScope: queueScope ?? '',
        ownerId: userId,
        // The supabase client is global: whoever is signed in NOW is who a request would act as.
        currentUserId: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.user?.id ?? null;
        },
      });
    return queueScope ? getSharedLessonSaveQueue(queueScope, create) : create();
  }, [queueScope]);

  // Bind callbacks to this mounted builder; on unmount keep only the toast, so a failure that lands after
  // the author left is still reported (and says whether the draft can actually be recovered).
  useEffect(() => {
    const onFailed = (id: string, snap: LessonSaveSnapshot) => {
      // The open editor shows the failure inline; tell the author about lessons they have already left.
      if (mountedRef.current && openLessonRef.current === id) return;
      const keep = snap.recoverable
        ? mountedRef.current
          ? 'Open the lesson to retry; your changes are kept.'
          : 'Your draft is kept in this browser tab. Reopen the course builder to retry.'
        : 'Your changes could not be stored in this browser tab, so they will be lost if you close or leave the page. Open the lesson and retry now.';
      toastRef.current({
        title: `Lesson \u201c${snap.draft.title || 'Untitled lesson'}\u201d was not saved`,
        description: `${snap.error ?? ''} ${keep}`,
        variant: 'destructive',
      });
    };
    saveQueue.setHandlers({
      onPersisted: (row: PersistedLesson) => {
        // Reflect only what the server confirmed, only on the lesson it was for.
        setModules((prev) =>
          prev.map((m) => ({
            ...m,
            items: m.items.map((i) =>
              i.id === row.id
                ? {
                    ...i,
                    title: row.title,
                    content: row.content,
                    ...(row.updated_at !== undefined ? { updated_at: row.updated_at } : {}),
                    ...(typeof row.published === 'boolean' ? { published: row.published } : {}),
                  }
                : i,
            ),
          })),
        );
      },
      onFailed,
    });
    return () => saveQueue.setHandlers({ onFailed });
  }, [saveQueue]);

  // Same-tab user switch: suspend every other user's queue (each queue also checks the session user before
  // every request), and resume this user's own queue if it was suspended. Nothing is deleted: other users'
  // drafts stay in this tab for their owners and are never loaded here.
  useEffect(() => {
    suspendForeignLessonSaveQueues(userId);
    if (userId) saveQueue.resume();
  }, [userId, saveQueue]);

  // Re-render the builder only when the set of failed lessons changes, not on
  // every keystroke (the editor subscribes to its own lesson separately).
  const failedKey = useSyncExternalStore(
    saveQueue.subscribe,
    () => saveQueue.failedIds().join('\n'),
    () => saveQueue.failedIds().join('\n'),
  );
  const failedLessonIds = useMemo(() => (failedKey ? failedKey.split('\n') : []), [failedKey]);

  // Flush on teardown; warn before reload/close while anything is unconfirmed.
  useEffect(() => {
    mountedRef.current = true;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!saveQueue.hasUnsaved()) return;
      void saveQueue.flushAll();
      e.preventDefault();
      e.returnValue = '';
    };
    const onOnline = () => {
      void saveQueue.retryFailed();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('online', onOnline);
      mountedRef.current = false;
      void saveQueue.flushAll();
    };
  }, [saveQueue]);

  // --- Data load ---
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    const load = async () => {
      if (!courseId) return;
      setLoading(true);
      try {
        const { data: courseData, error } = await supabase
          .from('courses')
          .select('id, title, description, thumbnail, image_url, published, category, level, tags, duration, estimated_hours, difficulty_level, settings')
          .eq('id', courseId)
          .single();
        if (error) throw error;

        const rawModules = await CanvasContentService.getModules(courseId);
        const withItems = await Promise.all(
          rawModules.map(async (m) => {
            const items = await CanvasContentService.getContentItems(m.id);
            return { ...m, items } as BuilderModule;
          }),
        );

        if (cancelled) return;
        setCourse(courseData as BuilderCourse);
        setModules(withItems);
        const allItems = withItems.flatMap((m) => m.items);
        // Respect a requested lesson; only default to the first one when the
        // URL does not name a lesson.
        const requested = lessonFromUrlRef.current;
        const requestedExists = !!requested && allItems.some((it) => it.id === requested);
        setSelectedLessonId(requestedExists ? requested : (allItems[0]?.id ?? null));
      } catch (err: any) {
        logger.error('Failed to load builder', err);
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [courseId, isNew, toast]);

  // Register lessons with the save queue (which may restore mirrored drafts) only once this user is
  // confirmed to be allowed to edit the course.
  useEffect(() => {
    if (permissionsLoading || !canEdit) return;
    modules.forEach((m) =>
      m.items.forEach((it) =>
        saveQueue.track({
          id: it.id,
          title: it.title ?? '',
          content: it.content ?? '',
          updated_at: it.updated_at,
        }),
      ),
    );
  }, [modules, canEdit, permissionsLoading, saveQueue]);

  // --- Wizard finish ---
  const handleWizardFinish = useCallback(
    async (r: NewCourseWizardResult, onProgress: (steps: any[]) => void) => {
      const outline = r.outline ?? [];
      const totalLessons = outline.reduce((sum, s) => sum + s.lessons.length, 0);

      // Build initial step list — thumbnail step is skipped when no file
      const steps: {
        id: string;
        label: string;
        status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
        detail?: string;
      }[] = [
        {
          id: 'thumbnail',
          label: r.thumbnailFile ? 'Uploading thumbnail' : 'Skipping thumbnail (none provided)',
          status: r.thumbnailFile ? 'pending' : 'skipped',
        },
        { id: 'course', label: 'Creating course record', status: 'pending' },
        {
          id: 'curriculum',
          label: `Seeding curriculum (${outline.length} section${outline.length === 1 ? '' : 's'}, ${totalLessons} lesson${totalLessons === 1 ? '' : 's'})`,
          status: outline.length > 0 ? 'pending' : 'skipped',
        },
      ];
      const emit = () => onProgress(steps.map((s) => ({ ...s })));
      emit();

      const setStep = (
        id: string,
        status: (typeof steps)[number]['status'],
        detail?: string,
      ) => {
        const s = steps.find((x) => x.id === id);
        if (s) {
          s.status = status;
          if (detail !== undefined) s.detail = detail;
        }
        emit();
      };

      try {
        const { data: userData } = await supabase.auth.getUser();
        const instructorId = userData.user?.id ?? null;

        // Same input as a failed attempt resumes that attempt's plan (same ids), so a retry finishes the
        // same course instead of creating another one.
        const plan = planFor(creationPlanRef.current, r);
        creationPlanRef.current = plan;
        const courseId = await runCreationPlan({
          plan,
          result: r,
          instructorId,
          client: supabase as any,
          report: { step: setStep },
          onThumbnailError: (e) => logger.error('Thumbnail upload failed', e),
        });
        creationPlanRef.current = null;
        const created = { id: courseId };

        toast({ title: 'Course created', description: `“${r.title}” is ready to build.` });
        navigate(`/courses/${created.id}/builder`, { replace: true });
      } catch (err: any) {
        logger.error('Course creation failed', err);
        // Mark any still-running step as error so the overlay reflects the failure
        const running = steps.find((s) => s.status === 'running');
        if (running) setStep(running.id, 'error', err?.message);
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
        // Rethrow so the wizard shows an inline error banner instead of
        // silently closing on failure.
        throw err;
      }
    },
    [navigate, toast],
  );


  // --- Navigation ---
  const goToView = useCallback(
    (key: BuilderNavKey, lessonId?: string) => {
      const next = new URLSearchParams(searchParams);
      next.set('view', key);
      if (lessonId) next.set('lesson', lessonId);
      else next.delete('lesson');
      setSearchParams(next, { replace: true });
      if (lessonId) setSelectedLessonId(lessonId);
    },
    [searchParams, setSearchParams],
  );

  const selectLesson = useCallback(
    (lessonId: string) => {
      setSelectedLessonId(lessonId);
      goToView('lesson', lessonId);
    },
    [goToView],
  );

  // --- Course-level actions ---
  // Optimistic update, confirmed against the returned row; reverted on failure.
  // Returns false (and toasts the reason) when the write did not land.
  const persistCourse = useCallback(
    async (patch: Partial<BuilderCourse>): Promise<boolean> => {
      if (!course) return false;
      const previous = course;
      const dbPatch: Record<string, unknown> = { ...patch };
      if (typeof patch.published === 'boolean') Object.assign(dbPatch, publishPatch(patch.published));
      setCourse((c) => (c ? { ...c, ...patch } : c));
      const result = await updateCourse<BuilderCourse>(course.id, dbPatch);
      if (result.ok === false) {
        setCourse(previous);
        toast({ title: 'Changes not saved', description: (result as { error: string }).error, variant: 'destructive' });
        return false;
      }
      setCourse((c) => (c ? { ...c, ...patch, published: !!(result as { row: BuilderCourse }).row.published } : c));
      return true;
    },
    [course, toast],
  );

  const handleTogglePublish = useCallback(
    async (next: boolean) => {
      if (next && course) {
        const issues = publishReadinessIssues(course, modules);
        if (issues.length) {
          toast({
            title: 'Not ready to publish',
            description: issues.join(' '),
            variant: 'destructive',
          });
          return;
        }
      }
      const ok = await persistCourse({ published: next });
      if (ok) toast({ title: next ? 'Course published' : 'Course unpublished' });
    },
    [course, modules, persistCourse, toast],
  );

  const renameCourse = useCallback(
    async (title: string) => {
      await persistCourse({ title });
    },
    [persistCourse],
  );

  const handleUploadThumbnail = useCallback(
    async (file: File) => {
      if (!course) return;
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `course-thumbnails/${course.id}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from('course-materials')
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        const { data: pub } = supabase.storage.from('course-materials').getPublicUrl(path);
        const ok = await persistCourse({ image_url: pub.publicUrl, thumbnail: pub.publicUrl });
        if (ok) toast({ title: 'Thumbnail uploaded' });
      } catch (err: any) {
        toast({
          title: 'Upload failed',
          description: err.message || 'Could not upload image',
          variant: 'destructive',
        });
      }
    },
    [course, persistCourse, toast],
  );

  const handleRemoveThumbnail = useCallback(async () => {
    await persistCourse({ image_url: null, thumbnail: null });
  }, [persistCourse]);

  // --- Curriculum actions ---
  const addSection = useCallback(async () => {
    if (!courseId) return;
    try {
      const created = (await CanvasContentService.createModule(
        courseId,
        `Section ${modules.length + 1}`,
      )) as Module;
      setModules((prev) => [...prev, { ...created, items: [] }]);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [courseId, modules.length, toast]);

  const renameSection = useCallback(
    async (id: string, title: string) => {
      try {
        await CanvasContentService.updateModule(id, { title });
        setModules((prev) => prev.map((m) => (m.id === id ? { ...m, title } : m)));
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const updateSectionDescription = useCallback(
    async (id: string, description: string) => {
      try {
        await CanvasContentService.updateModule(id, { description });
        setModules((prev) => prev.map((m) => (m.id === id ? { ...m, description } : m)));
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  // The section leaves the list only after the service confirmed that exactly this row was deleted;
  // a zero-row delete (RLS-hidden or already gone) throws and the section stays.
  const deleteSection = useCallback(
    async (id: string) => {
      try {
        await CanvasContentService.deleteModule(id);
        setModules((prev) => prev.filter((m) => m.id !== id));
      } catch (err: any) {
        toast({ title: 'Section not deleted', description: err.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  // Optimistic reorder. If the RPC fails, the latest reorder in this scope puts back the order the
  // server reports (or, if that read fails too, the order it replaced). An older failure never
  // undoes a newer reorder.
  const reorderSections = useCallback(
    async (ordered: string[]) => {
      if (!courseId) return;
      const scope = 'sections';
      const seq = reorderSeq.begin(scope);
      const before = modulesRef.current.map((m) => m.id);
      setModules((prev) => applyIdOrder(prev, ordered));
      try {
        await CanvasContentService.reorderModules(courseId, ordered);
      } catch (err: any) {
        if (!reorderSeq.isLatest(scope, seq)) {
          toast({ title: 'Sections not reordered', description: err.message, variant: 'destructive' });
          return;
        }
        let serverOrder: string[] | null = null;
        try {
          serverOrder = (await CanvasContentService.getModules(courseId)).map((m) => m.id);
        } catch {
          serverOrder = null;
        }
        if (reorderSeq.isLatest(scope, seq)) {
          setModules((prev) => applyIdOrder(prev, serverOrder ?? before));
        }
        toast({
          title: 'Sections not reordered',
          description: `${err.message} ${
            serverOrder ? 'The saved order was reloaded.' : 'The previous order was restored; reload to check the saved order.'
          }`,
          variant: 'destructive',
        });
      }
    },
    [courseId, toast, reorderSeq],
  );

  const addLesson = useCallback(
    async (
      moduleId: string,
      type: ContentItemType = 'page',
      title = 'New lesson',
      content = '',
    ) => {
      if (!courseId) return;
      try {
        const created = await CanvasContentService.createContentItem({
          course_id: courseId,
          module_id: moduleId,
          type,
          title,
          content,
        });
        if (!created) throw new Error('The new lesson could not be read back after creating it.');
        setModules((prev) =>
          prev.map((m) => (m.id === moduleId ? { ...m, items: [...m.items, created] } : m)),
        );
        return created;
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [courseId, toast],
  );

  // Rename is a title edit saved on the lesson's own ordered queue: it can't race the editor's save,
  // and it is refused (no write) while that lesson has a failed, conflicted or uncertain save.
  const renameLesson = useCallback(
    async (id: string, title: string) => {
      const r = await saveQueue.rename(id, title);
      if (!r.ok) toast({ title: 'Lesson not renamed', description: r.reason, variant: 'destructive' });
    },
    [toast, saveQueue],
  );

  const deleteLesson = useCallback(
    async (id: string) => {
      try {
        // Throws on a zero-row delete, so a lesson that is still stored keeps its place and its draft.
        await CanvasContentService.deleteContentItem(id);
        saveQueue.forget(id);
        setModules((prev) =>
          prev.map((m) => ({ ...m, items: m.items.filter((i) => i.id !== id) })),
        );
        if (selectedLessonId === id) setSelectedLessonId(null);
      } catch (err: any) {
        toast({ title: 'Lesson not deleted', description: err.message, variant: 'destructive' });
      }
    },
    [selectedLessonId, toast, saveQueue],
  );

  // Publish/unpublish runs on the same per-lesson chain after any pending save, conditional on the
  // confirmed version, and is refused (no write) while the lesson has an unresolved save.
  const togglePublishLesson = useCallback(
    async (id: string, published: boolean) => {
      const r = await saveQueue.sideWrite(id, (expected) =>
        CanvasContentService.setLessonPublished(id, published, expected),
      );
      if (!r.ok) {
        toast({
          title: published ? 'Lesson not published' : 'Lesson not unpublished',
          description: r.reason,
          variant: 'destructive',
        });
        return;
      }
      const stored = !!r.row?.published;
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          items: m.items.map((i) =>
            i.id === id
              ? { ...i, published: stored, ...(r.row?.updated_at !== undefined ? { updated_at: r.row.updated_at } : {}) }
              : i,
          ),
        })),
      );
    },
    [toast, saveQueue],
  );

  // Same reconcile rule as reorderSections, scoped to one section's lessons.
  const reorderLessons = useCallback(
    async (moduleId: string, ordered: string[]) => {
      const scope = `lessons:${moduleId}`;
      const seq = reorderSeq.begin(scope);
      const before = (modulesRef.current.find((m) => m.id === moduleId)?.items ?? []).map((i) => i.id);
      const setLessonOrder = (order: string[]) =>
        setModules((prev) =>
          prev.map((m) => (m.id === moduleId ? { ...m, items: applyIdOrder(m.items, order) } : m)),
        );
      setLessonOrder(ordered);
      try {
        await CanvasContentService.reorderContentItems(moduleId, ordered);
      } catch (err: any) {
        if (!reorderSeq.isLatest(scope, seq)) {
          toast({ title: 'Lessons not reordered', description: err.message, variant: 'destructive' });
          return;
        }
        let serverOrder: string[] | null = null;
        try {
          serverOrder = (await CanvasContentService.getContentItems(moduleId)).map((i) => i.id);
        } catch {
          serverOrder = null;
        }
        if (reorderSeq.isLatest(scope, seq)) setLessonOrder(serverOrder ?? before);
        toast({
          title: 'Lessons not reordered',
          description: `${err.message} ${
            serverOrder ? 'The saved order was reloaded.' : 'The previous order was restored; reload to check the saved order.'
          }`,
          variant: 'destructive',
        });
      }
    },
    [toast, reorderSeq],
  );

  const handleAddContentTile = useCallback(
    async (type: ContentItemType, defaultTitle: string, defaultContent?: string) => {
      // Add into the module of the currently-selected lesson, or the first module
      const targetModuleId =
        modules.find((m) => m.items.some((i) => i.id === effectiveLessonId))?.id ??
        modules[0]?.id;
      if (!targetModuleId) {
        toast({
          title: 'Add a section first',
          description: 'Create a section before adding content.',
        });
        return;
      }
      const created = await addLesson(targetModuleId, type, defaultTitle, defaultContent ?? '');
      if (created) selectLesson(created.id);
    },
    [modules, effectiveLessonId, addLesson, selectLesson, toast],
  );

  // --- Derived ---
  const currentLesson: ContentItem | null = useMemo(() => {
    if (!effectiveLessonId) return null;
    for (const m of modules) {
      const it = m.items.find((i) => i.id === effectiveLessonId);
      if (it) return it;
    }
    return null;
  }, [modules, effectiveLessonId]);

  const requestedLessonMissing =
    activeView === 'lesson' && !!lessonFromUrl && !loading && !currentLesson;

  // --- Leaving the builder with unconfirmed lesson drafts ---
  // The app uses <BrowserRouter>, so router-level blocking is unavailable.
  // Intercept in-app links inside the builder (Preview, breadcrumbs, back
  // links): save first, and only navigate once every draft is confirmed;
  // otherwise ask before leaving.
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const leavingRef = useRef(false);
  const handleLinkCapture = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      if (!saveQueue.hasUnsaved()) return;
      e.preventDefault();
      e.stopPropagation();
      if (leavingRef.current) return;
      leavingRef.current = true;
      const to = `${url.pathname}${url.search}${url.hash}`;
      void saveQueue.flushAll().then((ok) => {
        leavingRef.current = false;
        if (!mountedRef.current) return;
        if (ok) navigate(to);
        else setLeaveTarget(to);
      });
    },
    [saveQueue, navigate],
  );

  const failedLessonTitles = failedLessonIds
    .filter((id) => id !== (activeView === 'lesson' ? effectiveLessonId : null))
    .map((id) => ({ id, title: saveQueue.get(id)?.draft.title || 'Untitled lesson' }));

  // --- Render ---
  if (showWizard) {
    return (
      <NewCourseWizard
        open
        onCancel={() => navigate('/admin/courses')}
        onFinish={handleWizardFinish}
      />
    );
  }

  if (loading || permissionsLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
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
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <h1 className="text-2xl font-semibold">Course not found</h1>
      </div>
    );
  }

  return (
    <div onClickCapture={handleLinkCapture} className="contents">
    <TeachableShell
      courseTitle={course.title}
      published={course.published}
      activeKey={activeView === 'lesson' ? 'curriculum' : activeView}
      onNavigate={(key) => goToView(key)}
      onTogglePublish={handleTogglePublish}
      previewHref={`/courses/${course.id}/learn`}
    >
      {failedLessonTitles.length > 0 && (
        <div
          role="alert"
          data-testid="builder-unsaved-banner"
          className="mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <strong>
            {failedLessonTitles.length === 1
              ? '1 lesson has changes that were not saved:'
              : `${failedLessonTitles.length} lessons have changes that were not saved:`}
          </strong>{' '}
          {failedLessonTitles.map((l, idx) => (
            <span key={l.id}>
              {idx > 0 && ', '}
              <button type="button" className="underline" onClick={() => selectLesson(l.id)}>
                {l.title}
              </button>
            </span>
          ))}
          . Your changes are kept; open a lesson to retry.
        </div>
      )}

      {activeView === 'setup' && (
        <SetupGuideView
          course={course}
          modules={modules}
          onGoToCurriculum={() => goToView('curriculum')}
          onSelectLesson={selectLesson}
          onRenameCourse={renameCourse}
          onUploadThumbnail={handleUploadThumbnail}
          onRemoveThumbnail={handleRemoveThumbnail}
        />
      )}

      {activeView === 'curriculum' && (
        <CurriculumView
          courseId={course.id}
          courseTitle={course.title}
          modules={modules}
          onAddModule={addSection}
          onRenameModule={renameSection}
          onUpdateModuleDescription={updateSectionDescription}
          onDeleteModule={deleteSection}
          onReorderModules={reorderSections}
          onAddLesson={(mid) => void addLesson(mid)}
          onRenameLesson={renameLesson}
          onDeleteLesson={deleteLesson}
          onTogglePublishLesson={togglePublishLesson}
          onReorderLessons={reorderLessons}
          onSelectLesson={selectLesson}
        />
      )}

      {activeView === 'lesson' && (
        <LessonEditView
          courseId={course.id}
          courseTitle={course.title}
          modules={modules}
          currentItem={currentLesson}
          onSelectLesson={selectLesson}
          saveQueue={saveQueue}
          requestedLessonMissing={requestedLessonMissing}
          onDeleteLesson={deleteLesson}
          onTogglePublishLesson={togglePublishLesson}
          onAddContent={handleAddContentTile}
        />
      )}

      {activeView === 'information' && (
        <CourseInformationView course={course} onSave={persistCourse} />
      )}

      {activeView === 'design' && (
        <CourseDesignView course={course} onSave={persistCourse} />
      )}

      {activeView === 'certificates' && (
        <CourseCertificatesView course={course} onSave={persistCourse} />
      )}

      {activeView === 'settings' && (
        <CourseSettingsView course={course} onSave={persistCourse} />
      )}

      {activeView === 'students' && (
        <StudentsView courseId={course.id} courseTitle={course.title} />
      )}

      {activeView === 'reports' && (
        <ReportsView courseId={course.id} courseTitle={course.title} />
      )}

      {activeView !== 'setup' &&
        activeView !== 'students' &&
        activeView !== 'reports' &&
        activeView !== 'curriculum' &&
        activeView !== 'lesson' &&
        activeView !== 'information' &&
        activeView !== 'design' &&
        activeView !== 'certificates' &&
        activeView !== 'settings' &&
        PLACEHOLDER_COPY[activeView as keyof typeof PLACEHOLDER_COPY] && (
          <PlaceholderView
            courseId={course.id}
            courseTitle={course.title}
            title={PLACEHOLDER_COPY[activeView as keyof typeof PLACEHOLDER_COPY].title}
            description={PLACEHOLDER_COPY[activeView as keyof typeof PLACEHOLDER_COPY].description}
          />
        )}
      <InstructorBuilderTour active={!!course?.id} />
    </TeachableShell>
    <ConfirmDialog
      open={leaveTarget !== null}
      onOpenChange={(open) => {
        if (!open) setLeaveTarget(null);
      }}
      title="Lesson changes are not saved"
      description={
        failedLessonIds.every((id) => saveQueue.get(id)?.recoverable)
          ? 'Some lesson changes could not be saved. If you leave now they stay only in this browser tab and are offered again when you reopen the builder. Stay to retry, or leave anyway.'
          : 'Some lesson changes could not be saved, and this browser tab cannot store them. If you leave now they will be lost. Stay to retry, or leave anyway.'
      }
      cancelLabel="Stay and retry"
      confirmLabel="Leave without saving"
      onConfirm={() => {
        const to = leaveTarget;
        setLeaveTarget(null);
        if (to) navigate(to);
      }}
    />
    </div>
  );
};

export default CourseBuilder;
