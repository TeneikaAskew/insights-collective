// ABOUTME: Tests for the CourseProgress page (wrapper over CourseProgressOverview /
// ABOUTME: useCourseProgress) covering unauthenticated, loading, success, empty, and error states.
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import { useAuth } from '@/contexts/AuthContext';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import CourseProgress from '@/pages/CourseProgress';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: 'course-1' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/hooks/useCourseProgress', () => ({
  useCourseProgress: vi.fn(),
}));

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: (props: { children?: React.ReactNode }) => props.children,
}));

// ModuleProgressCard has its own data fetching; out of scope here.
vi.mock('@/components/course/ModuleProgressCard', () => ({
  ModuleProgressCard: () => null,
}));

type TableResult = { data: unknown; error: { message: string } | null };

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

const courseRow = {
  id: 'course-1',
  title: 'Intro to Data Analytics',
  modules: [
    {
      id: 'm1',
      title: 'Module 1',
      description: 'First module',
      order_index: 1,
      unlock_at: null,
      prerequisites_met: true,
    },
  ],
};

function setProgressHook(overrides: Record<string, unknown> = {}) {
  vi.mocked(useCourseProgress).mockReturnValue({
    data: {
      modules: [{ moduleId: 'm1', totalItems: 2, completedItems: 1, percent: 50 }],
      totalItems: 2,
      completedItems: 1,
      percent: 50,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    markItemComplete: vi.fn(),
    getModulePercent: () => 50,
    ...overrides,
  } as any);
}

const successTables = (): Record<string, TableResult> => ({
  courses: { data: courseRow, error: null },
  modules: { data: [{ id: 'm1' }], error: null },
  content_items: { data: [{ id: 'i1', type: 'page' }, { id: 'i2', type: 'page' }], error: null },
  content_item_progressions: { data: [{ content_item_id: 'i1', workflow_state: 'completed' }], error: null },
  // The average grade comes from real graded assignment submissions — the
  // nonexistent `grades` table is no longer queried.
  assignments: { data: [{ id: 'a1', points: 100 }], error: null },
  assignment_submissions: { data: [{ assignment_id: 'a1', grade: 90 }], error: null },
});

describe('CourseProgress', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({
        user: { id: 'student-1', email: 'student@example.com' },
        isAuthenticated: true,
      }) as any,
    );
    (mockSupabaseClient.rpc as Mock).mockResolvedValue({ data: false, error: null });
    setProgressHook();
    mockTables(successTables());
  });

  it('asks the user to log in when unauthenticated', () => {
    vi.mocked(useAuth).mockReturnValue(createMockAuthProvider() as any);
    render(<CourseProgress />);

    expect(
      screen.getByText('Please log in to view your course progress.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Overall Progress')).not.toBeInTheDocument();
  });

  it('shows the loading skeleton while progress is loading', () => {
    setProgressHook({ data: undefined, isLoading: true });
    const { container } = render(<CourseProgress />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('Overall Progress')).not.toBeInTheDocument();
  });

  it('renders real progress data on success', async () => {
    render(<CourseProgress />);

    expect(await screen.findByText('Overall Progress')).toBeInTheDocument();
    expect(screen.getByText('Intro to Data Analytics')).toBeInTheDocument();
    // percent comes straight from the hook
    expect(screen.getByText('50%')).toBeInTheDocument();
    // lessons breakdown: 1 of 2 published pages completed
    expect(screen.getByText('1 of 2 completed')).toBeInTheDocument();
    // real average grade
    expect(screen.getByText('90.0%')).toBeInTheDocument();
  });

  it('renders a distinct empty state when there is no progress yet', async () => {
    setProgressHook({
      data: { modules: [], totalItems: 0, completedItems: 0, percent: 0 },
    });
    mockTables({
      courses: { data: { ...courseRow, modules: [] }, error: null },
      modules: { data: [], error: null },
      content_items: { data: [], error: null },
      content_item_progressions: { data: [], error: null },
      assignments: { data: [], error: null },
      assignment_submissions: { data: [], error: null },
    });
    render(<CourseProgress />);

    expect(await screen.findByText('Overall Progress')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
    expect(
      screen.getByText('Complete all modules to earn your certificate'),
    ).toBeInTheDocument();
  });

  it('does not fabricate progress data when the hook errors', async () => {
    // CourseProgressOverview now renders a dedicated error state (with retry)
    // instead of falling back to the loading skeleton forever. A failed
    // progress fetch must never render fabricated numbers or the success view.
    setProgressHook({
      data: undefined,
      isLoading: false,
      error: 'Failed to load course progress',
    });
    const { container } = render(<CourseProgress />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Failed to load course progress').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(screen.queryByText('Overall Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText(/Congratulations/)).not.toBeInTheDocument();
  });
});
