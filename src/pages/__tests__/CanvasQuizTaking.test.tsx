// Tests for the quiz-taking page: loading / success / error states plus the
// submit flow — answers must actually be written (upsert + submission update
// asserted against the supabase mock) and a failed write must surface a
// destructive toast instead of a fake success.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import CanvasContentService from '@/services/canvasContentService';
import CanvasQuizTaking from '@/pages/CanvasQuizTaking';

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
    }),
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/unified-canvas-editor', () => ({
  UnifiedCanvasEditor: ({ content, onChange, readOnly, placeholder }: any) =>
    readOnly ? (
      <div data-testid="readonly-editor">{content}</div>
    ) : (
      <textarea
        data-testid="editor"
        placeholder={placeholder}
        value={content || ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
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
    getContentItem: vi.fn(),
    getQuiz: vi.fn(),
    getQuizQuestionsForTaking: vi.fn(),
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

const quizItem = {
  id: 'item-1',
  type: 'quiz',
  title: 'Module 1 Quiz',
  content: 'Answer all questions.',
};

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
  time_limit: null,
  allowed_attempts: 3,
  points_possible: 10,
  quiz_type: 'assignment',
};

async function startQuizAndAnswer() {
  render(<CanvasQuizTaking />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Quiz' }));
  await screen.findByText('What is 2+2?');
  fireEvent.click(screen.getByRole('radio', { name: 'Four' }));
  fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
}

describe('CanvasQuizTaking', () => {
  beforeEach(() => {
    toastMock.mockReset();
    navigateMock.mockReset();
    vi.mocked(CanvasContentService.getContentItem).mockReset();
    vi.mocked(CanvasContentService.getQuiz).mockReset();
    // Questions arrive through the student-safe RPC now, not embedded on the
    // quiz row.
    vi.mocked(CanvasContentService.getQuizQuestionsForTaking).mockReset();
    (mockSupabaseClient.functions.invoke as any).mockReset();
    vi.mocked(CanvasContentService.getQuizQuestionsForTaking).mockResolvedValue([
      question,
    ] as any);
  });

  it('shows a loading spinner while the quiz loads', () => {
    vi.mocked(CanvasContentService.getContentItem).mockReturnValue(
      new Promise(() => {}) as any,
    );
    const { container } = render(<CanvasQuizTaking />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Module 1 Quiz')).not.toBeInTheDocument();
  });

  it('renders the quiz intro with question count on success', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(quizItem as any);
    vi.mocked(CanvasContentService.getQuiz).mockResolvedValue(quiz as any);
    useTables({ quiz_submissions: makeTableBuilder({ data: [], error: null }) });

    render(<CanvasQuizTaking />);

    expect(await screen.findByText('Module 1 Quiz')).toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeInTheDocument();
    expect(screen.getByText('This is a graded quiz. Your score will be recorded.')).toBeInTheDocument();
  });

  it('shows a destructive toast and an error state (not "not found") when loading fails', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockRejectedValue(
      new Error('Quiz service down'),
    );

    render(<CanvasQuizTaking />);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error loading quiz',
          description: 'Quiz service down',
          variant: 'destructive',
        }),
      ),
    );
    // Load ERROR renders the error state with retry — not the not-found copy.
    expect(await screen.findByText("Couldn't load quiz")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Quiz Not Found')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Quiz' })).not.toBeInTheDocument();
  });

  it('renders the not-found screen when the quiz genuinely does not exist', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(null as any);

    render(<CanvasQuizTaking />);

    expect(await screen.findByText('Quiz Not Found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load quiz")).not.toBeInTheDocument();
  });

  // REGRESSION: a failed existing-submission query must fail closed — no
  // "Start Quiz" button (which would allow attempts past the limit) and no
  // fabricated "0/N attempts" counter.
  it('blocks quiz start with an error state when the attempt-limit check fails', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(quizItem as any);
    vi.mocked(CanvasContentService.getQuiz).mockResolvedValue(quiz as any);
    useTables({
      quiz_submissions: makeTableBuilder({
        data: null,
        error: { message: 'attempts unavailable' },
      }),
    });

    render(<CanvasQuizTaking />);

    expect(await screen.findByText("Couldn't load quiz")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Quiz' })).not.toBeInTheDocument();
    expect(screen.queryByText('0/3')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error loading quiz',
          description: 'attempts unavailable',
          variant: 'destructive',
        }),
      ),
    );
  });

  it('submits answers: persists the answer records and completes the submission', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(quizItem as any);
    vi.mocked(CanvasContentService.getQuiz).mockResolvedValue(quiz as any);

    const answersBuilder = makeTableBuilder({ data: null, error: null });
    const quizSubsBuilder = makeTableBuilder(
      { data: [], error: null }, // existing-submission check on load
      { data: { id: 'qsub-1', attempt: 1 }, error: null }, // insert on Start Quiz
    );
    useTables({
      quiz_submissions: quizSubsBuilder,
      quiz_submission_answers: answersBuilder,
    });
    (mockSupabaseClient.functions.invoke as any).mockResolvedValue({
      data: { score: 10, pointsPossible: 10, results: [] },
      error: null,
    } as any);

    await startQuizAndAnswer();

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Quiz submitted',
          description: 'Your quiz has been submitted successfully.',
        }),
      ),
    );

    // The submission row was created for this quiz + user.
    expect(quizSubsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ quiz_id: 'quiz-1', user_id: 'user-1', attempt: 1 }),
    );
    // Grading is the server's job now: the client sends its answers to
    // score-quiz and writes neither `correct`/`points` nor the score itself.
    expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
      'score-quiz',
      expect.objectContaining({
        body: expect.objectContaining({
          submissionId: 'qsub-1',
          answers: { q1: 'a1' },
        }),
      }),
    );
    expect(answersBuilder.upsert).not.toHaveBeenCalled();
    expect(quizSubsBuilder.update).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith(
      '/courses/course-1/modules/module-1/quizzes/item-1/results/qsub-1',
    );
  });

  it('shows a destructive toast and no fake success when the submit write fails', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(quizItem as any);
    vi.mocked(CanvasContentService.getQuiz).mockResolvedValue(quiz as any);

    useTables({
      quiz_submissions: makeTableBuilder(
        { data: [], error: null },
        { data: { id: 'qsub-1', attempt: 1 }, error: null },
      ),
      quiz_submission_answers: makeTableBuilder({ data: null, error: null }),
    });
    // A scoring failure must surface, not be swallowed into a fake success.
    (mockSupabaseClient.functions.invoke as any).mockResolvedValue({
      data: null,
      error: new Error('Insert failed'),
    } as any);

    await startQuizAndAnswer();

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error submitting quiz',
          description: 'Insert failed',
          variant: 'destructive',
        }),
      ),
    );
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Quiz submitted' }),
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
