// ABOUTME: Read-only adapter from a saved video node src to what the player may frame.
// ABOUTME: Never rewrites stored content; decides only what is rendered at view time.

import { getVideoKind, toVideoEmbedUrl, type VideoKind } from '@/utils/videoUrls';

/**
 * Hosts whose embed URLs may be framed verbatim. Mirrors ALLOWED_EMBED_HOSTS in
 * src/utils/sanitize.ts and the CSP frameSrc list in src/config/security.ts, so
 * a src framed here is one the sanitizer and the browser would also accept.
 */
const VERBATIM_EMBED_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
]);

export type ResolvedEmbed =
  | {
      status: 'supported';
      provider: VideoKind;
      providerLabel: string;
      /** What the iframe loads. Equal to the saved src whenever that is safe. */
      frameSrc: string;
      /** True when frameSrc is byte-identical to the saved src. */
      verbatim: boolean;
      /** Provider page for the same video, offered as a fallback link. */
      watchUrl: string;
    }
  | {
      status: 'unsupported';
      reason: 'missing' | 'not-allowed';
    };

const PROVIDER_LABEL: Record<VideoKind, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
};

function watchUrlFor(canonical: string, provider: VideoKind): string {
  const url = new URL(canonical);
  const segments = url.pathname.split('/').filter(Boolean);
  if (provider === 'youtube') {
    // canonical: https://www.youtube.com/embed/<id>
    return `https://www.youtube.com/watch?v=${segments[1]}`;
  }
  // canonical: https://player.vimeo.com/video/<id>[?h=<hash>]
  const hash = url.searchParams.get('h');
  return hash ? `https://vimeo.com/${segments[1]}/${hash}` : `https://vimeo.com/${segments[1]}`;
}

/**
 * Resolve a saved video src for display.
 *
 * - The provider and video ID are validated by toVideoEmbedUrl (hostname
 *   allowlist plus strict ID/hash character classes). Anything it rejects is
 *   `unsupported` and is never framed.
 * - When the saved src is already an https embed URL on an allowlisted host
 *   for that same validated video, it is framed verbatim, so stored query
 *   parameters, the privacy-enhanced youtube-nocookie origin and the unlisted
 *   Vimeo hash all survive exactly.
 * - Otherwise (a watch/share link saved by an older path, or http:) the
 *   canonical embed URL rebuilt from the validated ID is framed instead.
 */
export function resolveEmbed(savedSrc: string | null | undefined): ResolvedEmbed {
  const raw = typeof savedSrc === 'string' ? savedSrc.trim() : '';
  if (!raw) return { status: 'unsupported', reason: 'missing' };

  const canonical = toVideoEmbedUrl(raw);
  const provider = getVideoKind(raw);
  if (!canonical || !provider) return { status: 'unsupported', reason: 'not-allowed' };

  let verbatim = false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const segments = url.pathname.split('/').filter(Boolean);
    const canonicalId = new URL(canonical).pathname.split('/').filter(Boolean)[1];
    const isEmbedPath =
      provider === 'youtube'
        ? segments[0] === 'embed' && segments[1] === canonicalId && segments.length === 2
        : host === 'player.vimeo.com' &&
          segments[0] === 'video' &&
          segments[1] === canonicalId &&
          segments.length === 2 &&
          // An unlisted hash is framed verbatim only when it passed validation.
          url.searchParams.get('h') === new URL(canonical).searchParams.get('h');
    verbatim =
      url.protocol === 'https:' &&
      VERBATIM_EMBED_HOSTS.has(host) &&
      isEmbedPath &&
      url.username === '' &&
      url.password === '' &&
      url.port === '';
  } catch {
    verbatim = false;
  }

  return {
    status: 'supported',
    provider,
    providerLabel: PROVIDER_LABEL[provider],
    frameSrc: verbatim ? raw : canonical,
    verbatim,
    watchUrl: watchUrlFor(canonical, provider),
  };
}

/** Accessible name for the frame: the author's saved title, else "<Provider> video". */
export function accessibleVideoName(title: string | null | undefined, providerLabel: string): string {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  return trimmed || `${providerLabel} video`;
}
