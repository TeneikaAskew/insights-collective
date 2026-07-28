// ABOUTME: Tests for hostname-based video URL classification and canonical
// ABOUTME: embed construction — lookalike URLs must never classify or embed.

import { describe, it, expect } from 'vitest';
import { urlHostMatches, getVideoKind, toVideoEmbedUrl } from '../videoUrls';

describe('urlHostMatches', () => {
  it('matches exact hosts and subdomains', () => {
    expect(urlHostMatches('https://twitter.com/x/status/1', ['twitter.com'])).toBe(true);
    expect(urlHostMatches('https://mobile.twitter.com/x', ['twitter.com'])).toBe(true);
  });

  it('rejects lookalike hosts — the substring bypass', () => {
    expect(urlHostMatches('https://evil.com/twitter.com', ['twitter.com'])).toBe(false);
    expect(urlHostMatches('https://twitter.com.evil.net/x', ['twitter.com'])).toBe(false);
    expect(urlHostMatches('https://eviltwitter.com/x', ['twitter.com'])).toBe(false);
  });

  it('rejects non-http schemes and garbage', () => {
    expect(urlHostMatches('javascript:alert(1)//twitter.com', ['twitter.com'])).toBe(false);
    expect(urlHostMatches('', ['twitter.com'])).toBe(false);
  });
});

describe('getVideoKind', () => {
  it('classifies real video hosts', () => {
    expect(getVideoKind('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube');
    expect(getVideoKind('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(getVideoKind('https://vimeo.com/123456')).toBe('vimeo');
  });

  it('rejects lookalikes that defeated the substring check', () => {
    expect(getVideoKind('https://evil.com/youtube.com')).toBe(null);
    expect(getVideoKind('https://youtube.com.evil.net/watch?v=x')).toBe(null);
    expect(getVideoKind('https://notyoutube.com/watch?v=x')).toBe(null);
  });
});

describe('toVideoEmbedUrl', () => {
  it('canonicalises the common YouTube URL shapes', () => {
    const expected = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    expect(toVideoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(expected);
    expect(toVideoEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe(expected);
    expect(toVideoEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(expected);
    expect(toVideoEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(expected);
    expect(toVideoEmbedUrl('www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(expected);
  });

  it('canonicalises Vimeo page, player, and unlisted links', () => {
    expect(toVideoEmbedUrl('https://vimeo.com/123456')).toBe(
      'https://player.vimeo.com/video/123456',
    );
    expect(toVideoEmbedUrl('https://player.vimeo.com/video/123456')).toBe(
      'https://player.vimeo.com/video/123456',
    );
    expect(toVideoEmbedUrl('https://vimeo.com/123456/abc123de')).toBe(
      'https://player.vimeo.com/video/123456?h=abc123de',
    );
  });

  /**
   * The sink this util protects: the old code framed the raw URL whenever its
   * substring branches matched (or, in the editor, when none did). Nothing
   * that is not verifiably a video may produce an embed URL at all.
   */
  it.each([
    ['https://evil.com/youtube.com/embed/dQw4w9WgXcQ'],
    ['https://youtube.com.evil.net/watch?v=dQw4w9WgXcQ'],
    ['https://evil.com/anything'],
    ['https://www.youtube.com/watch?v=<script>'],
    ['https://www.youtube.com/watch'],
    ['https://vimeo.com/not-a-number'],
    ['javascript:alert(1)'],
    [''],
  ])('returns null for %j', (raw) => {
    expect(toVideoEmbedUrl(raw)).toBe(null);
  });

  it('never lets input bytes into the output beyond the validated ID', () => {
    const out = toVideoEmbedUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ&evil=https://evil.com');
    expect(out).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });
});
