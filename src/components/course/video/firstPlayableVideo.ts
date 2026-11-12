// ABOUTME: Picks the one video node per lesson that may report watch progress:
// ABOUTME: the first video, in document order, whose saved src is a playable YouTube/Vimeo embed.

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { resolveEmbed } from './embedSource';

export const isPlayableVideoNode = (node: ProseMirrorNode) =>
  resolveEmbed((node.attrs.src as string | null) ?? null).status === 'supported';

/**
 * video_analytics holds one row per learner and lesson, with one resume
 * position and one duration, so only one player per lesson may write to it:
 * the first playable video in document order. Two players would overwrite
 * each other's position and duration and mix two videos' watch time.
 */
export function isFirstPlayableVideo(doc: ProseMirrorNode, pos: number): boolean {
  let firstPos: number | null = null;
  doc.descendants((node, nodePos) => {
    if (firstPos !== null) return false;
    if (node.type.name === 'video' && isPlayableVideoNode(node)) firstPos = nodePos;
    return firstPos === null;
  });
  return firstPos === pos;
}
