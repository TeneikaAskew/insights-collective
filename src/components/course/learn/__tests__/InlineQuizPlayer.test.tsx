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
