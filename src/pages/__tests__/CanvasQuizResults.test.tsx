// Tests for the quiz results page: loading / success (scores shown) /
// error (destructive toast + not-found screen) / empty (no answers) states.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeQuizSubmission } from '@/test/utils/course-fixtures';
import CanvasContentService from '@/services/canvasContentService';
import CanvasQuizResults from '@/pages/CanvasQuizResults';

const { toastMock, navigateMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({
      courseId: 'course-1',
      moduleId: 'module-1',
      contentItemId: 'item-1',
      submissionId: 'qsub-1',
    }),
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/unified-canvas-editor', () => ({
  UnifiedCanvasEditor: ({ content, readOnly }: any) => (
    <div data-testid={readOnly ? 'readonly-editor' : 'editor'}>{content}</div>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

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

vi.mock('@/services/canvasContentService', () => ({
  default: {
    getQuiz: vi.fn(),
  },
}));

// --- supabase query-builder helper (see CanvasGradingInterface.test.tsx) ----
type TableResult = { data: unknown; error: unknown } | Error | Promise<unknown>;

function makeTableBuilder(...results: TableResult[]) {
  let call = 0;
  const builder: any = {};
  for (const m of [
    'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'in', 'is',
    'order', 'limit', 'range', 'single', 'maybeSingle', 'filter', 'or', 'not',
    'match', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
  ]) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (onFulfilled: any, onRejected: any) => {
    const r =
      results.length === 0
        ? { data: null, error: null }
        : results[Math.min(call++, results.length - 1)];
    const p = r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    return p.then(onFulfilled, onRejected);
  };
  return builder;
}

function useTables(tables: Record<string, any>) {
  (mockSupabaseClient.from as any).mockImplementation(
    (table: string) => tables[table] ?? makeTableBuilder(),
  );
  return tables;
}
// ---------------------------------------------------------------------------

const question = {
  id: 'q1',
  question_type: 'multiple_choice',
  question_text: 'What is 2+2?',
  points: 10,
  answers: [
    { id: 'a1', text: 'Four', correct: true },
    { id: 'a2', text: 'Three', correct: false },
  ],
};

const quiz = {
  id: 'quiz-1',
  points_possible: 10,
  allowed_attempts: 3,
  show_correct_answers: true,
  questions: [question],
};

function submissionRow(overrides: Record<string, unknown> = {}) {
  return {
    ...makeQuizSubmission({
      id: 'qsub-1',
      quiz_id: 'quiz-1',
      score: 8,
      kept_score: 8,
      attempt: 1,
      time_spent: 65,
      finished_at: '2026-01-11T00:00:00Z',
      started_at: '2026-01-11T00:00:00Z',
    }),
    quiz_submission_answers: [
      { quiz_question_id: 'q1', answer_data: { answer: 'a1' }, correct: true, points: 8 },
    ],
    ...overrides,
  };
}

describe('CanvasQuizResults', () => {
  beforeEach(() => {
    toastMock.mockReset();
    navigateMock.mockReset();
    vi.mocked(CanvasContentService.getQuiz).mockReset();
  });

  it('shows a loading spinner while results load', () => {
    useTables({
      quiz_submissions: makeTableBuilder(new Promise(() => {}) as Promise<unknown>),
    });
    const { container } = render(<CanvasQuizResults />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText(/results/i)).not.toBeInTheDocument();
  });

  it('renders scores, percentage, and pass badge on success', async () => {
    vi.mocked(CanvasContentService.getQuiz).mockResolvedValue(quiz as any);
    useTables({
      quiz_submissions: makeTableBuilder({ data: submissionRow(), error: null }),
      content_items: makeTableBuilder({
        data: { id: 'item-1', title: 'Module 1 Quiz' },
        error: null,
      }),
    });

    render(<CanvasQuizResults />);

    expect(await screen.findByText('Module 1 Quiz - Results')).toBeInTheDocument();
    expect(screen.getByText('8/10')).toBeInTheDocument();
    expect(screen.getAllByText('80.0%').length).toBeGreaterThan(0);
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Attempt 1 of 3')).toBeInTheDocument();
    // 1 correct answer out of 1 question
    expect(screen.getByText('1/1')).toBeInTheDocument();
    // Time spent 65s -> 1:05
    expect(screen.getByText('1:05')).toBeInTheDocument();
  });

  it('shows a destructive toast and a not-found screen when loading fails', async () => {
    vi.mocked(CanvasContentService.getQuiz).mockResolvedValue(quiz as any);
    useTables({
      quiz_submissions: makeTableBuilder({
        data: null,
        error: { message: 'Database unavailable' },
      }),
    });

    render(<CanvasQuizResults />);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error loading quiz results',
          description: 'Database unavailable',
          variant: 'destructive',
        }),
      ),
    );
    expect(await screen.findByText('Quiz Results Not Found')).toBeInTheDocument();
    expect(screen.queryByText(/passed/i)).not.toBeInTheDocument();
  });

  it('renders zeroed results when the submission has no answers', async () => {
    vi.mocked(CanvasContentService.getQuiz).mockResolvedValue({
      ...quiz,
      questions: [],
    } as any);
    useTables({
      quiz_submissions: makeTableBuilder({
        data: submissionRow({
          score: 0,
          kept_score: 0,
          time_spent: 0,
          quiz_submission_answers: [],
        }),
        error: null,
      }),
      content_items: makeTableBuilder({
        data: { id: 'item-1', title: 'Module 1 Quiz' },
        error: null,
      }),
    });

    render(<CanvasQuizResults />);

    expect(await screen.findByText('Module 1 Quiz - Results')).toBeInTheDocument();
    expect(screen.getByText('0/10')).toBeInTheDocument();
    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getAllByText('0.0%').length).toBeGreaterThan(0);
  });
});
