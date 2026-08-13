// ABOUTME: Tests for the CourseLearn player covering loading/success/error states
// ABOUTME: and that handleMarkDone awaits completion before updating the UI.
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import CanvasContentService from '@/services/canvasContentService';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import CourseLearn from '@/pages/CourseLearn';

const { mockParams, mockNavigate, mockMarkItemComplete } = vi.hoisted(() => ({
  mockParams: { courseId: 'course-1' } as {
    courseId?: string;
    moduleId?: string;
    itemId?: string;
  },
  mockNavigate: vi.fn(),
  mockMarkItemComplete: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => mockParams,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/useCourseProgress', () => ({
  useCourseProgress: vi.fn(),
}));

vi.mock('@/services/canvasContentService', () => ({
  default: {
    getModules: vi.fn(),
    getContentItems: vi.fn(),
  },
}));

vi.mock('@/hooks/useCoursePermissions', () => ({
  useCoursePermissions: () => ({ canEdit: false }),
}));

// A signed-in user is required for the progress fetch to run at all.
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({
    user: { id: 'user-1', email: 'student@example.com' },
    session: {},
    loading: false,
    error: null,
    isAuthenticated: true,
    isAdmin: false,
  }),
}));

vi.mock('@/components/onboarding/StudentLearnTour', () => ({
  StudentLearnTour: () => null,
}));

vi.mock('@/components/course/learn/LessonViewer', () => ({
  LessonViewer: () => null,
}));

// Hint needs a Radix TooltipProvider ancestor (mounted globally in App.tsx),
// which the test render tree does not include.
vi.mock('@/components/ui/hint', () => ({
  Hint: (props: { children?: React.ReactNode }) => props.children,
}));

type TableResult = { data: unknown; error: { message: string; code?: string } | null };

function tableBuilder(result: TableResult | 'pending') {
  const builder: any = {};
  for (const m of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not', 'or',
    'order', 'limit', 'filter', 'match', 'contains',
  ]) {
    builder[m] = vi.fn(() => builder);
  }
  if (result === 'pending') {
    builder.single = vi.fn(() => new Promise(() => undefined));
    builder.maybeSingle = vi.fn(() => new Promise(() => undefined));
    builder.then = () => undefined;
  } else {
    const first = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
    builder.single = vi.fn().mockResolvedValue({ data: first, error: result.error });
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: first, error: result.error });
    builder.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
  }
  return builder;
}

function mockTables(tables: Record<string, TableResult | 'pending'>) {
  (mockSupabaseClient.from as Mock).mockImplementation((table: string) =>
    tableBuilder(tables[table] ?? { data: [], error: null }),
  );
}

const courseRow = { id: 'course-1', title: 'Advanced Testing', thumbnail: null };

// jsdom does not implement scrollIntoView, which the curriculum rail calls
// to keep the active lesson in view.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

