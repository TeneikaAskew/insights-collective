// ABOUTME: Wiring test: the learner lesson view (LessonViewer -> read-only UnifiedCanvasEditor -> VideoNodeView)
// ABOUTME: tracks only the first playable video, for the signed-in learner and this lesson, and nothing else.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const applyEngagementDeltas = vi.hoisted(() => vi.fn(async () => ({ outcome: 'applied' })));
vi.mock('@/services/videoAnalyticsService', () => ({ default: { applyEngagementDeltas } }));
vi.mock('@/components/course/learn/InlineAssignmentSubmit', () => ({ InlineAssignmentSubmit: () => null }));
vi.mock('@/components/course/learn/InlineQuizPlayer', () => ({ InlineQuizPlayer: () => null }));
vi.mock('@/components/course/discussions/InlineDiscussionWidget', () => ({ InlineDiscussionWidget: () => null }));

import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { LessonViewer } from '@/components/course/learn/LessonViewer';

const LESSON =
  '<p>Intro.</p>' +
  '<div data-youtube-video="" data-src="https://evil.example/frame"><iframe src="https://evil.example/frame"></iframe></div>' +
  '<div data-youtube-video="" data-src="https://www.youtube.com/embed/dQw4w9WgXcQ"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="First lesson video"></iframe></div>' +
  '<div data-youtube-video="" data-src="https://player.vimeo.com/video/76979871"><iframe src="https://player.vimeo.com/video/76979871" title="Second lesson video"></iframe></div>';

const TRACKING = { userId: 'learner-1', contentItemId: 'item-1' };

function send(frame: HTMLIFrameElement, origin: string, data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), origin, source: frame.contentWindow }));
  });
}

const trackedWrappers = (container: HTMLElement) => container.querySelectorAll('[data-watch-tracking]');

beforeEach(() => {
  applyEngagementDeltas.mockClear();
  (window as any).IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
});

describe('learner video watch tracking wiring', () => {
  it('tracks only the first playable video in a read-only lesson', async () => {
    const { container } = render(
      <UnifiedCanvasEditor content={LESSON} onChange={() => {}} readOnly minHeight="auto" videoWatchTracking={TRACKING} />,
    );
    const first = (await screen.findByTitle('First lesson video')) as HTMLIFrameElement;
    expect(screen.getByTitle('Second lesson video')).toBeInTheDocument();
    const wrappers = trackedWrappers(container);
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0]).toHaveAttribute('data-watch-tracking', 'on');
    expect(wrappers[0]).toContainElement(first);
    // The unsupported embed before it is still refused, not tracked.
    expect(screen.getByRole('note')).toHaveTextContent('Only YouTube and Vimeo videos can be embedded');
    expect(new URL(first.src).searchParams.get('enablejsapi')).toBe('1');
  });

  it('writes play and pause for this learner and lesson through the analytics service', async () => {
    render(<UnifiedCanvasEditor content={LESSON} onChange={() => {}} readOnly minHeight="auto" videoWatchTracking={TRACKING} />);
    const frame = (await screen.findByTitle('First lesson video')) as HTMLIFrameElement;
    const o = 'https://www.youtube.com';
    fireEvent.load(frame);
    send(frame, o, { event: 'infoDelivery', info: { duration: 60, currentTime: 0 } });
    send(frame, o, { event: 'onStateChange', info: 1 });
    send(frame, o, { event: 'onStateChange', info: 2 });
    await waitFor(() => expect(applyEngagementDeltas).toHaveBeenCalledTimes(1));
    const [userId, itemId, deltas] = applyEngagementDeltas.mock.calls[0] as unknown as [string, string, Record<string, unknown>];
    expect([userId, itemId]).toEqual(['learner-1', 'item-1']);
    expect(deltas).toMatchObject({ playCountDelta: 1, pauseCountDelta: 1 });
    // Coverage is never sent, so the 90% auto-complete trigger cannot fire.
    expect(deltas).not.toHaveProperty('completionPercentage');
  });

  it('tracks nothing without an identity, and nothing in the editable editor', async () => {
    const readOnly = render(<UnifiedCanvasEditor content={LESSON} onChange={() => {}} readOnly minHeight="auto" />);
    await screen.findByTitle('First lesson video');
    expect(trackedWrappers(readOnly.container)).toHaveLength(0);
    readOnly.unmount();

    const editable = render(<UnifiedCanvasEditor content={LESSON} onChange={() => {}} videoWatchTracking={TRACKING} />);
    await screen.findByTitle('First lesson video');
    expect(trackedWrappers(editable.container)).toHaveLength(0);
  });

  it('LessonViewer passes the signed-in learner and the lesson id', async () => {
    const item = { id: 'lesson-9', title: 'Week 1', type: 'page', published: true, content: LESSON, settings: {} } as any;
    const { container, rerender } = render(
      <MemoryRouter>
        <LessonViewer item={item} onNavigate={vi.fn()} onMarkDone={vi.fn()} actionBasePath="/x" discussionsEnabled={false} watchUserId="learner-7" />
      </MemoryRouter>,
    );
    const frame = (await screen.findByTitle('First lesson video')) as HTMLIFrameElement;
    expect(trackedWrappers(container)[0]).toHaveAttribute('data-watch-tracking', 'on');
    fireEvent.load(frame);
    send(frame, 'https://www.youtube.com', { event: 'onStateChange', info: 1 });
    send(frame, 'https://www.youtube.com', { event: 'onStateChange', info: 2 });
    await waitFor(() => expect(applyEngagementDeltas).toHaveBeenCalled());
    expect(applyEngagementDeltas.mock.calls[0].slice(0, 2)).toEqual(['learner-7', 'lesson-9']);

    rerender(
      <MemoryRouter>
        <LessonViewer item={item} onNavigate={vi.fn()} onMarkDone={vi.fn()} actionBasePath="/x" discussionsEnabled={false} />
      </MemoryRouter>,
    );
    await screen.findByTitle('First lesson video');
    await waitFor(() => expect(trackedWrappers(container)).toHaveLength(0));
  });
});
