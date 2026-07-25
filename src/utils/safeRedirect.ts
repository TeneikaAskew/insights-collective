// ABOUTME: Normalizes user-supplied post-login redirect targets to same-origin paths
// ABOUTME: Prevents open redirects from ?redirect=, location.state, and localStorage

/** Where to send a user whose requested redirect target was not usable. */
export const DEFAULT_REDIRECT = '/dashboard';

/**
 * Reduce an untrusted redirect target to a path that cannot leave this origin.
 *
 * Redirect targets reach the app from `?redirect=`, router `location.state`, and
 * `localStorage`, and are ultimately handed to `navigate()`. React Router's history
 * falls back to `window.location.assign(url)` when `pushState` rejects a value —
 * which is exactly what happens for a cross-origin URL — so an unchecked target is
 * a real off-origin redirect, not merely a broken in-app route.
 *
 * Returns `fallback` for anything that is not a plain internal path. Rejected forms
 * include absolute URLs (`https://evil.com`), protocol-relative URLs (`//evil.com`),
 * scheme-like values (`javascript:...`), and backslash variants (`/\evil.com`,
 * `\\evil.com`) — browsers normalize backslashes to forward slashes, which is the
 * bypass behind CVE-2026-53669.
 */
export function safeInternalPath(
  candidate: unknown,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (typeof candidate !== 'string' || candidate === '') return fallback;

  // Browsers treat backslashes as forward slashes in URLs, so collapse them
  // before testing rather than trying to spot each disguised form separately.
  const normalized = candidate.replace(/\\/g, '/');

  // Must be a rooted path. This also rejects absolute URLs and scheme-like
  // values, since neither begins with "/".
  if (!normalized.startsWith('/')) return fallback;

  // "//host" is protocol-relative and leaves the origin.
  if (normalized.startsWith('//')) return fallback;

  // Resolve against a placeholder origin: anything that still escapes it is not
  // an internal path. Re-serializing also drops traversal segments.
  try {
    const base = 'https://internal.invalid';
    const resolved = new URL(normalized, base);
    if (resolved.origin !== base) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