function setProgressHook(overrides: Record<string, unknown> = {}) {
  vi.mocked(useCourseProgress).mockReturnValue({
    data: { modules: [], totalItems: 2, completedItems: 0, percent: 0 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    markItemComplete: mockMarkItemComplete,
    getModulePercent: () => 0,
    ...overrides,
  } as any);
}

function setCurriculum() {
  vi.mocked(CanvasContentService.getModules).mockResolvedValue([
    { id: 'm1', title: 'Module One', published: true },
  ] as any);
  vi.mocked(CanvasContentService.getContentItems).mockResolvedValue([
    { id: 'i1', title: 'Lesson One', type: 'page', published: true },
    { id: 'i2', title: 'Lesson Two', type: 'page', published: true },
  ] as any);
}

describe('CourseLearn', () => {
  beforeEach(() => {
    mockParams.courseId = 'course-1';
    delete mockParams.moduleId;
    delete mockParams.itemId;
    mockNavigate.mockReset();
    mockMarkItemComplete.mockReset();
    setProgressHook();
    setCurriculum();
    mockTables({ courses: { data: courseRow, error: null } });
  });

  it('shows a spinner while the course is loading', () => {
    mockTables({ courses: 'pending' });
    render(<CourseLearn />);

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows the error state (not "not found") when the course fetch fails', async () => {
    mockTables({ courses: { data: null, error: { message: 'course fetch failed' } } });
    render(<CourseLearn />);

    // A backend failure must not masquerade as a missing course.
    expect(await screen.findByText("Couldn't load this course")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Course not found')).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced Testing')).not.toBeInTheDocument();
  });

  it('shows the not-found state when the course genuinely does not exist', async () => {
    mockTables({
      courses: {
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
      },
    });
    render(<CourseLearn />);

    expect(await screen.findByText('Course not found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this course")).not.toBeInTheDocument();
  });

  // REGRESSION: a failed progress fetch must not blank the checkmarks into a
  // fabricated "0 of N complete" — it surfaces a visible notice with retry.
  it('shows a progress error notice instead of fabricated zero-progress when the progress fetch fails', async () => {
    mockTables({
      courses: { data: courseRow, error: null },
      content_item_progressions: {
        data: null,
        error: { message: 'progress fetch failed' },
      },
    });
    render(<CourseLearn />);

    expect(await screen.findAllByText("Couldn't load your progress")).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // The module accordion must not claim "0 / 2 complete".
    expect(screen.getByText('Progress unavailable')).toBeInTheDocument();
    expect(screen.queryByText('0 / 2 complete')).not.toBeInTheDocument();

    // Nor may the per-row markers claim it where only a screen reader would hear
    // it: an empty circle here means "unknown", not "not started".
    expect(screen.queryByLabelText('Not started')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Progress unavailable')).not.toHaveLength(0);
  });

  it('renders the course home with curriculum on success', async () => {
    setProgressHook({
      data: { modules: [], totalItems: 2, completedItems: 1, percent: 50 },
    });
    render(<CourseLearn />);

    expect(await screen.findAllByText('Advanced Testing')).not.toHaveLength(0);
    expect(screen.getByText(/2 lessons · 50% complete/)).toBeInTheDocument();
    expect(screen.getByText('Module One')).toBeInTheDocument();
    expect(screen.getByText('Lesson One')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start course/ })).toBeInTheDocument();
  });

  // REGRESSION: the course-home accordion drew a bare filled disc for a done
  // lesson, which reads as "you are here" rather than "completed".
  it('marks completed lessons with a checkmark in the course-home accordion', async () => {
    mockTables({
      courses: { data: courseRow, error: null },
      content_item_progressions: {
        data: [{ content_item_id: 'i1', workflow_state: 'completed' }],
        error: null,
      },
    });
    render(<CourseLearn />);

    // The first section with items is expanded on load, so its rows are live.
    expect(await screen.findByText('1 / 2 complete')).toBeInTheDocument();

    // A done lesson must carry a tick, not just a filled disc.
    const done = await screen.findAllByLabelText('Completed');
    expect(done).not.toHaveLength(0);
    expect(done[0].querySelector('svg.lucide-check')).not.toBeNull();
    expect(screen.getAllByLabelText('Not started')).not.toHaveLength(0);
  });

  it('handleMarkDone awaits completion before updating the UI', async () => {
    mockParams.moduleId = 'm1';
    mockParams.itemId = 'i1';

    let resolveMark!: () => void;
    mockMarkItemComplete.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMark = resolve; }),
    );

    render(<CourseLearn />);

    // Lesson player for Lesson One with an incomplete lesson
    expect(await screen.findByRole('heading', { name: 'Lesson One' })).toBeInTheDocument();
    expect(screen.getAllByText('Complete and Continue').length).toBeGreaterThan(0);

    const [continueButton] = screen.getAllByRole('button', { name: /Complete and Continue/ });
    await userEvent.click(continueButton);

    expect(mockMarkItemComplete).toHaveBeenCalledWith('i1');
    // Completion has NOT resolved yet: the UI must still show the lesson as
    // incomplete and must not have navigated onward.
    expect(screen.getAllByText('Complete and Continue').length).toBeGreaterThan(0);
    expect(mockNavigate).not.toHaveBeenCalled();

    resolveMark();

    // Once the promise resolves, the lesson flips to complete and navigation
    // to the next lesson happens.
    await waitFor(() => {
      expect(screen.queryAllByText('Complete and Continue')).toHaveLength(0);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/courses/course-1/learn/m1/i2');
  });

  it('does not mark the lesson complete when markItemComplete rejects', async () => {
    mockParams.moduleId = 'm1';
    mockParams.itemId = 'i1';
    mockMarkItemComplete.mockRejectedValue(new Error('save failed'));

    render(<CourseLearn />);

    expect(await screen.findByRole('heading', { name: 'Lesson One' })).toBeInTheDocument();
    const [continueButton] = screen.getAllByRole('button', { name: /Complete and Continue/ });
    await userEvent.click(continueButton);

    // The completed set must not be updated on failure.
    await waitFor(() => {
      expect(mockMarkItemComplete).toHaveBeenCalledWith('i1');
    });
    expect(screen.getAllByText('Complete and Continue').length).toBeGreaterThan(0);
  });
});
