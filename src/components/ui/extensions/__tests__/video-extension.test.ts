// ABOUTME: Round-trip serialization contract for the TipTap video node (parse -> getHTML -> parse).
// ABOUTME: Pins exact src/hash preservation, both stored wrappers, titles and unsupported refs.

import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Video from '../video-extension';
import { sanitizeHTML } from '@/utils/sanitize';

const editors: Editor[] = [];
function load(content: string) {
  // Same configuration the active UnifiedCanvasEditor uses for this node.
  const editor = new Editor({
    extensions: [StarterKit, Video.configure({ allowFullscreen: true, HTMLAttributes: { class: 'w-full' } })],
    content,
  });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  while (editors.length) editors.pop()!.destroy();
});

const videoNodes = (editor: Editor) => (editor.getJSON().content ?? []).filter((n) => n.type === 'video');
const videoSrcs = (editor: Editor) => videoNodes(editor).map((n) => n.attrs?.src ?? null);
const videoTitles = (editor: Editor) => videoNodes(editor).map((n) => n.attrs?.title ?? null);

/** Exact getHTML() produced by main 32ccf7d for this saved Vimeo lesson (receipt old-main-probe.txt). */
const MAIN_SERIALIZATION =
  '<p>a</p><div data-youtube-video="" data-src="https://player.vimeo.com/video/123456?h=abcdef12" class="video-embed" style="position: relative; padding-bottom: 56.25%; height: 0px; overflow: hidden; max-width: 100%; margin: 1rem 0px;"><iframe src="https://player.vimeo.com/video/123456?h=abcdef12" style="position: absolute; top: 0px; left: 0px; width: 100%; height: 100%;" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="" class="w-full"></iframe></div><p>b</p>';

/** The builder's starter Video template (AddContentPanel VIDEO_TEMPLATE): no data-src on the wrapper. */
const STARTER_TEMPLATE = `<p><em>Replace the sample video below with your own YouTube or Vimeo embed URL.</em></p>
<div data-youtube-video>
  <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="Lesson video"></iframe>
</div>`;

describe('video node serialization contract', () => {
  it('re-serializes an existing saved lesson byte-for-byte (no title stored)', () => {
    const editor = load(MAIN_SERIALIZATION);
    expect(editor.getHTML()).toBe(MAIN_SERIALIZATION);
  });

  it('keeps the exact src and unlisted Vimeo hash across save -> reload -> save', () => {
    const first = load(MAIN_SERIALIZATION).getHTML();
    const second = load(sanitizeHTML(first)).getHTML();
    expect(second).toBe(first);
    expect(videoSrcs(load(second))).toEqual(['https://player.vimeo.com/video/123456?h=abcdef12']);
  });

  it('parses the starter template wrapper that has no data-src (falls back to the iframe src)', () => {
    const editor = load(STARTER_TEMPLATE);
    expect(videoSrcs(editor)).toEqual(['https://www.youtube.com/embed/dQw4w9WgXcQ']);
    expect(videoTitles(editor)).toEqual(['Lesson video']);
    const html = editor.getHTML();
    expect(html).toContain('data-src="https://www.youtube.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('title="Lesson video"');
  });

  it('parses the div.video-embed wrapper without the data marker', () => {
    const editor = load(
      '<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/abcDEF12345?start=30" title="Intro"></iframe></div>',
    );
    expect(videoSrcs(editor)).toEqual(['https://www.youtube-nocookie.com/embed/abcDEF12345?start=30']);
  });

  it('preserves a stored iframe title across save and reload', () => {
    const editor = load(
      '<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/abcDEF12345?start=30" title="Intro"></iframe></div>',
    );
    expect(videoTitles(editor)).toEqual(['Intro']);
    expect(videoTitles(load(sanitizeHTML(editor.getHTML())))).toEqual(['Intro']);
  });

  it('preserves surrounding rich text and multiple embeds in order', () => {
    const html =
      '<h2>Week 1</h2><p>Watch <strong>both</strong>:</p>' +
      '<div data-youtube-video="" data-src="https://www.youtube.com/embed/AAAAAAAAAAA"><iframe src="https://www.youtube.com/embed/AAAAAAAAAAA"></iframe></div>' +
      '<ul><li><p>note</p></li></ul>' +
      '<div class="video-embed"><iframe src="https://player.vimeo.com/video/987654321"></iframe></div>' +
      '<p>end</p>';
    const editor = load(html);
    expect(editor.getJSON().content?.map((n) => n.type)).toEqual([
      'heading', 'paragraph', 'video', 'bulletList', 'video', 'paragraph',
    ]);
    const reloaded = load(sanitizeHTML(editor.getHTML()));
    expect(videoSrcs(reloaded)).toEqual(['https://www.youtube.com/embed/AAAAAAAAAAA', 'https://player.vimeo.com/video/987654321']);
    expect(reloaded.getHTML()).toBe(editor.getHTML());
  });

  it('does not silently drop or rewrite an unsupported stored reference', () => {
    const editor = load(
      '<p>x</p><div data-youtube-video="" data-src="https://evil.example/frame"><iframe src="https://evil.example/frame"></iframe></div>',
    );
    expect(videoSrcs(editor)).toEqual(['https://evil.example/frame']);
    // Author save path: sanitizer drops the hostile iframe, data-src keeps the reference.
    const saved = sanitizeHTML(editor.getHTML());
    expect(saved).not.toContain('<iframe src="https://evil.example');
    expect(videoSrcs(load(saved))).toEqual(['https://evil.example/frame']);
  });

  it('keeps an empty legacy wrapper as a video node instead of an anonymous div', () => {
    const editor = load('<div data-youtube-video></div>');
    expect(videoSrcs(editor)).toEqual([null]);
    expect(editor.getHTML()).toBe('<div data-youtube-video=""></div>');
    expect(videoSrcs(load(editor.getHTML()))).toEqual([null]);
  });

  it('setVideo inserts the canonical embed produced by the editor dialog unchanged', () => {
    const editor = load('<p></p>');
    editor.commands.setVideo({ src: 'https://player.vimeo.com/video/76979871?h=8272103f6e' });
    expect(videoSrcs(editor)).toEqual(['https://player.vimeo.com/video/76979871?h=8272103f6e']);
  });
});
