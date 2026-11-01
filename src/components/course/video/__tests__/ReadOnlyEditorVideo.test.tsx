// ABOUTME: Mounts the ACTIVE learner surface (UnifiedCanvasEditor readOnly, as LessonViewer uses it)
// ABOUTME: with saved lesson HTML and asserts what learners and authors actually get for video nodes.

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';

/** Builder starter Video lesson (AddContentPanel VIDEO_TEMPLATE) as saved: wrapper without data-src. */
const STARTER_TEMPLATE = `<p><em>Replace the sample video below with your own YouTube or Vimeo embed URL.</em></p>
<div data-youtube-video>
  <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="Lesson video"></iframe>
</div>`;

const MIXED_LESSON =
  '<h2>Week 1</h2><p>Before the videos.</p>' +
  '<div data-youtube-video="" data-src="https://player.vimeo.com/video/76979871?h=8272103f6e" class="video-embed"><iframe src="https://player.vimeo.com/video/76979871?h=8272103f6e"></iframe></div>' +
  '<p>Between the videos.</p>' +
  '<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/AAAAAAAAAAA?start=30"></iframe></div>' +
  '<div data-youtube-video="" data-src="https://evil.example/frame"><iframe src="https://evil.example/frame"></iframe></div>' +
  '<p>After the videos.</p>';

function mountReadOnly(content: string) {
  // Exactly the props LessonViewer passes for page/assignment/quiz bodies.
  return render(<UnifiedCanvasEditor content={content} onChange={() => {}} readOnly={true} minHeight="auto" />);
}

describe('video embeds in the read-only lesson editor', () => {
  it('renders the builder starter template video with its accessible name', async () => {
    mountReadOnly(STARTER_TEMPLATE);
    const frame = await screen.findByTitle('Lesson video');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(screen.getByText(/Replace the sample video/)).toBeInTheDocument();
  });

  it('frames multiple saved embeds with exact src, keeps rich text, refuses the unsupported one', async () => {
    const { container } = mountReadOnly(MIXED_LESSON);
    const vimeo = await screen.findByTitle('Vimeo video');
    expect(vimeo).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871?h=8272103f6e');
    expect(screen.getByTitle('YouTube video')).toHaveAttribute(
      'src', 'https://www.youtube-nocookie.com/embed/AAAAAAAAAAA?start=30',
    );

    const frames = Array.from(container.querySelectorAll('iframe'));
    expect(frames).toHaveLength(2);
    for (const f of frames) {
      expect(f.getAttribute('src')).not.toContain('evil.example');
      expect(f.getAttribute('title')).toBeTruthy();
    }
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('Only YouTube and Vimeo videos can be embedded');
    // Learners are not shown the raw stored address.
    expect(within(note).queryByText(/evil\.example/)).toBeNull();

    const text = container.textContent ?? '';
    expect(text.indexOf('Before the videos.')).toBeLessThan(text.indexOf('Between the videos.'));
    expect(text.indexOf('Between the videos.')).toBeLessThan(text.indexOf('After the videos.'));
    expect(screen.getByRole('heading', { name: 'Week 1' })).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('shows authors the stored address of an unsupported embed in the editable editor', async () => {
    render(<UnifiedCanvasEditor content={MIXED_LESSON} onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText('Saved address: https://evil.example/frame')).toBeInTheDocument());
    expect(screen.getByTitle('Vimeo video')).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871?h=8272103f6e');
  });
});
