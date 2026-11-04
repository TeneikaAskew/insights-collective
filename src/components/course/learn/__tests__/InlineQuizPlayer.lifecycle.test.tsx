// ABOUTME: Lifecycle regressions for the active learner quiz player: RPC-only attempt creation, resume,
// ABOUTME: retake numbering, unlimited (0/NULL) attempts, A->B->A remount isolation, honest failure states.
//
// These run against an in-memory MOCK of the quiz backend (quizServerFake.ts).
// They prove the player's client contract only; they are not backend acceptance.
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

describe('InlineQuizPlayer lifecycle', () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  // Fixture (1)
  it('limit 1: one RPC-created attempt stays usable after the first answer, and progression waits for the finalized row', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    let stateAtCompletion: any = null;
    const onCompleted = vi.fn(async (id: string) => {
      stateAtCompletion = { itemId: id, row: { ...server.submissions[0] } };
    });

    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} onCompleted={onCompleted} />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toEqual(['qa']));

    // Still the active player, not "used all attempts".
    expect(screen.queryByText(/used all available attempts/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));

    await screen.findByTestId('quiz-player-review');
    expect(server.calls.directInsert).toHaveLength(0);
    expect(server.calls.startRpc).toHaveLength(1);
    expect(server.calls.score).toEqual([
      { submissionId: server.submissions[0].id, answers: { 'qa-q1': 'qa-a1', 'qa-q2': 'qa-f' } },
    ]);
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(stateAtCompletion.itemId).toBe('item-qa');
    expect(stateAtCompletion.row).toMatchObject({ workflow_state: 'complete', score: 2 });
    expect(stateAtCompletion.row.finished_at).toEqual(expect.any(String));
    expect(screen.getByText(/2 \/ 2 points/)).toBeInTheDocument();
    expect(screen.getByText(/no attempts remaining/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retake/i })).not.toBeInTheDocument();
  });

  // Fixture (2)
  it('resumes the same pending attempt with its saved answer and elapsed time, without a new start', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    const startedAt = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    const pending = server.seedSubmission({ quiz_id: 'qa', attempt: 1, started_at: startedAt });
    server.seedAnswer({ quiz_submission_id: pending.id, quiz_question_id: 'qa-q1', answer_data: { answer: 'qa-a1' } });

    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1, { time_limit: 10 })} />);

    const four = await screen.findByRole('radio', { name: 'Four' });
    await waitFor(() => expect(four).toBeChecked());
    // ~6 minutes left of 10, derived from started_at rather than reset to 10:00.
    expect(screen.getByTestId('quiz-timer').textContent).toMatch(/[56]:\d\d/);
    expect(screen.getByText(/attempt 1 of 1/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
    await screen.findByTestId('quiz-player-review');

    expect(server.calls.startRpc).toHaveLength(0);
    expect(server.calls.directInsert).toHaveLength(0);
    expect(server.calls.score[0]).toEqual({
      submissionId: pending.id,
      answers: { 'qa-q1': 'qa-a1', 'qa-q2': 'qa-f' },
    });
    expect(server.submissions).toHaveLength(1);
  });

  it('blocks honestly when the saved answers of a pending attempt cannot be loaded', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    const pending = server.seedSubmission({ quiz_id: 'qa', attempt: 1 });
    server.hooks.failAnswersLoad = (id) => id === pending.id;

    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} />);

    expect(await screen.findByText("Couldn't restore your saved answers")).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Four' })).not.toBeInTheDocument();
    expect(server.calls.startRpc).toHaveLength(0);

    server.hooks.failAnswersLoad = undefined;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('radio', { name: 'Four' })).toBeInTheDocument();
    expect(server.calls.startRpc).toHaveLength(0);
  });

  // Fixture (3)
  it('limit 2: Retake creates exactly one new attempt numbered 2 and keeps attempt 1 intact', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 2)] });
    server.install();
    const first = server.seedSubmission({
      quiz_id: 'qa',
      attempt: 1,
      workflow_state: 'complete',
      finished_at: '2026-10-01T00:00:00Z',
      score: 1,
      kept_score: 1,
    });
    server.seedAnswer({ quiz_submission_id: first.id, quiz_question_id: 'qa-q1', answer_data: { answer: 'qa-a1' }, correct: true, points: 1 });
    server.seedAnswer({ quiz_submission_id: first.id, quiz_question_id: 'qa-q2', answer_data: { answer: 'qa-t' }, correct: false, points: 0 });
    const gateStart = gate();
    server.hooks.beforeStart = () => gateStart.promise;

    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 2)} />);

    const retake = await screen.findByRole('button', { name: /retake quiz/i });
    fireEvent.click(retake);
    fireEvent.click(retake);
    // While the start is in flight the previous result stays on screen.
    expect(screen.getByTestId('quiz-player-review')).toBeInTheDocument();
    await act(async () => gateStart.release());

    await screen.findByTestId('quiz-player-active');
    expect(server.calls.startRpc).toEqual(['qa']);
    expect(screen.getByText(/attempt 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Four' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: 'Three' }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
    await screen.findByTestId('quiz-player-review');

    const second = server.submissions.find((s) => s.attempt === 2)!;
    expect(second.id).not.toBe(first.id);
    expect(server.calls.score[0].submissionId).toBe(second.id);
    // Attempt 1 is untouched: grade and answers preserved.
    expect(first).toMatchObject({ workflow_state: 'complete', score: 1 });
    expect(server.answers.filter((a) => a.quiz_submission_id === first.id)).toHaveLength(2);
    expect(server.submissions).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /retake/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no attempts remaining/i)).toBeInTheDocument();
  });

  // Fixture (4)
  it.each([0, null])('allowed_attempts=%s keeps unlimited semantics (resume and retake)', async (allowed) => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', allowed)] });
    server.install();
    server.seedSubmission({ quiz_id: 'qa', attempt: 1, workflow_state: 'complete', finished_at: '2026-10-01T00:00:00Z', score: 0 });
    server.seedSubmission({ quiz_id: 'qa', attempt: 2 });

    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', allowed)} />);

    // Pending attempt 2 resumes; it is not "exhausted".
    expect(await screen.findByTestId('quiz-player-active')).toBeInTheDocument();
    expect(screen.getByText(/attempt 2 · unlimited attempts/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Four' }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
    await screen.findByTestId('quiz-player-review');

    fireEvent.click(screen.getByRole('button', { name: /retake quiz/i }));
    await screen.findByTestId('quiz-player-active');
    expect(screen.getByText(/attempt 3 · unlimited attempts/i)).toBeInTheDocument();
    expect(server.calls.startRpc).toEqual(['qa']);
    expect(server.calls.directInsert).toHaveLength(0);
  });

  // Fixture (5)
  it('A -> B -> A: a slow start for A never leaks into B, and returning to A resumes instead of starting again', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1), serverQuiz('qb', 1)] });
    server.install();
    const gateStart = gate();
    server.hooks.beforeStart = (id) => (id === 'qa' ? gateStart.promise : undefined);
    const onCompleted = vi.fn();

    const { rerender } = render(
      <InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} onCompleted={onCompleted} />,
    );
    const four = await screen.findByRole('radio', { name: 'Four' });
    fireEvent.click(four);
    fireEvent.click(screen.getByRole('radio', { name: 'Three' }));
    fireEvent.click(four);

    rerender(<InlineQuizPlayer item={itemFor('qb')} quiz={makeQuiz('qb', 1)} onCompleted={onCompleted} />);
    await screen.findByText('qb: What is 2+2?');
    await act(async () => gateStart.release());

    // B is clean: nothing selected, no attempt started for B.
    expect(screen.getByRole('radio', { name: 'Four' })).not.toBeChecked();
    expect(screen.queryByText(/qa:/)).not.toBeInTheDocument();
    expect(server.calls.startRpc).toEqual(['qa']);

    rerender(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} onCompleted={onCompleted} />);
    await screen.findByText('qa: What is 2+2?');
    expect(await screen.findByTestId('quiz-player-active')).toBeInTheDocument();
    expect(server.calls.startRpc).toEqual(['qa']);
    expect(server.submissions).toHaveLength(1);
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('leaving during a slow start keeps the answer: the start lands, the answer is saved, and returning resumes it', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1), serverQuiz('qb', 1)] });
    server.install();
    const gateStart = gate();
    server.hooks.beforeStart = (id) => (id === 'qa' ? gateStart.promise : undefined);

    const { rerender } = render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    rerender(<InlineQuizPlayer item={itemFor('qb')} quiz={makeQuiz('qb', 1)} />);
    await screen.findByText('qb: What is 2+2?');
    await act(async () => gateStart.release());

    await waitFor(() =>
      expect(server.calls.answerWrites).toEqual([
        { submissionId: server.submissions[0].id, answers: { 'qa-q1': 'qa-a1' }, stateAtApply: 'pending_review' },
      ]),
    );

    rerender(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} />);
    await screen.findByTestId('quiz-player-active');
    expect(await screen.findByRole('radio', { name: 'Four' })).toBeChecked();
    expect(server.calls.startRpc).toEqual(['qa']);
    expect(server.submissions).toHaveLength(1);
  });

  it('returning before a slow start lands waits for it instead of starting a second attempt', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 2), serverQuiz('qb', 1)] });
    server.install();
    const gateStart = gate();
    server.hooks.beforeStart = (id) => (id === 'qa' ? gateStart.promise : undefined);

    const { rerender } = render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 2)} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    rerender(<InlineQuizPlayer item={itemFor('qb')} quiz={makeQuiz('qb', 1)} />);
    await screen.findByText('qb: What is 2+2?');
    rerender(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 2)} />);
    await act(async () => gateStart.release());

    await screen.findByTestId('quiz-player-active');
    expect(await screen.findByRole('radio', { name: 'Four' })).toBeChecked();
    expect(server.calls.startRpc).toEqual(['qa']);
    expect(server.submissions).toHaveLength(1);
    expect(server.submissions[0].attempt).toBe(1);
  });

  it('a slow attempt lookup for A resolving after switching to B does not overwrite B', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 2), serverQuiz('qb', 2)] });
    server.install();
    server.seedSubmission({ quiz_id: 'qa', attempt: 1, workflow_state: 'complete', finished_at: '2026-10-01T00:00:00Z', score: 1 });
    const gateLatest = gate();
    server.hooks.beforeLatest = (id) => (id === 'qa' ? gateLatest.promise : undefined);

    const { rerender } = render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 2)} />);
    rerender(<InlineQuizPlayer item={itemFor('qb')} quiz={makeQuiz('qb', 2)} />);
    await screen.findByText('qb: What is 2+2?');
    await act(async () => gateLatest.release());

    expect(screen.queryByTestId('quiz-player-review')).not.toBeInTheDocument();
    expect(screen.getByText('qb: What is 2+2?')).toBeInTheDocument();
  });

  // Fixture (6)
  it('a failed review-answer load is an error state, not an all-incorrect zero', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 2)] });
    server.install();
    const done = server.seedSubmission({ quiz_id: 'qa', attempt: 1, workflow_state: 'complete', finished_at: '2026-10-01T00:00:00Z', score: 2, kept_score: 2 });
    server.hooks.failAnswersLoad = (id) => id === done.id;

    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 2)} />);

    expect(await screen.findByText("Couldn't load your answer review")).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 2 points/)).toBeInTheDocument();
    expect(screen.queryByText(/incorrect/i)).not.toBeInTheDocument();
  });

  it('a completion-save failure keeps the submitted result and offers a separate progress retry', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    const onCompleted = vi
      .fn()
      .mockRejectedValueOnce(new Error('progress write failed'))
      .mockResolvedValueOnce(undefined);

    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} onCompleted={onCompleted} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));

    await screen.findByTestId('quiz-player-review');
    expect(screen.getByText(/2 \/ 2 points/)).toBeInTheDocument();
    expect(await screen.findByText(/your course progress wasn't saved/i)).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Error submitting quiz' }));
    expect(server.calls.score).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /retry saving progress/i }));
    await waitFor(() => expect(screen.queryByText(/your course progress wasn't saved/i)).not.toBeInTheDocument());
    expect(onCompleted).toHaveBeenCalledTimes(2);
    expect(server.calls.score).toHaveLength(1);
  });

  it('treats an onCompleted result of false as a progress failure too', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    const onCompleted = vi.fn().mockResolvedValue(false);

    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} onCompleted={onCompleted} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));

    expect(await screen.findByText(/your course progress wasn't saved/i)).toBeInTheDocument();
  });

  it('does not report progress when the finalized row cannot be confirmed', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    const onCompleted = vi.fn();

    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} onCompleted={onCompleted} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    server.hooks.failReadback = true;
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));

    expect(await screen.findByText(/your course progress wasn't saved/i)).toBeInTheDocument();
    expect(onCompleted).not.toHaveBeenCalled();

    server.hooks.failReadback = false;
    fireEvent.click(screen.getByRole('button', { name: /retry saving progress/i }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith('item-qa'));
  });

  it('a failed start shows an honest blocking error and leaves no attempt', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    server.hooks.failStart = 'You do not have access to this quiz.';

    render(<InlineQuizPlayer item={itemFor('qa')} quiz={makeQuiz('qa', 1)} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));

    // T-62 follow-up: a refused first start replaces the questions (see InlineQuizPlayer.startRefusal.test.tsx).
    expect(await screen.findByText("Couldn't start this quiz")).toBeInTheDocument();
    expect(screen.getByText(/You do not have access to this quiz\./)).toBeInTheDocument();
    expect(server.submissions).toHaveLength(0);
    expect(server.calls.directInsert).toHaveLength(0);
  });
});
