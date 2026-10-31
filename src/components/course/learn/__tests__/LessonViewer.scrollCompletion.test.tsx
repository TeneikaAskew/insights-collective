// ABOUTME: Scroll-to-bottom auto-completion regression: pages auto-complete, assignments and quizzes
// ABOUTME: never do, and their footer button cannot mark them done.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@/test/utils/test-utils';
import { LessonViewer } from '../LessonViewer';

vi.mock('../InlineAssignmentSubmit', () => ({ InlineAssignmentSubmit: () => null }));
vi.mock('../InlineQuizPlayer', () => ({ InlineQuizPlayer: () => null }));
vi.mock('@/components/discussions/InlineDiscussionWidget', () => ({ InlineDiscussionWidget: () => null }));
vi.mock('@/components/course/discussions/InlineDiscussionWidget', () => ({ InlineDiscussionWidget: () => null }));

let observerCb: ((e: any[]) => void) | null = null;
beforeEach(() => {
  observerCb = null;
  vi.useFakeTimers();
  (window as any).IntersectionObserver = class {
    constructor(cb: any) { observerCb = cb; }
    observe() {}
    disconnect() {}
  };
});

function scrollToBottom() {
  act(() => {
    observerCb?.([{ isIntersecting: true }]);
    vi.advanceTimersByTime(2000);
  });
}

const base = { title: 'X', published: true, content: '', settings: {} };

describe('LessonViewer scroll completion', () => {
  it('scrolling an assignment does not complete it', () => {
    const onMarkDone = vi.fn();
    render(
      <LessonViewer item={{ ...base, id: 'a1', type: 'assignment', assignment: {} } as any}
        isCompleted={false} onMarkDone={onMarkDone} onNavigate={vi.fn()} discussionsEnabled={false} /> as any,
    );
    scrollToBottom();
    expect(onMarkDone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Submit to complete/ })).toBeDisabled();
    vi.useRealTimers();
  });

  it('scrolling a page completes it as a view', () => {
    const onMarkDone = vi.fn();
    render(
      <LessonViewer item={{ ...base, id: 'p1', type: 'page' } as any}
        isCompleted={false} onMarkDone={onMarkDone} onNavigate={vi.fn()} discussionsEnabled={false} /> as any,
    );
    scrollToBottom();
    expect(onMarkDone).toHaveBeenCalledWith('p1');
    vi.useRealTimers();
  });
});
