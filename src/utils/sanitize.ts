// ABOUTME: DOMPurify-based HTML sanitization utility for safe dangerouslySetInnerHTML rendering
// ABOUTME: Prevents XSS attacks by sanitizing all user-controlled HTML content before rendering

import DOMPurify from 'dompurify';

// Hosts allowed as <iframe> / <video><source> sources. Kept in sync with the
// CSP frameSrc allowlist in src/config/security.ts so an embed that passes the
// sanitizer would also be permitted to load by the browser.
const ALLOWED_EMBED_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
];

const hostIsAllowed = (src: string): boolean => {
  try {
    const base =
      typeof window !== 'undefined' ? window.location.origin : 'https://insightscollective.org';
    const host = new URL(src, base).hostname.toLowerCase();
    return ALLOWED_EMBED_HOSTS.includes(host);
  } catch {
    return false;
  }
};

// Register a one-time hook that drops any <iframe> whose src is not on the
// embed allowlist. Previously the sanitizer allowed <iframe> with an arbitrary
// src, so stored blog content could embed a hostile frame. The hook is
// idempotent and only ever removes disallowed frames.
let hooksRegistered = false;
const ensureHooks = () => {
  if (hooksRegistered || typeof (DOMPurify as any).addHook !== 'function') return;
  hooksRegistered = true;
  DOMPurify.addHook('uponSanitizeElement', (node: any, data: any) => {
    if (data.tagName !== 'iframe') return;
    const src = node.getAttribute?.('src') || '';
    if (!hostIsAllowed(src)) {
      node.parentNode?.removeChild(node);
    }
  });
};

/**
 * Sanitize HTML content for safe rendering via dangerouslySetInnerHTML.
 * Allows common formatting tags while stripping dangerous content. <iframe>
 * embeds are restricted to an allowlist of trusted video hosts.
 *
 * This is the ONLY HTML sanitizer in the codebase — the TipTap editors
 * (BlogEditor, unified-canvas-editor) run their output through it on every
 * update, and blog/lesson renderers pass stored content through it before
 * dangerouslySetInnerHTML. It replaced a second, regex-based sanitizer in
 * securityUtils.ts whose single-pass strips CodeQL correctly flagged as
 * bypassable (js/bad-tag-filter, js/incomplete-multi-character-sanitization):
 * regexes cannot parse nested or malformed tags, and `<scr<script>ipt>`
 * survives a one-shot replace. DOMPurify parses.
 *
 * The tag/attr allowlist must cover everything the editors' TipTap extensions
 * emit, because sanitisation runs while the user types — a missing tag here
 * silently deletes content mid-keystroke. StarterKit + Highlight (<mark>),
 * Underline, Image, Link, Table (colspan/rowspan/colwidth), TextAlign and
 * Color (style) are all represented; extend this list when adding extensions.
 */
export const sanitizeHTML = (dirty: string): string => {
  if (!dirty) return '';

  ensureHooks();

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'del', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'code', 'pre', 'blockquote',
      'span', 'div', 'img', 'hr', 'mark',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'video', 'source', 'audio',
      'iframe',
    ],
    ALLOWED_ATTR: [
      'href', 'class', 'className', 'target', 'rel',
      'src', 'alt', 'width', 'height', 'style',
      'value', 'controls', 'allowfullscreen',
      'allow', 'frameborder', 'title',
      'data-youtube-video',
      'colspan', 'rowspan', 'colwidth',
    ],
    // DOMPurify's documented safe default: permits http(s)/mailto/tel absolute
    // URLs, relative URLs, and anchors while rejecting javascript:/data: URIs.
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target'],
  });
};
