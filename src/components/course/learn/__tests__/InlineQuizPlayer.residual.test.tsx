// ABOUTME: Residual ordering schedules from the c885ccb recheck: an uncertain RETAKE start, an uncertain FINALIZATION,
// ABOUTME: and an autosave from a previous (unmounted) session of the same attempt racing the new session's submit.
//
// MOCK backend (quizServerFake.ts), which applies every write it receives, including writes to finalized attempts.
// Not backend acceptance.
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
    id, allowed_attempts: allowed, time_limit: null,
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

describe('InlineQuizPlayer residual schedules', () => {
  beforeEach(() => toastMock.mockReset());

  // (1) Uncertain RETAKE
  it('an uncertain retake never carries attempt 1 answers into attempt 2', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 2)] });
    server.install();
    render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 2)} />);

    // Attempt 1: answered and submitted.
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'True' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
    await screen.findByRole('button', { name: /retake quiz/i });
    const first = server.submissions[0];
    const firstAnswersBefore = JSON.stringify(server.answers.filter((a) => a.quiz_submission_id === first.id));

    // Retake: the start commits attempt 2 but the response is lost, and the first reconciliation read fails.
    server.hooks.loseStartResponse = true;
    server.hooks.failLatest = true;
    fireEvent.click(screen.getByRole('button', { name: /retake quiz/i }));
    expect(await screen.findByText("Couldn't confirm whether your attempt started")).toBeInTheDocument();

    // Delayed reconciliation succeeds and adopts attempt 2.
    server.hooks.loseStartResponse = false;
    server.hooks.failLatest = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByText(/attempt 2 of 2/i);
    const second = server.submissions.find((s) => s.attempt === 2)!;

    // Attempt 2 starts blank (go to Q1 if the player is still on the last question).
    const back = screen.getByRole('button', { name: /back/i }) as HTMLButtonElement;
    if (!back.disabled) fireEvent.click(back);
    expect(screen.getByRole('radio', { name: 'Four' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Three' })).not.toBeChecked();

    // Only its own answers are written and submitted.
    fireEvent.click(screen.getByRole('radio', { name: 'Three' }));
    await sleep(DEBOUNCE_PLUS);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('radio', { name: 'True' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
    await screen.findByText(/no attempts remaining/i);

    for (const w of server.calls.answerWrites.filter((x) => x.submissionId === second.id)) {
      expect(w.answers).toEqual({ 'qa-q1': 'qa-a2' });
    }
    expect(server.calls.score[1]).toEqual({ submissionId: second.id, answers: { 'qa-q1': 'qa-a2', 'qa-q2': 'qa-f' } });
    // Attempt 1 history intact.
    expect(first).toMatchObject({ workflow_state: 'complete', score: 1 });
    expect(JSON.stringify(server.answers.filter((a) => a.quiz_submission_id === first.id))).toBe(firstAnswersBefore);
    expect(server.calls.startRpc).toHaveLength(2);
    expect(server.submissions).toHaveLength(2);
  }, 15000);

  // (2) Uncertain FINALIZATION
  it('a score that commits but whose response and read-back are lost blocks writes and rescoring until confirmed', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    const onCompleted = vi.fn().mockResolvedValue(true);
    render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 1)} onCompleted={onCompleted} />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    server.hooks.loseScoreResponse = true;
    server.hooks.failReadback = true;
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));

    expect(await screen.findByText("Couldn't confirm whether your quiz was submitted")).toBeInTheDocument();
    const sub = server.submissions[0];
    const writesAtBlock = server.calls.answerWrites.length;
    await sleep(DEBOUNCE_PLUS);
    // No answer writes, no second score, no progress while the outcome is unknown.
    expect(server.calls.answerWrites.length).toBe(writesAtBlock);
    expect(server.calls.answerWrites.every((w) => w.stateAtApply !== 'complete')).toBe(true);
    expect(server.calls.score).toHaveLength(1);
    expect(onCompleted).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /submit quiz/i })).not.toBeInTheDocument();

    // Read-only reconciliation finds it finalized: keep the result, retry progress only.
    server.hooks.loseScoreResponse = false;
    server.hooks.failReadback = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByTestId('quiz-player-review');
    expect(screen.getByText(/2 \/ 2 points/)).toBeInTheDocument();
    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith('item-qa'));
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(server.calls.score).toHaveLength(1);
    expect(sub).toMatchObject({ workflow_state: 'complete', score: 2 });
    expect(server.calls.answerWrites.every((w) => w.stateAtApply !== 'complete')).toBe(true);
  }, 15000);

  it('an uncertain finalization that reconciles to "not finalized" reopens the attempt for one honest resubmit', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 1)} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    // Score request fails before reaching the server; the read-back also fails.
    (server.hooks as any).failReadback = true;
    const invoke = (await import('@/test/mocks/supabase')).mockSupabaseClient.functions.invoke as any;
    const real = invoke.getMockImplementation();
    invoke.mockImplementationOnce(async () => ({ data: null, error: { message: 'Failed to send a request to the Edge Function' } }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
    expect(await screen.findByText("Couldn't confirm whether your quiz was submitted")).toBeInTheDocument();

    server.hooks.failReadback = false;
    invoke.mockImplementation(real);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByTestId('quiz-player-active');
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
    await screen.findByTestId('quiz-player-review');
    expect(server.calls.score).toHaveLength(1);
    expect(server.submissions[0]).toMatchObject({ workflow_state: 'complete', score: 2 });
  }, 15000);

  // (3) Cross-remount chain
  it('an autosave from an unmounted session of the same attempt lands before the new session finalizes', async () => {
    const server = createQuizServer({ quizzes: [serverQuiz('qa', 1)] });
    server.install();
    const held = gate();
    server.hooks.beforeAnswerWrite = (n) => (n === 1 ? held.promise : undefined);

    const first = render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 1)} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    await sleep(DEBOUNCE_PLUS); // old session's write #1 is in flight and held
    first.unmount(); // leave

    // Return to the same quiz and attempt; release the old write a little later.
    window.setTimeout(() => held.release(), 600);
    render(<InlineQuizPlayer item={item('qa')} quiz={makeQuiz('qa', 1)} />);
    fireEvent.click(await screen.findByRole('button', { name: /next/i }, { timeout: 3000 }));
    fireEvent.click(await screen.findByRole('radio', { name: 'False' }));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));
    await screen.findByTestId('quiz-player-review', {}, { timeout: 3000 });
    await sleep(800);

    const sub = server.submissions[0];
    expect(server.calls.answerWrites.every((w) => w.stateAtApply !== 'complete')).toBe(true);
    const scoreAt = server.calls.events.indexOf(`score:${sub.id}`);
    expect(server.calls.events.lastIndexOf(`write:${sub.id}`)).toBeLessThan(scoreAt);
    // The new session resumed with the old session's answer, so the submission carries it.
    expect(server.calls.score[0].answers).toEqual({ 'qa-q1': 'qa-a1', 'qa-q2': 'qa-f' });
    expect(server.submissions).toHaveLength(1);
  }, 15000);
});
