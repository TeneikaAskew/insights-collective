// ABOUTME: Component tests: TrackedVideoPlayer turns simulated provider events into analytics writes.
// ABOUTME: Uses a fake sink; no provider network, no Supabase, not mounted in any learner route.

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TrackedVideoPlayer } from '../TrackedVideoPlayer';
import type { EngagementSink } from '../watchReporter';

function fakeSink(fail = false) {
  const updates: Array<Record<string, unknown>> = [];
  const sink: EngagementSink = {
    updateEngagement: vi.fn(async (_u, _c, update) => {
      updates.push(update as Record<string, unknown>);
      if (fail) throw new Error('offline');
    }),
  };
  return { sink, updates };
}

function send(frame: HTMLIFrameElement, origin: string, data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), origin, source: frame.contentWindow }));
  });
}

describe('TrackedVideoPlayer', () => {
  it('frames the canonical YouTube embed with the JS API switch and a computed name', () => {
    render(<TrackedVideoPlayer src="https://youtu.be/dQw4w9WgXcQ" userId="u" contentItemId="c" sink={fakeSink().sink} />);
    const frame = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    const url = new URL(frame.src);
    expect(url.origin + url.pathname).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(url.searchParams.get('enablejsapi')).toBe('1');
  });

  it('reports play, progress, seek and pause from YouTube to the sink after the frame loads', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const { sink, updates } = fakeSink();
      const { container } = render(
        <TrackedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Lesson 1" userId="user-1" contentItemId="item-1" sink={sink} />,
      );
      const frame = screen.getByTitle('Lesson 1') as HTMLIFrameElement;
      const o = 'https://www.youtube.com';
      send(frame, o, { event: 'onStateChange', info: 1 }); // before load: ignored
      fireEvent.load(frame);
      send(frame, o, { event: 'infoDelivery', info: { duration: 120, currentTime: 0 } });
      send(frame, o, { event: 'onStateChange', info: 1 });
      for (let s = 1; s <= 6; s++) {
        vi.setSystemTime(Date.now() + 1000);
        send(frame, o, { event: 'infoDelivery', info: { currentTime: s } });
      }
      vi.setSystemTime(Date.now() + 1000);
      send(frame, o, { event: 'infoDelivery', info: { currentTime: 90 } }); // scrub
      send(frame, o, { event: 'onStateChange', info: 2 });

      await waitFor(() => expect(sink.updateEngagement).toHaveBeenCalledTimes(1));
      expect(sink.updateEngagement).toHaveBeenCalledWith('user-1', 'item-1', expect.any(Object));
      expect(updates[0]).toEqual({
        lastPosition: 90, playbackSpeed: 1, watchTimeDelta: 6, playCountDelta: 1, pauseCountDelta: 1,
        seekCountDelta: 1, videoDuration: 120,
      });
      expect(updates[0]).not.toHaveProperty('completionPercentage');
      expect(container.querySelector('[data-watch-status]')).toHaveAttribute('data-watch-status', 'saved');
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes pending progress when unmounted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const { sink, updates } = fakeSink();
      const { unmount } = render(
        <TrackedVideoPlayer src="https://vimeo.com/76979871" userId="u" contentItemId="c" sink={sink} />,
      );
      const frame = screen.getByTitle('Vimeo video') as HTMLIFrameElement;
      fireEvent.load(frame);
      const o = 'https://player.vimeo.com';
      send(frame, o, { event: 'play', data: { seconds: 0 } });
      vi.setSystemTime(Date.now() + 2000);
      send(frame, o, { event: 'timeupdate', data: { seconds: 2, duration: 60 } });
      unmount();
      await waitFor(() => expect(updates).toHaveLength(1));
      expect(updates[0]).toMatchObject({ watchTimeDelta: 2, playCountDelta: 1, lastPosition: 2, videoDuration: 60 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('records nothing without both userId and contentItemId', () => {
    const { sink } = fakeSink();
    const { container } = render(<TrackedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" userId="u" sink={sink} />);
    const frame = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    fireEvent.load(frame);
    send(frame, 'https://www.youtube.com', { event: 'onStateChange', info: 1 });
    send(frame, 'https://www.youtube.com', { event: 'onStateChange', info: 2 });
    expect(sink.updateEngagement).not.toHaveBeenCalled();
    expect(container.querySelector('[data-watch-tracking]')).toHaveAttribute('data-watch-tracking', 'off');
  });

  it('shows a save failure honestly instead of claiming progress was saved', async () => {
    const { sink } = fakeSink(true);
    render(<TrackedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" userId="u" contentItemId="c" sink={sink} />);
    const frame = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    fireEvent.load(frame);
    send(frame, 'https://www.youtube.com', { event: 'onStateChange', info: 1 });
    send(frame, 'https://www.youtube.com', { event: 'onStateChange', info: 2 });
    expect(await screen.findByText('Viewing progress could not be saved. It will be retried.')).toBeInTheDocument();
  });

  it('never frames an unsupported source', () => {
    const { container } = render(<TrackedVideoPlayer src="https://evil.example/x" userId="u" contentItemId="c" sink={fakeSink().sink} />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent('Only YouTube and Vimeo');
  });
});
