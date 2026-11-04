// ABOUTME: Checks that the node view forwards the Video extension's options (allowFullscreen, class)
// ABOUTME: to the rendered frame, matching what the serializer emits for the same option.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Video from '@/components/ui/extensions/video-extension';

const CONTENT =
  '<div data-youtube-video="" data-src="https://www.youtube.com/embed/dQw4w9WgXcQ"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>';

function Harness({ allowFullscreen }: { allowFullscreen: boolean }) {
  const editor = useEditor({
    extensions: [StarterKit, Video.configure({ allowFullscreen, HTMLAttributes: { class: 'w-full' } })],
    content: CONTENT,
    editable: false,
  });
  return (
    <>
      <EditorContent editor={editor} />
      <output data-testid="serialized">{editor?.getHTML() ?? ''}</output>
    </>
  );
}

describe('VideoNodeView option forwarding', () => {
  it.each([true, false])('allowFullscreen=%s matches the serializer', async (allowFullscreen) => {
    render(<Harness allowFullscreen={allowFullscreen} />);
    const frame = await screen.findByTitle('YouTube video');
    expect(frame.hasAttribute('allowfullscreen')).toBe(allowFullscreen);
    expect(frame).toHaveClass('w-full');
    expect(screen.getByTestId('serialized').textContent!.includes('allowfullscreen=""')).toBe(allowFullscreen);
  });
});
