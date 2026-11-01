// ABOUTME: Ordering and recovery regressions for the inline quiz player: autosave bound to its attempt (no retake
// ABOUTME: carryover), no answer write after finalization, newest revision wins, and a start whose response is lost.
//
// MOCK backend (quizServerFake.ts). The fake applies every answer write it receives, including writes to a
// finalized attempt, because the database pins grading columns, not answer_data. These tests prove the
// player never sends such a write; they are not backend acceptance.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { InlineQuizPlayer } from '@/components/course/learn/InlineQuizPlayer';
import { createQuizServer, gate } from './quizServerFake';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }), toast: toastMock }));
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({ user: { id: 'user-1' }, session: {}, loading: false, isAuthenticated: true }),
}));
vi.mock('@/components/ui/unified-canvas-editor', () => ({
  UnifiedCanvasEditor: ({ content }: any) => <div data-testid="readonly-editor">{content}</div>,
}));

const DEBOUNCE_PLUS = 2300;
const sleep = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

function makeQuiz(id: string, allowed: number | null) {
  return {
    id,
    allowed_attempts: allowed,
    time_limit: null,
    questions: [
      { id: `${id}-q1`, question_type: 'multiple_choice', question_text: `${id}: Q1`, points: 1, position: 1,
        answers: [{ id: `${id}-a1`, text: 'Four' }, { id: `${id}-a2`, text: 'Three' }] },
      { id: `${id}-q2`, question_type: 'true_false', question_text: `${id}: Q2`, points: 1, position: 2,
        answers: [{ id: `${id}-t`, text: 'True' }, { id: `${id}-f`, text: 'False' }] },
    ],
  } as any;
}
const serverQuiz = (id: string, allowed: number | null) => ({
  id, allowed_attempts: allowed,
  questions: [{ id: `${id}-q1`, points: 1, key: `${id}-a1` }, { id: `${id}-q2`, points: 1, key: `${id}-f` }],
});
const item = (q: string) => ({ id: `item-${q}`, title: q, type: 'quiz' }) as any;

