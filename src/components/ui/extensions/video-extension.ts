import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { VideoNodeView } from '@/components/course/video/VideoNodeView';

/** Who is watching which lesson. Only honoured by the read-only (learner) node view. */
export interface VideoWatchTracking {
  userId: string;
  contentItemId: string;
}

export interface VideoOptions {
  allowFullscreen: boolean;
  HTMLAttributes: Record<string, any>;
  /**
   * When set, the first playable video in a read-only document reports watch
   * progress for this learner and lesson (TrackedVideoPlayer). Display only:
   * it never changes the saved HTML. Null keeps every video untracked.
   */
  watchTracking: VideoWatchTracking | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string; title?: string | null }) => ReturnType;
    };
  }
}

/**
 * Saved-content contract (do not change without a migration plan):
 * - Both stored wrappers parse: `div[data-youtube-video]` (src from
 *   `data-src`, falling back to the child iframe's src, as the builder's
 *   starter Video template omits `data-src`) and `div.video-embed`.
 * - The stored src is kept byte-for-byte, including query strings and the
 *   unlisted Vimeo `?h=` hash. Nothing here validates or rewrites it; display
 *   safety is decided at render time by EmbeddedVideoPlayer/resolveEmbed,
 *   which refuses to frame anything that is not a validated YouTube/Vimeo
 *   embed. An unsupported stored src is therefore preserved, not deleted.
 * - renderHTML output for a node without a title is identical to the
 *   previous serializer, so existing saved lessons re-save unchanged. A
 *   stored iframe title is preserved on the iframe.
 */
function iframeChild(element: HTMLElement): HTMLIFrameElement | null {
  return element.querySelector('iframe');
}

export const Video = Node.create<VideoOptions>({
  name: 'video',

  addOptions() {
    return {
      allowFullscreen: true,
      HTMLAttributes: {},
      watchTracking: null,
    };
  },

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        // Parsed per rule in parseHTML.getAttrs; never emitted directly.
        rendered: false,
      },
      title: {
        default: null,
        parseHTML: (element) => {
          const title = iframeChild(element as HTMLElement)?.getAttribute('title');
          return title && title.trim() ? title : null;
        },
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-video]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const dataSrc = el.getAttribute('data-src');
          const src = dataSrc || iframeChild(el)?.getAttribute('src') || null;
          return { src };
        },
      },
      {
        tag: 'div.video-embed',
        getAttrs: (element) => {
          const iframe = iframeChild(element as HTMLElement);
          return { src: iframe?.getAttribute('src') || null };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const embedUrl = node.attrs.src as string | null;
    const title = node.attrs.title as string | null;

    // Keep the wrapper marker so an empty legacy node still round-trips as a
    // video node instead of collapsing to an anonymous <div>.
    if (!embedUrl) return ['div', { 'data-youtube-video': '' }];

    return [
      'div',
      {
        'data-youtube-video': '',
        'data-src': embedUrl,
        class: 'video-embed',
        style: 'position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1rem 0;',
      },
      [
        'iframe',
        {
          src: embedUrl,
          style: 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;',
          frameborder: '0',
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
          allowfullscreen: this.options.allowFullscreen ? '' : undefined,
          ...this.options.HTMLAttributes,
          ...(title ? { title } : {}),
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },

  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});

export default Video;
