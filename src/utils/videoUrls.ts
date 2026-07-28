// ABOUTME: Hostname-based video URL classification and canonical embed URL
// ABOUTME: construction, replacing substring checks that lookalike URLs defeat.

/**
 * Why this exists
 * ---------------
 * Video handling used to decide "is this YouTube?" with
 * `url.includes('youtube.com')` and then build the iframe src by string
 * replacement on the raw input. Both halves were wrong (CodeQL
 * js/incomplete-url-substring-sanitization, and the sink it feeds):
 *
 * - `https://evil.com/youtube.com` contains the substring, so it classified
 *   as YouTube;
 * - the "already an embed" and no-match paths passed the raw URL straight
 *   into an <iframe src>, so a hostile page could be framed inside a course.
 *
 * The fix has two parts, both here: classification parses the URL and
 * compares the hostname against an explicit allowlist (exact match — every
 * legitimate subdomain is enumerated), and embedding never reuses the input
 * at all. The iframe src is rebuilt from a validated video ID on a fixed
 * origin, so the only thing an attacker controls is an ID that must match a
 * strict character class.
 */

const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
];

const VIMEO_HOSTS = ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'];

/** YouTube IDs are 11 chars today; the range tolerates format drift without
 *  admitting slashes, dots, or anything URL-structural. */
const YOUTUBE_ID = /^[\w-]{6,20}$/;
const VIMEO_ID = /^\d{1,12}$/;
/** Unlisted-video hash appended by Vimeo share links (?h=…). */
const VIMEO_HASH = /^[0-9a-f]{1,16}$/i;

/**
 * Parse a URL the way a paste box receives it: absolute, or scheme-less
 * ("www.youtube.com/watch?v=x"). Anything unparseable, and any non-http(s)
 * scheme, is null — a javascript: URL must not classify as a video.
 */
function parseHttpUrl(raw: string): URL | null {
  if (!raw) return null;
  for (const candidate of [raw, `https://${raw}`]) {
    try {
      const url = new URL(candidate);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url;
      return null;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** True when the URL's hostname is exactly `host` or a subdomain of it. */
export function urlHostMatches(raw: string, hosts: string[]): boolean {
  const url = parseHttpUrl(raw);
  if (!url) return false;
  const hostname = url.hostname.toLowerCase();
  return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

export type VideoKind = 'youtube' | 'vimeo';

/** Classify by parsed hostname, never by substring. */
export function getVideoKind(raw: string): VideoKind | null {
  const url = parseHttpUrl(raw);
  if (!url) return null;
  const hostname = url.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.includes(hostname)) return 'youtube';
  if (VIMEO_HOSTS.includes(hostname)) return 'vimeo';
  return null;
}

/**
 * Canonical embed URL for a YouTube/Vimeo page, share, or embed link — or
 * null when the input is not verifiably one of those. The output is always
 * `https://www.youtube.com/embed/<id>` or `https://player.vimeo.com/video/<id>`
 * built from scratch; no byte of the input URL survives except the validated
 * ID (and, for unlisted Vimeo links, the hex access hash).
 */
export function toVideoEmbedUrl(raw: string): string | null {
  const url = parseHttpUrl(raw);
  if (!url) return null;
  const hostname = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (YOUTUBE_HOSTS.includes(hostname)) {
    let id: string | undefined;
    if (hostname === 'youtu.be') {
      id = segments[0];
    } else if (['embed', 'shorts', 'live', 'v'].includes(segments[0] ?? '')) {
      id = segments[1];
    } else {
      id = url.searchParams.get('v') ?? undefined;
    }
    if (id && YOUTUBE_ID.test(id)) {
      return `https://www.youtube.com/embed/${id}`;
    }
    return null;
  }

  if (VIMEO_HOSTS.includes(hostname)) {
    const id = segments[0] === 'video' ? segments[1] : segments[0];
    if (!id || !VIMEO_ID.test(id)) return null;
    // Unlisted videos carry an access hash as ?h= or as a second path segment.
    const hash = url.searchParams.get('h') ?? (segments[0] === 'video' ? segments[2] : segments[1]);
    if (hash && VIMEO_HASH.test(hash)) {
      return `https://player.vimeo.com/video/${id}?h=${hash}`;
    }
    return `https://player.vimeo.com/video/${id}`;
  }

  return null;
}
