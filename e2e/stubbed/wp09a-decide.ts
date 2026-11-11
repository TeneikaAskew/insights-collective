// ABOUTME: Pure request-routing decision for the WP-09A stubbed video spec. No Playwright import: unit-tested under vitest
// ABOUTME: (src/test/ci/wp09aDecide.test.ts) and imported by e2e/stubbed/wp09a-video-embed.spec.ts.

/** The only app origin the spec accepts: the sealed lane's forwarder. */
export const LANE_ORIGIN = 'http://127.0.0.1:8080';
/** The synthetic API origin the sealed video build compiles in (design r2 section 4); stubbed by exact origin equality. */
export const API_ORIGIN = 'https://sealed-video.invalid';
export const PROVIDER_HOSTS: ReadonlySet<string> = new Set(['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com', 'player.vimeo.com']);
/** The YouTube id whose fake provider request is held unanswered (the slow case). */
export const SLOW_ID = 'SLOWSLOWSLO';

export type Decision = 'abort' | 'continue-loopback' | 'api' | 'provider' | 'hold';

/** Throws unless baseURL is exactly the lane origin (optionally with a path). Same-origin continue relies on this. */
export function assertLoopbackBase(baseURL: string | undefined): string {
  if (!baseURL) throw new Error('baseURL is required');
  const u = new URL(baseURL);
  if (u.origin !== LANE_ORIGIN || u.username || u.password) {
    throw new Error(`baseURL must be exactly ${LANE_ORIGIN}, got ${u.protocol}//${u.host}`);
  }
  return u.origin;
}

/** Routing decision for one request. The method is checked before the origin, for every origin. */
export function decide(method: string, rawUrl: string, origin: string): Decision {
  if (method !== 'GET' && method !== 'HEAD') return 'abort';
  const url = new URL(rawUrl);
  if (url.origin === origin) return 'continue-loopback';
  if (url.origin === API_ORIGIN) return 'api';
  if (url.protocol !== 'https:') return 'abort';
  if (PROVIDER_HOSTS.has(url.hostname)) return url.pathname.includes(SLOW_ID) ? 'hold' : 'provider';
  return 'abort';
}
