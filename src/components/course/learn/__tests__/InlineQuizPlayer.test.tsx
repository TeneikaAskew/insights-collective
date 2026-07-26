// Tests for the inline quiz player: the regression that a failed
// prior-attempt lookup fails CLOSED — an error state with retry, not a
// player that believes there is no prior attempt (which would allow starting
// attempts past the limit).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeQuizSubmission } from '@/test/utils/course-fixtures';
import { InlineQuizPlayer } from '@/components/course/learn/InlineQuizPlayer';

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
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

const item = { id: 'item-1', title: 'Module 1 Quiz', type: 'quiz' } as any;

const quiz = {
  id: 'quiz-1',
  allowed_attempts: 2,
  time_limit: null,
  questions: [
    {
      id: 'q1',
      question_type: 'multiple_choice',
      question_text: 'What is 2+2?',
      points: 10,
      position: 1,
      answers: [
        { id: 'a1', text: 'Four', correct: true },
        { id: 'a2', text: 'Three', correct: false },
      ],
    },
  ],
} as any;

describe('InlineQuizPlayer', () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  it('renders the first question when there is no prior submission', async () => {
    useTables({
      quiz_submissions: makeTableBuilder({ data: [], error: null }),
    });

    render(<InlineQuizPlayer item={item} quiz={quiz} />);

    expect(await screen.findByText('What is 2+2?')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Four' })).toBeInTheDocument();
  });

  // SECURITY: grading is server-side. The player must submit its answers to
  // the score-quiz function and must never compute or write a score itself.
  it('submits answers for server-side scoring instead of grading in the browser', async () => {
    // 1st call: prior-attempt lookup (none). 2nd: the insert that starts this
    // attempt. 3rd+: any subsequent write.
    // 1st call: prior-attempt lookup (none). Every call after that resolves to
    // the submission row (the builder repeats its last result).
    const submissionsBuilder = makeTableBuilder(
      { data: [], error: null },
      { data: makeQuizSubmission({ id: 'sub-1', attempt: 1, workflow_state: 'pending_review' }), error: null },
    );
    const answersBuilder = makeTableBuilder({ data: [], error: null });
    useTables({
      quiz_submissions: submissionsBuilder,
      quiz_submission_answers: answersBuilder,
    });
    (mockSupabaseClient.functions.invoke as any).mockResolvedValue({
      data: { score: 1, pointsPossible: 1, results: [] },
      error: null,
    });

    render(<InlineQuizPlayer item={item} quiz={quiz} />);
    await screen.findByText('What is 2+2?');
    fireEvent.click(screen.getByRole('radio', { name: 'Four' }));
    // Answering starts the attempt; wait for it before submitting, otherwise
    // ensureSubmission is still in flight and submit no-ops.
    await waitFor(() => expect(submissionsBuilder.insert).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
        'score-quiz',
        expect.objectContaining({
          body: expect.objectContaining({ answers: expect.any(Object) }),
        }),
      );
    });

    // The browser neither writes graded answer rows nor a score of its own.
    expect(answersBuilder.upsert).not.toHaveBeenCalled();
    const scoreWrites = (submissionsBuilder.update as any).mock.calls.filter(
      ([payload]: any[]) => payload && ('score' in payload || 'kept_score' in payload),
    );
    expect(scoreWrites).toHaveLength(0);
  });

  // REGRESSION: a failed prior-attempt lookup must fail CLOSED — no
  // questions, no way to start (and thus insert) a fresh attempt.
  it('shows an error state and blocks the quiz when the prior-attempt lookup fails', async () => {
    const submissionsBuilder = makeTableBuilder({
      data: null,
      error: { message: 'attempts unavailable' },
    });
    useTables({ quiz_submissions: submissionsBuilder });

    render(<InlineQuizPlayer item={item} quiz={quiz} />);

    expect(
      await screen.findByText("Couldn't load your quiz attempts"),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // No question UI: answering (which would create a new attempt) is blocked.
    expect(screen.queryByText('What is 2+2?')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Four' })).not.toBeInTheDocument();
    expect(submissionsBuilder.insert).not.toHaveBeenCalled();
  });

  it('recovers via retry and enforces the attempt limit from the reloaded data', async () => {
    const submissionsBuilder = makeTableBuilder(
      { data: null, error: { message: 'attempts unavailable' } },
      {
        data: [
          makeQuizSubmission({ quiz_id: 'quiz-1', attempt: 2, workflow_state: 'pending_review' }),
        ],
        error: null,
      },
    );
    useTables({ quiz_submissions: submissionsBuilder });

    render(<InlineQuizPlayer item={item} quiz={quiz} />);

    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));

    // Attempt 2 of 2 used: the player must show the out-of-attempts state.
    expect(
      await screen.findByText('You have used all available attempts for this quiz.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("Couldn't load your quiz attempts"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('What is 2+2?')).not.toBeInTheDocument();
  });
});
