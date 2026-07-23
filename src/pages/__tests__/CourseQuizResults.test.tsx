// ABOUTME: Tests for the CourseQuizResults page — loading, per-module quiz stats
// ABOUTME: for instructors, empty course, and query failure.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import CourseQuizResults from '../CourseQuizResults';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { mockSupabaseClient } from '@/test/mocks/supabase';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: 'course-1' }),
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="course-layout">{children}</div>
  ),
}));

vi.mock('@/hooks/useCoursePermissions', () => ({
  useCoursePermissions: vi.fn(),
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
  builder.then = () => new Promise(() => undefined);
  return builder;
}

function wireTables(tables: Record<string, any>) {
  (mockSupabaseClient.from as any).mockImplementation(
    (table: string) => tables[table] ?? tableResult({ data: [], error: null }),
  );
}

describe('CourseQuizResults', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'instructor-1' },
      session: null,
      loading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      googleSignIn: vi.fn(),
      githubSignIn: vi.fn(),
      twitterSignIn: vi.fn(),
      isAuthenticated: true,
      isAdmin: false,
      isAdminAuthenticated: false,
      storeRedirectPath: vi.fn(),
      handleRedirectAfterLogin: vi.fn(),
    } as any);
    vi.mocked(useCoursePermissions).mockReturnValue({
      canEdit: true,
      isInstructor: true,
      isAdmin: false,
      loading: false,
      error: null,
    } as any);
  });

  it('shows a loading state while data loads', () => {
    wireTables({ modules: pendingTable() });

    render(<CourseQuizResults />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders per-module quiz stats for instructors on success', async () => {
    wireTables({
      modules: tableResult({
        data: [{ id: 'm1', title: 'Intro Week', week: 1, position: 1 }],
        error: null,
      }),
      quizzes: tableResult({
        data: [{ id: 'q1', title: 'Quiz 1: Basics', points_possible: 10, module_id: 'm1' }],
        error: null,
      }),
      quiz_submissions: tableResult({
        data: [
          {
            quiz_id: 'q1',
            user_id: 'student-1',
            score: 8,
            kept_score: 8,
            attempt: 1,
            workflow_state: 'complete',
            finished_at: '2026-01-11T00:00:00Z',
          },
        ],
        error: null,
      }),
      profiles: tableResult({
        data: [{ id: 'student-1', full_name: 'Ada Lovelace', email: 'ada@example.com' }],
        error: null,
      }),
    });

    render(<CourseQuizResults />);

    await waitFor(() => {
      expect(screen.getByText('Quiz 1: Basics')).toBeInTheDocument();
    });
    expect(screen.getByText(/Intro Week/)).toBeInTheDocument();
    expect(screen.getByText('10 pts possible')).toBeInTheDocument();
    expect(screen.getByText('1 students completed')).toBeInTheDocument();
    expect(screen.getByText('Class avg: 8.0 / 10')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Class scores across every module.')).toBeInTheDocument();
  });

  it('shows the empty state when the course has no quizzes', async () => {
    wireTables({
      modules: tableResult({ data: [], error: null }),
    });

    render(<CourseQuizResults />);

    await waitFor(() => {
      expect(screen.getByText('This course has no quizzes yet.')).toBeInTheDocument();
    });
  });

  it('shows an error state, not the no-quizzes copy, when the modules query fails', async () => {
    wireTables({
      modules: tableResult({
        data: null,
        error: { message: 'connection refused', code: 'PGRST000' },
      }),
    });

    render(<CourseQuizResults />);

    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Failed to load quiz results')).toBeInTheDocument();
    expect(screen.getByText('connection refused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('This course has no quizzes yet.')).not.toBeInTheDocument();
  });
});
