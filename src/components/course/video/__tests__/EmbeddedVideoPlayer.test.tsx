// ABOUTME: Component tests for EmbeddedVideoPlayer's observable states (jsdom, no provider network).
// ABOUTME: Frame load is simulated with fireEvent.load; it proves frame arrival only, never playback.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmbeddedVideoPlayer, FRAME_SLOW_AFTER_MS } from '../EmbeddedVideoPlayer';

/**
 * Controllable IntersectionObserver. Nothing intersects until a test emits an entry. Disconnected observers are kept
 * (marked) so a test can deliver a callback that was already queued when cleanup ran, which a real browser can do.
 */
type FakeObserver = { cb: IntersectionObserverCallback; targets: Element[]; self: IntersectionObserver; disconnected: boolean };
let observers: FakeObserver[] = [];
class ControlledObserver {
  private entry: FakeObserver;
  constructor(cb: IntersectionObserverCallback) {
    this.entry = { cb, targets: [], self: this as unknown as IntersectionObserver, disconnected: false };
    observers.push(this.entry);
  }
  observe(el: Element) { this.entry.targets.push(el); }
  unobserve() {}
  disconnect() { this.entry.disconnected = true; }
  takeRecords() { return []; }
}
function emit(o: FakeObserver, isIntersecting: boolean) {
  act(() => {
    o.cb(o.targets.map((target) => ({ isIntersecting, target }) as IntersectionObserverEntry), o.self);
  });
}
/** Delivers an intersecting entry to every observer that is still connected. */
function enterViewport() {
  for (const o of observers.filter((x) => !x.disconnected)) emit(o, true);
}
const live = () => observers.filter((x) => !x.disconnected);
const stateOf = (c: HTMLElement) => c.querySelector('[data-video-state]')?.getAttribute('data-video-state');
const A = 'https://www.youtube.com/embed/AAAAAAAAAAA';
const B = 'https://www.youtube.com/embed/BBBBBBBBBBB';

