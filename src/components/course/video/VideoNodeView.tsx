// ABOUTME: TipTap node-view adapter that renders a saved video node with EmbeddedVideoPlayer,
// ABOUTME: or, for the first playable video of a learner's read-only lesson, with TrackedVideoPlayer.

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { EmbeddedVideoPlayer } from './EmbeddedVideoPlayer';
import { TrackedVideoPlayer } from './TrackedVideoPlayer';
import { isFirstPlayableVideo, isPlayableVideoNode } from './firstPlayableVideo';
import type { VideoWatchTracking } from '@/components/ui/extensions/video-extension';

export function VideoNodeView({ node, editor, extension, getPos }: NodeViewProps) {
  const src = (node.attrs.src as string | null) ?? null;
  const title = (node.attrs.title as string | null) ?? null;
  const frameClassName = (extension.options?.HTMLAttributes?.class as string | undefined) ?? undefined;
  // Same option the serializer honours in renderHTML; default true like the extension.
  const allowFullscreen = extension.options?.allowFullscreen !== false;
  const editable = editor.isEditable;
  const tracking = (extension.options?.watchTracking as VideoWatchTracking | null | undefined) ?? null;

  const pos = typeof getPos === 'function' ? getPos() : undefined;
  const tracked =
    !editable &&
    tracking !== null &&
    typeof pos === 'number' &&
    isPlayableVideoNode(node) &&
    isFirstPlayableVideo(editor.state.doc, pos);

  return (
    <NodeViewWrapper
      as="div"
      className="video-embed-node"
      data-video-node=""
      data-drag-handle={editable ? '' : undefined}
      contentEditable={false}
    >
      {tracked ? (
        <TrackedVideoPlayer
          src={src}
          title={title}
          userId={tracking.userId}
          contentItemId={tracking.contentItemId}
          allowFullscreen={allowFullscreen}
          className={frameClassName}
        />
      ) : (
        <EmbeddedVideoPlayer
          src={src}
          title={title}
          showSourceDetails={editable}
          frameClassName={frameClassName}
          allowFullscreen={allowFullscreen}
        />
      )}
    </NodeViewWrapper>
  );
}

export default VideoNodeView;
