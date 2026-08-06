// ABOUTME: Instructor course builder — Teachable-mirrored shell with Setup guide, Curriculum, and Lesson views.
// ABOUTME: Handles the new-course 5-step wizard and orchestrates all lesson/section CRUD.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import type { ContentItem, ContentItemType, Module } from '@/types/canvas';
import { createLogger } from '@/utils/logger';
import { TeachableShell, type BuilderNavKey } from '@/components/course/builder/teachable/TeachableShell';
import { SetupGuideView } from '@/components/course/builder/teachable/SetupGuideView';
import { CurriculumView } from '@/components/course/builder/teachable/CurriculumView';
import { LessonEditView } from '@/components/course/builder/teachable/LessonEditView';
import { PlaceholderView } from '@/components/course/builder/teachable/PlaceholderView';
import { CourseInformationView } from '@/components/course/builder/teachable/CourseInformationView';
import { CourseDesignView } from '@/components/course/builder/teachable/CourseDesignView';
import { CourseCertificatesView } from '@/components/course/builder/teachable/CourseCertificatesView';
import { CourseSettingsView } from '@/components/course/builder/teachable/CourseSettingsView';
import { InstructorBuilderTour } from '@/components/onboarding/InstructorBuilderTour';
import {
  NewCourseWizard,
  type NewCourseWizardResult,
} from '@/components/course/builder/teachable/NewCourseWizard';
import type { BuilderCourse, BuilderModule } from '@/components/course/builder/teachable/types';
import type { LessonDraft } from '@/components/course/builder/LessonEditorPane';

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

  const [course, setCourse] = useState<BuilderCourse | null>(null);
  const [modules, setModules] = useState<BuilderModule[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [showWizard, setShowWizard] = useState(isNew);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const activeView: BuilderNavKey = (searchParams.get('view') as BuilderNavKey) || 'setup';
  const lessonFromUrl = searchParams.get('lesson');
  const effectiveLessonId = selectedLessonId || lessonFromUrl;

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
        const firstItem = withItems.flatMap((m) => m.items)[0];
        if (firstItem) setSelectedLessonId(firstItem.id);
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

        // 1) Upload thumbnail first (if provided)
        let thumbnailUrl: string | null = null;
        if (r.thumbnailFile && instructorId) {
          setStep('thumbnail', 'running');
          const ext = r.thumbnailFile.name.split('.').pop() || 'jpg';
          const path = `course-thumbnails/${instructorId}-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('course-materials')
            .upload(path, r.thumbnailFile, {
              upsert: true,
              contentType: r.thumbnailFile.type,
            });
          if (uploadError) {
            logger.error('Thumbnail upload failed', uploadError);
            // Do not block course creation on thumbnail failure — surface it
            // as a non-fatal step error so the user sees what happened.
            setStep(
              'thumbnail',
              'error',
              `${uploadError.message || 'Upload failed'} — continuing without a thumbnail. You can add one later in Setup.`,
            );
          } else {
            const { data: pub } = supabase.storage
              .from('course-materials')
              .getPublicUrl(path);
            thumbnailUrl = pub.publicUrl;
            setStep('thumbnail', 'done');
          }
        }

        // 2) Create the course
        setStep('course', 'running');
        const { data: created, error } = await supabase
          .from('courses')
          .insert({
            title: r.title,
            description: r.description || '',
            category: 'General',
            level: 'beginner',
            published: false,
            status: 'draft',
            instructor_id: instructorId,
            ...(thumbnailUrl ? { image_url: thumbnailUrl, thumbnail: thumbnailUrl } : {}),
          })
          .select('id')
          .single();
        if (error) {
          setStep('course', 'error', error.message);
          throw error;
        }
        setStep('course', 'done');

        // 3) Seed curriculum from the wizard outline
        if (outline.length > 0) {
          setStep('curriculum', 'running', '0 of ' + totalLessons + ' lessons');
          let done = 0;
          for (const section of outline) {
            const mod = await CanvasContentService.createModule(created.id, section.title);
            for (const lesson of section.lessons) {
              await CanvasContentService.createContentItem({
                course_id: created.id,
                module_id: mod.id,
                type: lesson.type,
                title: lesson.title,
                content: '',
              });
              done += 1;
              setStep('curriculum', 'running', `${done} of ${totalLessons} lessons`);
            }
          }
          setStep('curriculum', 'done', `${totalLessons} lesson${totalLessons === 1 ? '' : 's'} created`);
        }

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
  const persistCourse = useCallback(
    async (patch: Partial<BuilderCourse>) => {
      if (!course) return;
      setCourse((c) => (c ? { ...c, ...patch } : c));
      try {
        await supabase
          .from('courses')
          .update({ ...patch, updated_at: new Date().toISOString() } as any)
          .eq('id', course.id);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [course, toast],
  );

  const handleTogglePublish = useCallback(
    async (next: boolean) => {
      await persistCourse({ published: next });
      toast({ title: next ? 'Course published' : 'Course unpublished' });
    },
    [persistCourse, toast],
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
        await persistCourse({ image_url: pub.publicUrl, thumbnail: pub.publicUrl });
        toast({ title: 'Thumbnail uploaded' });
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

  const deleteSection = useCallback(
    async (id: string) => {
      try {
        await CanvasContentService.deleteModule(id);
        setModules((prev) => prev.filter((m) => m.id !== id));
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const reorderSections = useCallback(
    async (ordered: string[]) => {
      if (!courseId) return;
      setModules((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m] as const));
        return ordered.map((id) => byId.get(id) as BuilderModule);
      });
      try {
        await CanvasContentService.reorderModules(courseId, ordered);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [courseId, toast],
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

  const renameLesson = useCallback(
    async (id: string, title: string) => {
      try {
        await CanvasContentService.updateContentItem(id, { title });
        setModules((prev) =>
          prev.map((m) => ({
            ...m,
            items: m.items.map((i) => (i.id === id ? { ...i, title } : i)),
          })),
        );
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const deleteLesson = useCallback(
    async (id: string) => {
      try {
        await CanvasContentService.deleteContentItem(id);
        setModules((prev) =>
          prev.map((m) => ({ ...m, items: m.items.filter((i) => i.id !== id) })),
        );
        if (selectedLessonId === id) setSelectedLessonId(null);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [selectedLessonId, toast],
  );

  const togglePublishLesson = useCallback(
    async (id: string, published: boolean) => {
      try {
        await CanvasContentService.updateContentItem(id, { published } as any);
        setModules((prev) =>
          prev.map((m) => ({
            ...m,
            items: m.items.map((i) => (i.id === id ? { ...i, published } : i)),
          })),
        );
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const reorderLessons = useCallback(
    async (moduleId: string, ordered: string[]) => {
      setModules((prev) =>
        prev.map((m) => {
          if (m.id !== moduleId) return m;
          const byId = new Map(m.items.map((i) => [i.id, i] as const));
          return { ...m, items: ordered.map((id) => byId.get(id) as ContentItem) };
        }),
      );
      try {
        await CanvasContentService.reorderContentItems(moduleId, ordered);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const saveLesson = useCallback(
    async (id: string, draft: LessonDraft) => {
      try {
        await CanvasContentService.updateContentItem(id, {
          title: draft.title,
          type: draft.type,
          content: draft.content,
        } as any);
        setModules((prev) =>
          prev.map((m) => ({
            ...m,
            items: m.items.map((i) =>
              i.id === id
                ? { ...i, title: draft.title, type: draft.type, content: draft.content }
                : i,
            ),
          })),
        );
      } catch (err: any) {
        toast({
          title: 'Error saving lesson',
          description: err.message,
          variant: 'destructive',
        });
      }
    },
    [toast],
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
    <TeachableShell
      courseTitle={course.title}
      published={course.published}
      activeKey={activeView === 'lesson' ? 'curriculum' : activeView}
      onNavigate={(key) => goToView(key)}
      onTogglePublish={handleTogglePublish}
      previewHref={`/courses/${course.id}/learn`}
    >
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
          onSaveLesson={saveLesson}
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

      {activeView !== 'setup' &&
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
  );
};

export default CourseBuilder;