// Timing checks keep a 1 s margin before the deadline: with shouldAdvanceTime the fake clock also follows real time.
describe('EmbeddedVideoPlayer', () => {
  const realObserver = globalThis.IntersectionObserver;
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    observers = [];
    globalThis.IntersectionObserver = ControlledObserver as unknown as typeof IntersectionObserver;
  });
  afterEach(() => {
    vi.useRealTimers();
    globalThis.IntersectionObserver = realObserver;
  });

  it('renders a named, responsive frame with provider controls allowed', () => {
    const { container } = render(<EmbeddedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" />);
    const frame = screen.getByTitle('YouTube video');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(frame).toHaveAttribute('allowfullscreen');
    expect(frame.getAttribute('allow')).toContain('encrypted-media');
    expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    expect((frame.parentElement as HTMLElement).style.aspectRatio).toBe('16 / 9');
    expect(container.querySelector('[data-video-state]')).toHaveAttribute('data-video-state', 'loading');
    expect(screen.getByRole('status')).toHaveTextContent('Loading YouTube player');
  });

  it('omits allowfullscreen when the extension option is false', () => {
    render(<EmbeddedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowFullscreen={false} />);
    expect(screen.getByTitle('YouTube video')).not.toHaveAttribute('allowfullscreen');
  });

  it('uses the author title as the accessible name', () => {
    render(<EmbeddedVideoPlayer src="https://player.vimeo.com/video/76979871?h=8272103f6e" title="Lesson video" />);
    expect(screen.getByTitle('Lesson video')).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871?h=8272103f6e');
    expect(screen.getByRole('link', { name: /Watch on Vimeo\s*:\s*Lesson video \(opens in a new tab\)/ })).toHaveAttribute(
      'href', 'https://vimeo.com/76979871/8272103f6e',
    );
  });

  it('marks the frame loaded on its load event without claiming playback', () => {
    const { container } = render(<EmbeddedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" />);
    fireEvent.load(screen.getByTitle('YouTube video'));
    expect(container.querySelector('[data-video-state]')).toHaveAttribute('data-video-state', 'loaded');
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(container.textContent).not.toMatch(/playing|watched|complete/i);
  });

  it('offers a keyboard-reachable retry when the frame is slow, and remounts the frame', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<EmbeddedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" />);
    const firstFrame = screen.getByTitle('YouTube video');
    enterViewport();
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS + 1); });
    expect(container.querySelector('[data-video-state]')).toHaveAttribute('data-video-state', 'slow');
    expect(screen.getByRole('status')).toHaveTextContent('taking longer than expected');

    // jsdom does not put cross-origin iframes in the tab order; in a browser the
    // frame comes first. Retry precedes the provider link either way.
    await user.tab();
    const retry = screen.getByRole('button', { name: 'Retry loading video' });
    expect(retry).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: /Watch on YouTube/ })).toHaveFocus();
    await user.tab({ shift: true });
    expect(retry).toHaveFocus();
    await user.keyboard('{Enter}');

    const secondFrame = screen.getByTitle('YouTube video');
    expect(secondFrame).not.toBe(firstFrame);
    expect(container.querySelector('[data-video-state]')).toHaveAttribute('data-video-state', 'loading');
  });

  it('does not call a frame slow while it has never entered the viewport (lazy frame not yet requested)', () => {
    const { container } = render(<EmbeddedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" />);
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS * 4); });
    expect(container.querySelector('[data-video-state]')).toHaveAttribute('data-video-state', 'loading');
    expect(screen.getByRole('status')).toHaveTextContent('Loading YouTube player');
    expect(screen.queryByRole('button', { name: 'Retry loading video' })).toBeNull();
  });

  it('starts the slow clock when the frame first enters the viewport', () => {
    const { container } = render(<EmbeddedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" />);
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS * 2); });
    enterViewport();
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS - 1000); });
    expect(container.querySelector('[data-video-state]')).toHaveAttribute('data-video-state', 'loading');
    act(() => { vi.advanceTimersByTime(1001); });
    expect(container.querySelector('[data-video-state]')).toHaveAttribute('data-video-state', 'slow');
    expect(screen.getByRole('status')).toHaveTextContent('taking longer than expected');
  });

  it('keeps a frame that loaded before it was seen as loaded when it later enters the viewport', () => {
    const { container } = render(<EmbeddedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" />);
    fireEvent.load(screen.getByTitle('YouTube video'));
    enterViewport();
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS * 2); });
    expect(container.querySelector('[data-video-state]')).toHaveAttribute('data-video-state', 'loaded');
  });

  it('falls back to timing from mount when IntersectionObserver is unavailable', () => {
    // Simulate an environment without IntersectionObserver.
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    const { container } = render(<EmbeddedVideoPlayer src="https://www.youtube.com/embed/dQw4w9WgXcQ" />);
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS + 1); });
    expect(container.querySelector('[data-video-state]')).toHaveAttribute('data-video-state', 'slow');
  });

  it('direct replacement: a new source is not seen until its own first intersection', () => {
    const { container, rerender } = render(<EmbeddedVideoPlayer src={A} />);
    enterViewport();
    rerender(<EmbeddedVideoPlayer src={B} />);
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS * 3); });
    expect(stateOf(container)).toBe('loading');
    enterViewport();
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS + 1); });
    expect(stateOf(container)).toBe('slow');
  });

  it('seen A, then unsupported while off screen, then B: B is not seen until it intersects', () => {
    const { container, rerender } = render(<EmbeddedVideoPlayer src={A} />);
    enterViewport();
    rerender(<EmbeddedVideoPlayer src="https://media.example.invalid/x" />);
    expect(container.querySelector('iframe')).toBeNull();
    rerender(<EmbeddedVideoPlayer src={B} />);
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS * 3); });
    expect(stateOf(container)).toBe('loading');
    expect(screen.queryByRole('button', { name: 'Retry loading video' })).toBeNull();
  });

  it('an old observer callback delivered after replacement does not mark the new frame seen', () => {
    const { container, rerender } = render(<EmbeddedVideoPlayer src={A} />);
    const oldObserver = live()[0];
    rerender(<EmbeddedVideoPlayer src={B} />);
    expect(oldObserver.disconnected).toBe(true);
    emit(oldObserver, true);
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS * 3); });
    expect(stateOf(container)).toBe('loading');
  });

  it('an old observer callback delivered after unmount updates nothing and does not throw', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<EmbeddedVideoPlayer src={A} />);
    const oldObserver = live()[0];
    unmount();
    expect(oldObserver.disconnected).toBe(true);
    expect(() => emit(oldObserver, true)).not.toThrow();
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS * 2); });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('non-intersecting entries never start the clock; after the first entry, exit and re-entry do not restart it', () => {
    const { container } = render(<EmbeddedVideoPlayer src={A} />);
    const o = live()[0];
    emit(o, false);
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS * 2); });
    expect(stateOf(container)).toBe('loading');
    emit(o, true);
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS / 2); });
    emit(o, false);
    emit(o, true);
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS / 2 + 1); });
    expect(stateOf(container)).toBe('slow');
  });

  it('Retry gets a full fresh timeout', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<EmbeddedVideoPlayer src={A} />);
    enterViewport();
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS + 1); });
    expect(stateOf(container)).toBe('slow');
    await user.click(screen.getByRole('button', { name: 'Retry loading video' }));
    expect(stateOf(container)).toBe('loading');
    act(() => { vi.advanceTimersByTime(FRAME_SLOW_AFTER_MS - 1000); });
    expect(stateOf(container)).toBe('loading');
    act(() => { vi.advanceTimersByTime(1001); });
    expect(stateOf(container)).toBe('slow');
  });

  it('never frames an unsupported source and says so', () => {
    const { container } = render(<EmbeddedVideoPlayer src="https://evil.example/frame" />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent('Only YouTube and Vimeo videos can be embedded');
    expect(screen.queryByText(/evil\.example/)).toBeNull();
  });

  it('shows the stored address to authors only', () => {
    render(<EmbeddedVideoPlayer src="https://evil.example/frame" showSourceDetails />);
    expect(screen.getByText('Saved address: https://evil.example/frame')).toBeInTheDocument();
  });

  it('reports a missing address honestly', () => {
    render(<EmbeddedVideoPlayer src={null} />);
    expect(screen.getByRole('note')).toHaveTextContent('has no saved address');
  });
});
