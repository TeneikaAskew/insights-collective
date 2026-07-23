// ABOUTME: Tests for the CourseBuilder page shell — loading, permission-denied,
// ABOUTME: loaded-course, and load-error states with all heavy views stubbed.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import CourseBuilder from '../CourseBuilder';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import CanvasContentService from '@/services/canvasContentService';
import { mockSupabaseClient } from '@/test/mocks/supabase';

const toastSpy = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: 'course-1' }),
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
  toast: toastSpy,
}));

vi.mock('@/hooks/useCoursePermissions', () => ({
  useCoursePermissions: vi.fn(),
}));

vi.mock('@/services/canvasContentService', () => ({
  default: {
    getModules: vi.fn(),
    getContentItems: vi.fn(),
    createModule: vi.fn(),
    updateModule: vi.fn(),
    deleteModule: vi.fn(),
    reorderModules: vi.fn(),
    createContentItem: vi.fn(),
    updateContentItem: vi.fn(),
    deleteContentItem: vi.fn(),
    reorderContentItems: vi.fn(),
  },
}));

// Stub every heavy builder view — these have their own tests.
vi.mock('@/components/course/builder/teachable/TeachableShell', () => ({
  TeachableShell: ({ courseTitle, published, children }: any) => (
    <div data-testid="teachable-shell">
      <span data-testid="shell-title">{courseTitle}</span>
      <span data-testid="shell-published">{String(published)}</span>
      {children}
    </div>
  ),
}));
vi.mock('@/components/course/builder/teachable/SetupGuideView', () => ({
  SetupGuideView: ({ course, modules }: any) => (
    <div data-testid="setup-guide-view">
      {course.title} / {modules.length} sections
    </div>
  ),
}));
vi.mock('@/components/course/builder/teachable/CurriculumView', () => ({
  CurriculumView: () => <div data-testid="curriculum-view" />,
}));
vi.mock('@/components/course/builder/teachable/LessonEditView', () => ({
  LessonEditView: () => <div data-testid="lesson-edit-view" />,
}));
vi.mock('@/components/course/builder/teachable/PlaceholderView', () => ({
  PlaceholderView: () => <div data-testid="placeholder-view" />,
}));
vi.mock('@/components/course/builder/teachable/CourseInformationView', () => ({
  CourseInformationView: () => <div data-testid="course-information-view" />,
}));
vi.mock('@/components/course/builder/teachable/CourseDesignView', () => ({
  CourseDesignView: () => <div data-testid="course-design-view" />,
}));
vi.mock('@/components/course/builder/teachable/CourseCertificatesView', () => ({
  CourseCertificatesView: () => <div data-testid="course-certificates-view" />,
}));
vi.mock('@/components/course/builder/teachable/NewCourseWizard', () => ({
  NewCourseWizard: () => <div data-testid="new-course-wizard" />,
}));
vi.mock('@/components/onboarding/InstructorBuilderTour', () => ({
  InstructorBuilderTour: () => null,
}));

// Chainable, awaitable query builder resolving to `result`.
function tableResult(result: any) {
  const builder: any = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

function pendingTable() {
  const builder = tableResult({ data: null, error: null });
  builder.single = vi.fn(() => new Promise(() => undefined));
  builder.then = () => new Promise(() => undefined);
  return builder;
}

function wireTables(tables: Record<string, any>) {
  (mockSupabaseClient.from as any).mockImplementation(
    (table: string) => tables[table] ?? tableResult({ data: [], error: null }),
  );
}

const courseRow = {
  id: 'course-1',
  title: 'Intro to Data Analytics',
  description: 'Learn the basics.',
  thumbnail: null,
  image_url: null,
  published: false,
  category: 'Data',
  level: 'Beginner',
  tags: [],
  duration: 8,
  estimated_hours: null,
  difficulty_level: null,
  settings: null,
};

function setPermissions({ canEdit = true, loading = false } = {}) {
  vi.mocked(useCoursePermissions).mockReturnValue({
    canEdit,
    isInstructor: canEdit,
    isAdmin: false,
    loading,
    error: null,
  } as any);
}

describe('CourseBuilder', () => {
  beforeEach(() => {
    toastSpy.mockClear();
    setPermissions();
    vi.mocked(CanvasContentService.getModules).mockResolvedValue([] as any);
    vi.mocked(CanvasContentService.getContentItems).mockResolvedValue([] as any);
  });

  it('shows a spinner while permissions and course data load', () => {
    setPermissions({ canEdit: false, loading: true });
    wireTables({ courses: pendingTable() });

    render(<CourseBuilder />);

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('teachable-shell')).not.toBeInTheDocument();
  });

  it('shows the permission-denied state when the user cannot edit the course', async () => {
    setPermissions({ canEdit: false });
    wireTables({ courses: tableResult({ data: courseRow, error: null }) });

    render(<CourseBuilder />);

    await waitFor(() => {
      expect(screen.getByText('Not authorized')).toBeInTheDocument();
    });
    expect(
      screen.getByText("You don't have permission to edit this course."),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to courses' })).toHaveAttribute(
      'href',
      '/courses',
    );
    expect(screen.queryByTestId('teachable-shell')).not.toBeInTheDocument();
  });

  it('renders the builder shell with the loaded course and curriculum', async () => {
    wireTables({ courses: tableResult({ data: courseRow, error: null }) });
    vi.mocked(CanvasContentService.getModules).mockResolvedValue([
      { id: 'm1', title: 'Section 1' },
    ] as any);
    vi.mocked(CanvasContentService.getContentItems).mockResolvedValue([
      { id: 'i1', title: 'Lesson 1', type: 'page' },
    ] as any);

    render(<CourseBuilder />);

    await waitFor(() => {
      expect(screen.getByTestId('teachable-shell')).toBeInTheDocument();
    });
    expect(screen.getByTestId('shell-title')).toHaveTextContent('Intro to Data Analytics');
    expect(screen.getByTestId('shell-published')).toHaveTextContent('false');
    // Default view is the setup guide, fed with the loaded modules
    expect(screen.getByTestId('setup-guide-view')).toHaveTextContent(
      'Intro to Data Analytics / 1 sections',
    );
    expect(CanvasContentService.getModules).toHaveBeenCalledWith('course-1');
    expect(CanvasContentService.getContentItems).toHaveBeenCalledWith('m1');
  });

  it('shows a destructive toast and "Course not found" when the load fails', async () => {
    wireTables({
      courses: tableResult({ data: null, error: { message: 'db exploded', code: 'PGRST000' } }),
    });

    render(<CourseBuilder />);

    await waitFor(() => {
      expect(screen.getByText('Course not found')).toBeInTheDocument();
    });
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'db exploded',
        variant: 'destructive',
      }),
    );
    expect(screen.queryByTestId('teachable-shell')).not.toBeInTheDocument();
  });
});
