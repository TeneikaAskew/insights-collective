// ABOUTME: Covers which Supabase URLs the config accepts and which it refuses.
// ABOUTME: The rejection cases are the point — this guard protects credentials in transit.

import { describe, it, expect } from 'vitest';
import { isAllowedSupabaseUrl } from '../security';

describe('isAllowedSupabaseUrl', () => {
  it('accepts the hosted project over HTTPS', () => {
    expect(isAllowedSupabaseUrl('https://siuqvhscuiycvdrtiqsh.supabase.co')).toBe(true);
  });

  /**
   * `supabase start` — documented in CLAUDE.md — serves the local stack on
   * http://127.0.0.1:54321, and scripts/e2e/supabase-relay.mjs serves on a
   * loopback port. Neither leaves the machine, so neither can be intercepted.
   */
  it.each([
    'http://127.0.0.1:54321',
    'http://localhost:54321',
    'http://[::1]:54321',
    'http://127.0.0.1:39191',
  ])('accepts loopback over plain HTTP: %s', (url) => {
    expect(isAllowedSupabaseUrl(url)).toBe(true);
  });

  it.each([
    ['a remote host in the clear', 'http://siuqvhscuiycvdrtiqsh.supabase.co'],
    ['a plain-HTTP attacker host', 'http://evil.com'],
    // Looks local, resolves anywhere. Substring matching on "localhost" would
    // wave this through, which is why the check parses the URL and compares the
    // hostname exactly.
    ['a hostname that only looks local', 'http://localhost.evil.com'],
    ['a subdomain of a loopback-looking name', 'http://127.0.0.1.evil.com'],
    ['a non-web protocol', 'ftp://127.0.0.1'],
    ['a file URL', 'file:///etc/passwd'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['something that is not a URL at all', 'not-a-url'],
    ['an empty string', ''],
  ])('rejects %s', (_label, url) => {
    expect(isAllowedSupabaseUrl(url)).toBe(false);
  });
});