describe('InlineQuizPlayer ordering and recovery', () => {
  beforeEach(() => toastMock.mockReset());

  // R1
  it('retake never writes the previous attempt\'s answers into the new attempt', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 2)] });
    server.install();
    const { unmount } = render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 2)} />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'True' }));
    // Let the debounce settle so a saved snapshot of attempt 1 exists.
    await sleep(DEBOUNCE_PLUS);
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
    const retake = await screen.findByRole('button', { name: /retake quiz/i });
    fireEvent.click(retake);
    await screen.findByText(/attempt 2 of 2/i);
    await sleep(DEBOUNCE_PLUS);

    const second = server.submissions.find((s) => s.attempt === 2)!;
    expect(server.calls.answerWrites.filter((w) => w.submissionId === second.id)).toEqual([]);
    expect(server.answers.filter((a) => a.quiz_submission_id === second.id)).toEqual([]);

    // Reload: attempt 2 resumes empty.
    unmount();
    render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 2)} />);
    await screen.findByText(/attempt 2 of 2/i);
    expect(screen.getByRole('radio', { name: 'Four' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Three' })).not.toBeChecked();
  }, 15000);

  // R2: an in-flight autosave must land before scoring starts, never after finalization.
  it('no answer write reaches an attempt after it is finalized', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    const held = gate();
    server.hooks.beforeAnswerWrite = (n) => (n === 1 ? held.promise : undefined);
    render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 1)} />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    await sleep(DEBOUNCE_PLUS); // autosave #1 is now in flight and held
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
    await sleep(200);
    await act(async () => held.release());
    await screen.findByTestId('quiz-player-review');
    await sleep(DEBOUNCE_PLUS);

    const sub = server.submissions[0];
    expect(server.calls.answerWrites.every((w) => w.stateAtApply !== 'complete')).toBe(true);
    const finalizedAt = server.calls.events.indexOf(`finalized:${sub.id}`);
    const lastWrite = server.calls.events.lastIndexOf(`write:${sub.id}`);
    expect(finalizedAt).toBeGreaterThan(-1);
    expect(lastWrite).toBeLessThan(server.calls.events.indexOf(`score:${sub.id}`));
    // The finalized answers and grade are intact.
    expect(sub).toMatchObject({ workflow_state: 'complete', score: 2 });
    const byQ = Object.fromEntries(server.answers.filter((a) => a.quiz_submission_id === sub.id).map((a) => [a.quiz_question_id, a.answer_data.answer]));
    expect(byQ).toEqual({ 'qa-q1': 'qa-a1', 'qa-q2': 'qa-f' });
  }, 15000);

  it('a newer revision is never overwritten by an older save that finishes later', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    const held = gate();
    server.hooks.beforeAnswerWrite = (n) => (n === 1 ? held.promise : undefined);
    render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 1)} />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    await sleep(DEBOUNCE_PLUS); // save of revision "Four" held
    fireEvent.click(screen.getByRole('radio', { name: 'Three' }));
    await sleep(DEBOUNCE_PLUS); // save of revision "Three" requested
    await act(async () => held.release());
    await sleep(300);

    const sub = server.submissions[0];
    const q1 = server.answers.find((a) => a.quiz_submission_id === sub.id && a.quiz_question_id === 'qa-q1');
    expect(q1?.answer_data.answer).toBe('qa-a2');
    expect(server.calls.answerWrites.map((w) => w.answers['qa-q1'])).toEqual(['qa-a1', 'qa-a2']);
    expect(screen.getByText('Saved')).toBeInTheDocument();
  }, 15000);

  it('shows Saved only for the newest revision, not while a newer answer is unsaved', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    const held = gate();
    server.hooks.beforeAnswerWrite = (n) => (n === 1 ? held.promise : undefined);
    render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 1)} />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    await sleep(DEBOUNCE_PLUS);
    fireEvent.click(screen.getByRole('radio', { name: 'Three' }));
    await act(async () => held.release());
    await sleep(200);
    // "Four" saved, but "Three" is newer and not yet saved.
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  }, 15000);

  // R4
  it('a start whose response is lost adopts the committed attempt instead of starting another', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    server.hooks.loseStartResponse = true;
    render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 1)} />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await screen.findByText(/attempt 1 of 1/i);
    server.hooks.loseStartResponse = false;
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
    await screen.findByTestId('quiz-player-review');

    expect(server.calls.startRpc).toHaveLength(1);
    expect(server.submissions).toHaveLength(1);
    expect(server.calls.score[0]).toEqual({
      submissionId: server.submissions[0].id,
      answers: { 'qa-q1': 'qa-a1', 'qa-q2': 'qa-f' },
    });
  });

  it('when the outcome of a start cannot be confirmed, it blocks instead of starting again', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 1)} />);
    await screen.findByRole('radio', { name: 'Four' });
    server.hooks.loseStartResponse = true;
    server.hooks.failLatest = true;

    fireEvent.click(screen.getByRole('radio', { name: 'Four' }));
    expect(await screen.findByText("Couldn't confirm whether your attempt started")).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Three' })).not.toBeInTheDocument();
    expect(server.calls.startRpc).toHaveLength(1);

    server.hooks.loseStartResponse = false;
    server.hooks.failLatest = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByText(/attempt 1 of 1/i);
    expect(server.calls.startRpc).toHaveLength(1);
    expect(server.submissions).toHaveLength(1);
  });

  it('a definite refusal from start leaves no attempt and allows trying again', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    server.hooks.failStart = 'You do not have access to this quiz.';
    render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 1)} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error starting quiz' })));
    expect(server.submissions).toHaveLength(0);
    server.hooks.failStart = null;
    fireEvent.click(screen.getByRole('radio', { name: 'Three' }));
    await screen.findByText(/attempt 1 of 1/i);
    expect(server.calls.startRpc).toHaveLength(2);
    expect(server.submissions).toHaveLength(1);
  });
});
