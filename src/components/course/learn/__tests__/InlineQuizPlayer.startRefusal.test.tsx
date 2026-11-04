// ABOUTME: Definite start refusal (T-62 follow-up to #141): a confirmed refused FIRST start blocks the questions with an
// ABOUTME: honest error and Retry, stores nothing, reports no progress; a refused retake keeps the result. MOCK backend only.
//
// These run against the in-memory MOCK (quizServerFake.ts): client contract only, not backend acceptance.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { InlineQuizPlayer } from '@/components/course/learn/InlineQuizPlayer';
import { createQuizServer, gate } from './quizServerFake';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

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

function makeQuiz(id: string, allowed: number | null, extra: Record<string, unknown> = {}) {
  return {
    id,
    allowed_attempts: allowed,
    time_limit: null,
    questions: [
      {
        id: `${id}-q1`,
        question_type: 'multiple_choice',
        question_text: `${id}: What is 2+2?`,
        points: 1,
        position: 1,
        answers: [
          { id: `${id}-a1`, text: 'Four' },
          { id: `${id}-a2`, text: 'Three' },
        ],
      },
      {
        id: `${id}-q2`,
        question_type: 'true_false',
        question_text: `${id}: The sky is green.`,
        points: 1,
        position: 2,
        answers: [
          { id: `${id}-t`, text: 'True' },
          { id: `${id}-f`, text: 'False' },
        ],
      },
    ],
    ...extra,
  } as any;
}

function serverQuiz(id: string, allowed: number | null) {
  return {
    id,
    allowed_attempts: allowed,
    questions: [
      { id: `${id}-q1`, points: 1, key: `${id}-a1` },
      { id: `${id}-q2`, points: 1, key: `${id}-f` },
    ],
  };
}

const itemFor = (quizId: string) => ({ id: `item-${quizId}`, title: `Quiz ${quizId}`, type: 'quiz' }) as any;

describe('InlineQuizPlayer definite start refusal', () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  it('a refused first start blocks the questions: no radios, no Submit, honest unsaved message, nothing stored', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    server.hooks.failStart = 'You do not have access to this quiz.';
    const onCompleted = vi.fn();
    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} onCompleted={onCompleted} />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));

    expect(await screen.findByText("Couldn't start this quiz")).toBeInTheDocument();
    expect(screen.getByText(/You do not have access to this quiz\. No attempt was started and your answers were not saved\./)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit quiz/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Saved$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
    // Nothing on the server, nothing reported upward.
    expect(server.calls.startRpc).toEqual(['qa']);
    expect(server.calls.directInsert).toHaveLength(0);
    expect(server.submissions).toHaveLength(0);
    expect(server.answers).toHaveLength(0);
    expect(server.calls.answerWrites).toHaveLength(0);
    expect(server.calls.score).toHaveLength(0);
    expect(onCompleted).not.toHaveBeenCalled();
    // No success fiction in a toast either.
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/submitted|saved|started/i) }));
  });

  it('Retry after a refusal asks the server once more; a repeated refusal stays blocked and stores nothing', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    server.hooks.failStart = 'You do not have access to this quiz.';
    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await screen.findByText("Couldn't start this quiz");

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(2));
    expect(await screen.findByText("Couldn't start this quiz")).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(server.submissions).toHaveLength(0);
    expect(server.calls.answerWrites).toHaveLength(0);
  });

  it('Retry that succeeds adopts exactly one attempt, keeps the unsaved answer and then saves it', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    server.hooks.failStart = 'You do not have access to this quiz.';
    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await screen.findByText("Couldn't start this quiz");

    server.hooks.failStart = null;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText(/attempt 1 of 1/i);
    expect(screen.getByRole('radio', { name: 'Four' })).toBeChecked();
    expect(server.calls.startRpc).toHaveLength(2);
    expect(server.submissions).toHaveLength(1);
    await waitFor(() => expect(server.calls.answerWrites.length).toBeGreaterThanOrEqual(1), { timeout: 5000 });
    expect(server.calls.answerWrites.at(-1)!.answers).toMatchObject({ 'qa-q1': 'qa-a1' });
    expect(server.calls.answerWrites.every((w) => w.submissionId === server.submissions[0].id)).toBe(true);
  });

  it('allowed start control: the first answer starts exactly one attempt via the RPC and no refusal is shown', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await screen.findByText(/attempt 1 of 1/i);
    expect(screen.queryByText("Couldn't start this quiz")).not.toBeInTheDocument();
    expect(server.calls.startRpc).toEqual(['qa']);
    expect(server.calls.directInsert).toHaveLength(0);
    expect(server.submissions).toHaveLength(1);
  });

  it('a refused RETAKE keeps the finalized result on screen and toasts; it does not block with the start error', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 2)] });
    server.install();
    server.seedSubmission({ quiz_id: 'qa', attempt: 1, workflow_state: 'complete', finished_at: new Date().toISOString(), score: 1 } as any);
    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 2)} />);
    const retake = await screen.findByRole('button', { name: /retake quiz/i });
    server.hooks.failStart = 'You do not have access to this quiz.';
    fireEvent.click(retake);
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error starting quiz' })));
    expect(screen.queryByText("Couldn't start this quiz")).not.toBeInTheDocument();
    expect(screen.getByTestId('quiz-player-review')).toBeInTheDocument();
    expect(server.submissions).toHaveLength(1);
  });
});
