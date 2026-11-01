// ABOUTME: Unit tests for the read-only embed resolver (what may be framed, and how).

import { describe, expect, it } from 'vitest';
import { accessibleVideoName, resolveEmbed } from '../embedSource';

describe('resolveEmbed', () => {
  it('frames a stored canonical YouTube embed verbatim', () => {
    expect(resolveEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ')).toMatchObject({
      status: 'supported', provider: 'youtube', providerLabel: 'YouTube', verbatim: true,
      frameSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  it('keeps youtube-nocookie origin and query parameters verbatim', () => {
    const src = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30&rel=0';
    expect(resolveEmbed(src)).toMatchObject({ status: 'supported', verbatim: true, frameSrc: src });
  });

  it('keeps the unlisted Vimeo hash exactly and links to the unlisted page', () => {
    const src = 'https://player.vimeo.com/video/76979871?h=8272103f6e';
    expect(resolveEmbed(src)).toMatchObject({
      status: 'supported', provider: 'vimeo', verbatim: true, frameSrc: src,
      watchUrl: 'https://vimeo.com/76979871/8272103f6e',
    });
  });

  it('does not frame an unvalidated Vimeo hash verbatim', () => {
    const r = resolveEmbed('https://player.vimeo.com/video/76979871?h=zz"onload');
    expect(r).toMatchObject({ status: 'supported', verbatim: false, frameSrc: 'https://player.vimeo.com/video/76979871' });
  });

  it('rebuilds a canonical embed for a saved watch/share link instead of framing it', () => {
    expect(resolveEmbed('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({
      verbatim: false, frameSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    });
    expect(resolveEmbed('https://vimeo.com/76979871/8272103f6e')).toMatchObject({
      verbatim: false, frameSrc: 'https://player.vimeo.com/video/76979871?h=8272103f6e',
    });
    expect(resolveEmbed('http://www.youtube.com/embed/dQw4w9WgXcQ')).toMatchObject({
      verbatim: false, frameSrc: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    });
  });

  it.each([
    ['https://evil.example/frame', 'not-allowed'],
    ['https://evil.com/youtube.com/embed/dQw4w9WgXcQ', 'not-allowed'],
    ['https://www.youtube.com.evil.com/embed/dQw4w9WgXcQ', 'not-allowed'],
    ['javascript:alert(1)', 'not-allowed'],
    ['https://www.youtube.com/embed/../../x', 'not-allowed'],
    ['', 'missing'],
    [null, 'missing'],
  ])('refuses %s', (src, reason) => {
    expect(resolveEmbed(src as string | null)).toEqual({ status: 'unsupported', reason });
  });
});

describe('accessibleVideoName', () => {
  it('uses the stored title, else the provider name', () => {
    expect(accessibleVideoName('Lesson video', 'YouTube')).toBe('Lesson video');
    expect(accessibleVideoName('  ', 'Vimeo')).toBe('Vimeo video');
    expect(accessibleVideoName(null, 'YouTube')).toBe('YouTube video');
  });
});
