import { Node } from '@tiptap/core';

export interface VideoOptions {
  allowFullscreen: boolean;
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string }) => ReturnType;
    };
  }
}

export const Video = Node.create<VideoOptions>({
  name: 'video',

  addOptions() {
    return {
      allowFullscreen: true,
      HTMLAttributes: {},
    };
  },

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-video]',
        getAttrs: (element) => {
          const src = (element as HTMLElement).getAttribute('data-src');
          return { src };
        },
      },
      {
        tag: 'div.video-embed',
        getAttrs: (element) => {
          const iframe = (element as HTMLElement).querySelector('iframe');
          return { src: iframe?.getAttribute('src') || null };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const embedUrl = HTMLAttributes.src;
    
    if (!embedUrl) return ['div'];
    
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
        },
      ],
    ];
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