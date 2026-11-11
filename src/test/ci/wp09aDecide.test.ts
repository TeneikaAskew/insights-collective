// ABOUTME: Pure controls for the WP-09A stubbed video spec's request routing (e2e/stubbed/wp09a-decide.ts).
// ABOUTME: Vitest only, no browser: kept out of the sealed Playwright collection, which must hold exactly 24 browser tests.
import { describe, expect, it } from 'vitest';
import { API_ORIGIN, LANE_ORIGIN, SLOW_ID, assertLoopbackBase, decide } from '../../../e2e/stubbed/wp09a-decide';

const O = LANE_ORIGIN;

describe('wp09a decide(): pure routing controls', () => {
  it('assertLoopbackBase accepts exactly the lane origin', () => {
    expect(assertLoopbackBase('http://127.0.0.1:8080')).toBe(O);
    expect(assertLoopbackBase('http://127.0.0.1:8080/x')).toBe(O);
    for (const bad of [undefined, '', 'https://127.0.0.1:8080', 'http://127.0.0.1:4317', 'http://localhost:8080', 'http://[::1]:8080',
      'http://10.0.0.5:8080', 'http://example.com', 'http://127.0.0.1.example.com', 'http://u:p@127.0.0.1:8080']) {
      expect(() => assertLoopbackBase(bad), String(bad)).toThrow();
    }
  });

  it('checks the method before the origin, for every origin', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(decide(m, `${O}/assets/x.js`, O), `${m} same-origin`).toBe('abort');
      expect(decide(m, `${API_ORIGIN}/rest/v1/courses`, O), `${m} api`).toBe('abort');
      expect(decide(m, 'https://www.youtube.com/embed/AAAAAAAAAAA', O), `${m} provider`).toBe('abort');
    }
  });

  it('routes the API by exact origin equality only', () => {
    expect(decide('GET', 'https://sealed-video.invalid/rest/v1/courses', O)).toBe('api');
    expect(decide('HEAD', 'https://sealed-video.invalid/auth/v1/user', O)).toBe('api');
    for (const notApi of [
      'https://sealed-video.invalid.evil.example/rest/v1/courses',
      'https://x.sealed-video.invalid/rest/v1/courses',
      'http://sealed-video.invalid/rest/v1/courses',
      'https://sealed-video.invalid:8443/rest/v1/courses',
      'https://abc.supabase.co/rest/v1/courses',
      'https://abc.supabase.in/rest/v1/courses',
      'http://127.0.0.1:54321/rest/v1/courses',
    ]) {
      expect(decide('GET', notApi, O), notApi).not.toBe('api');
      expect(decide('GET', notApi, O), notApi).toBe('abort');
    }
  });

  it('routes the remaining GET and HEAD requests by origin and host', () => {
    expect(decide('GET', `${O}/courses/x`, O)).toBe('continue-loopback');
    expect(decide('HEAD', `${O}/`, O)).toBe('continue-loopback');
    expect(decide('GET', 'http://127.0.0.1:9999/', O)).toBe('abort');
    expect(decide('GET', 'http://localhost:8080/', O)).toBe('abort');
    expect(decide('GET', 'https://www.youtube-nocookie.com/embed/AAAAAAAAAAA', O)).toBe('provider');
    expect(decide('GET', 'https://player.vimeo.com/video/123456789', O)).toBe('provider');
    expect(decide('GET', 'http://player.vimeo.com/video/123456789', O)).toBe('abort');
    expect(decide('GET', `https://www.youtube.com/embed/${SLOW_ID}`, O)).toBe('hold');
    expect(decide('GET', 'https://media.example.invalid/x', O)).toBe('abort');
    expect(decide('GET', 'https://fonts.googleapis.com/css', O)).toBe('abort');
  });
});
