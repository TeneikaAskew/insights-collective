// ABOUTME: Real LessonViewer + real InlineQuizPlayer over the quiz backend MOCK: a failed progress write (onMarkDone
// ABOUTME: resolving false) keeps the submitted result and offers a retry that calls onMarkDone again, never score-quiz.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { LessonViewer } from '../LessonViewer';
import { createQuizServer } from './quizServerFake';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({ user: { id: 'user-1' }, session: {}, loading: false, isAuthenticated: true }),
}));
vi.mock('@/components/ui/unified-canvas-editor', () => ({
  UnifiedCanvasEditor: ({ content }: any) => <div>{content}</div>,
}));
vi.mock('@/components/course/discussions/InlineDiscussionWidget', () => ({ InlineDiscussionWidget: () => null }));
vi.mock('../InlineAssignmentSubmit', () => ({ InlineAssignmentSubmit: () => null }));

const quiz = {
  id: 'qa',
  allowed_attempts: 1,
  time_limit: null,
  questions: [
    { id: 'qa-q1', question_type: 'multiple_choice', question_text: 'Q1', points: 1, position: 1,
      answers: [{ id: 'qa-a1', text: 'Four' }, { id: 'qa-a2', text: 'Three' }] },
  ],
};
const item = { id: 'item-qa', title: 'Quiz A', type: 'quiz', published: true, content: '', settings: {}, quiz } as any;

describe('LessonViewer forwards the progress result to the quiz player', () => {
  it('false then true: one submission, result kept, retry calls onMarkDone(itemId, "submission") again', async () => {
    const server = createQuizServer({
      quizzes: [{ id: 'qa', allowed_attempts: 1, questions: [{ id: 'qa-q1', points: 1, key: 'qa-a1' }] }],
    });
    server.install();
    const onMarkDone = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    render(
      <LessonViewer item={item} isCompleted={false} onMarkDone={onMarkDone} onNavigate={vi.fn()}
        actionBasePath="/courses/c1/learn/m1" discussionsEnabled={false} />,
    );

    fireEvent.click(await screen.findByRole('radio', { name: 'Four' }));
    await waitFor(() => expect(server.calls.startRpc).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /submit quiz/i }));

    expect(await screen.findByText(/your course progress wasn't saved/i)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 1 point/)).toBeInTheDocument();
    expect(onMarkDone).toHaveBeenNthCalledWith(1, 'item-qa', 'submission');

    fireEvent.click(screen.getByRole('button', { name: /retry saving progress/i }));
    await waitFor(() => expect(screen.queryByText(/your course progress wasn't saved/i)).not.toBeInTheDocument());
    expect(onMarkDone).toHaveBeenNthCalledWith(2, 'item-qa', 'submission');
    expect(onMarkDone).toHaveBeenCalledTimes(2);
    expect(server.calls.score).toHaveLength(1);
    expect(screen.getByText(/1 \/ 1 point/)).toBeInTheDocument();
  });
});
