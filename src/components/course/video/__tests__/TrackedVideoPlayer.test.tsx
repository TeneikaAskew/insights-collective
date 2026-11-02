// ABOUTME: Component tests: TrackedVideoPlayer turns simulated provider events into analytics writes.
// ABOUTME: Uses a fake sink; no provider network, no Supabase, not mounted in any learner route.

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TrackedVideoPlayer } from '../TrackedVideoPlayer';
import type { EngagementSink } from '../watchReporter';

/** Fake sink. Both method names share one mock so the same controls also run against older heads. */
function fakeSink(fail = false) {
  const updates: Array<Record<string, unknown>> = [];
  const impl = vi.fn(async (_u: string, _c: string, update: unknown) => {
    updates.push(update as Record<string, unknown>);
    if (fail) throw new Error('offline');
  });
  const sink = { applyEngagementDeltas: impl, updateEngagement: impl } as unknown as EngagementSink;
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

      await waitFor(() => expect(sink.applyEngagementDeltas).toHaveBeenCalledTimes(1));
      expect(vi.mocked(sink.applyEngagementDeltas).mock.calls[0].slice(0, 2)).toEqual(['user-1', 'item-1']);
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
    expect(sink.applyEngagementDeltas).not.toHaveBeenCalled();
    expect(container.querySelector('[data-watch-tracking]')).toHaveAttribute('data-watch-tracking', 'off');
  });

  it('shows a save failure honestly instead of claiming progress was saved', async () => {
    const { sink } = fakeSink(true);
    render(<TrackedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" userId="u" contentItemId="c" sink={sink} />);
    const frame = screen.getByTitle('YouTube video') as HTMLIFrameElement;
    fireEvent.load(frame);
    send(frame, 'https://www.youtube.com', { event: 'onStateChange', info: 1 });
    send(frame, 'https://www.youtube.com', { event: 'onStateChange', info: 2 });
    expect(await screen.findByText(/Viewing progress could not be saved. It will be tried again the next time you pause or after more watching, or you can retry now./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry saving' })).toBeInTheDocument();
  });

  it('never frames an unsupported source', () => {
    const { container } = render(<TrackedVideoPlayer src="https://evil.example/x" userId="u" contentItemId="c" sink={fakeSink().sink} />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent('Only YouTube and Vimeo');
  });

  // Review R4 (#164 4c6544a): status is scoped to one video and identity; recovery trigger is real.
  describe('R4 status scoping and recovery', () => {
    /** A sink whose writes stay pending until the test settles them (both method names, so the same control runs on older heads). */
    function deferredSink() {
      const pending: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];
      const impl = vi.fn((_u: string, _c: string, _d: unknown) => new Promise<void>((resolve, reject) => { pending.push({ resolve, reject }); }));
      const sink = { applyEngagementDeltas: impl, updateEngagement: impl } as unknown as EngagementSink;
      return { sink, impl, pending };
    }
    const status = (c: HTMLElement) => c.querySelector('[data-watch-status]')!.getAttribute('data-watch-status');
    const playPause = (frame: HTMLIFrameElement) => {
      send(frame, 'https://www.youtube.com', { event: 'onStateChange', info: 1 });
      send(frame, 'https://www.youtube.com', { event: 'onStateChange', info: 2 });
    };

    it('ignores a late failure from video A after switching to video B', async () => {
      const { sink, pending } = deferredSink();
      const src = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      const { container, rerender } = render(<TrackedVideoPlayer src={src} userId="u" contentItemId="A" sink={sink} />);
      fireEvent.load(screen.getByTitle('YouTube video'));
      playPause(screen.getByTitle('YouTube video') as HTMLIFrameElement);
      await waitFor(() => expect(pending).toHaveLength(1));
      rerender(<TrackedVideoPlayer src={src} userId="u" contentItemId="B" sink={sink} />);
      await act(async () => { pending[0].reject(new Error('offline')); });
      await act(async () => { await Promise.resolve(); });
      // B has written nothing, so B's status must still be idle: nothing from A may leak into it.
      expect(status(container)).toBe('idle');
      expect(screen.queryByText(/could not be saved/)).toBeNull();
    });

    it('resets an error status when the video identity changes', async () => {
      const { sink, pending } = deferredSink();
      const src = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      const { container, rerender } = render(<TrackedVideoPlayer src={src} userId="u" contentItemId="A" sink={sink} />);
      fireEvent.load(screen.getByTitle('YouTube video'));
      playPause(screen.getByTitle('YouTube video') as HTMLIFrameElement);
      await waitFor(() => expect(pending).toHaveLength(1));
      await act(async () => { pending[0].reject(new Error('offline')); });
      await waitFor(() => expect(status(container)).toBe('error'));
      rerender(<TrackedVideoPlayer src={src} userId="u" contentItemId="B" sink={sink} />);
      await waitFor(() => expect(status(container)).toBe('idle'));
    });

    // Regression guard, NOT a causal control: React 18 already drops post-unmount updates silently, so this also passes on 4c6544a.
    it('ignores results that arrive after unmount', async () => {
      const { sink, pending } = deferredSink();
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const { unmount } = render(<TrackedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" userId="u" contentItemId="A" sink={sink} />);
        fireEvent.load(screen.getByTitle('YouTube video'));
        playPause(screen.getByTitle('YouTube video') as HTMLIFrameElement);
        await waitFor(() => expect(pending).toHaveLength(1));
        unmount();
        await act(async () => { pending[0].reject(new Error('offline')); });
        await act(async () => { await Promise.resolve(); });
        expect(errors).not.toHaveBeenCalled();
      } finally {
        errors.mockRestore();
      }
    });

    it('offers a working retry button after a failed save', async () => {
      const { sink, impl, pending } = deferredSink();
      const { container } = render(<TrackedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" userId="u" contentItemId="A" sink={sink} />);
      fireEvent.load(screen.getByTitle('YouTube video'));
      playPause(screen.getByTitle('YouTube video') as HTMLIFrameElement);
      await waitFor(() => expect(pending).toHaveLength(1));
      await act(async () => { pending[0].reject(new Error('offline')); });
      fireEvent.click(await screen.findByRole('button', { name: 'Retry saving' }));
      await waitFor(() => expect(impl).toHaveBeenCalledTimes(2));
      expect(impl.mock.calls[1][2]).toEqual(impl.mock.calls[0][2]); // the identical batch
      await act(async () => { pending[1].resolve(); });
      await waitFor(() => expect(status(container)).toBe('saved'));
      expect(screen.queryByRole('button', { name: 'Retry saving' })).toBeNull();
    });
  });

  // #146 embed surface: the tracked frame uses the same frame URL as the read-only embed.
  describe('preserves the WP09A embed URL', () => {
    it('keeps the privacy-enhanced host and stored params, adding only the JS API switch', () => {
      render(
        <TrackedVideoPlayer src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=30" userId="u" contentItemId="c" sink={fakeSink().sink} />,
      );
      const url = new URL((screen.getByTitle('YouTube video') as HTMLIFrameElement).src);
      expect(url.origin + url.pathname).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
      expect(url.searchParams.get('rel')).toBe('0');
      expect(url.searchParams.get('start')).toBe('30');
      expect(url.searchParams.get('enablejsapi')).toBe('1');
    });

    it('keeps a stored Vimeo embed URL verbatim, including the unlisted hash and other params', () => {
      const src = 'https://player.vimeo.com/video/76979871?h=8272103f6e&badge=0';
      render(<TrackedVideoPlayer src={src} userId="u" contentItemId="c" sink={fakeSink().sink} />);
      expect((screen.getByTitle('Vimeo video') as HTMLIFrameElement).getAttribute('src')).toBe(src);
    });

    it('records events from a privacy-enhanced frame', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        const { sink } = fakeSink();
        render(<TrackedVideoPlayer src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" userId="u" contentItemId="c" sink={sink} />);
        const frame = screen.getByTitle('YouTube video') as HTMLIFrameElement;
        fireEvent.load(frame);
        const o = 'https://www.youtube-nocookie.com';
        send(frame, o, { event: 'infoDelivery', info: { currentTime: 0 } });
        send(frame, o, { event: 'onStateChange', info: 1 });
        vi.setSystemTime(Date.now() + 1000);
        send(frame, o, { event: 'infoDelivery', info: { currentTime: 1 } });
        send(frame, o, { event: 'onStateChange', info: 2 });
        await waitFor(() => expect(sink.applyEngagementDeltas).toHaveBeenCalled());
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
