// ABOUTME: TipTap node-view adapter that renders a saved video node with EmbeddedVideoPlayer.
// ABOUTME: Display only: it never updates node attributes, so serialization is unchanged.

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { EmbeddedVideoPlayer } from './EmbeddedVideoPlayer';

export function VideoNodeView({ node, editor, extension }: NodeViewProps) {
  const src = (node.attrs.src as string | null) ?? null;
  const title = (node.attrs.title as string | null) ?? null;
  const frameClassName = (extension.options?.HTMLAttributes?.class as string | undefined) ?? undefined;
  // Same option the serializer honours in renderHTML; default true like the extension.
  const allowFullscreen = extension.options?.allowFullscreen !== false;
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper
      as="div"
      className="video-embed-node"
      data-video-node=""
      data-drag-handle={editable ? '' : undefined}
      contentEditable={false}
    >
      <EmbeddedVideoPlayer
        src={src}
        title={title}
        showSourceDetails={editable}
        frameClassName={frameClassName}
        allowFullscreen={allowFullscreen}
      />
    </NodeViewWrapper>
  );
}

export default VideoNodeView;
