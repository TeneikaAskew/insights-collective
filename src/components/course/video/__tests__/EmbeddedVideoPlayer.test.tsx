// ABOUTME: Component tests for EmbeddedVideoPlayer's observable states (jsdom, no provider network).
// ABOUTME: Frame load is simulated with fireEvent.load; it proves frame arrival only, never playback.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmbeddedVideoPlayer, FRAME_SLOW_AFTER_MS } from '../EmbeddedVideoPlayer';

describe('EmbeddedVideoPlayer', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

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
