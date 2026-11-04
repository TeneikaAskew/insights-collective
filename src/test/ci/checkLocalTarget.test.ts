import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDist, checkEnv } from '../../../scripts/ci/check-local-target.mjs';

// Credential-bearing test DSNs are assembled from parts so no tracked line carries a
// `scheme://user:password@host` literal: the repository secret scan (TruffleHog in security.yml) reports that
// shape even for one-letter placeholder passwords, and a flagged commit range stays flagged for the life of the
// branch. src/test/__tests__/noCredentialShapedLiterals.test.ts enforces this for every tracked file.
const uri = (user: string, pw: string, rest: string) => ['postgresql:', '//', user, ':', pw, '@', rest].join('');

const REF = 'abcdefghijklmnopqrst';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: object) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.c2lnbmF0dXJlLXNpZ25hdHVyZQ`;
const LOCAL_KEY = jwt({ iss: 'supabase-demo', role: 'anon', exp: 1983812996 });
const HOSTED_KEY = jwt({ iss: 'supabase', ref: REF, role: 'anon', iat: 1, exp: 2 });
const good = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321', E2E_RELAY_TARGET: 'http://127.0.0.1:54321',
  SUPABASE_DB_URL: uri('postgres', 'postgres', '127.0.0.1:54322/postgres'), E2E_BASE_URL: 'http://127.0.0.1:8080',
  VITE_SUPABASE_ANON_KEY: LOCAL_KEY, VITE_SUPABASE_PUBLISHABLE_KEY: LOCAL_KEY,
};

describe('check-local-target env', () => {
  it('accepts loopback targets with the same local anon key under both names', () => {
    expect(checkEnv(good, REF)).toEqual([]);
  });
  it.each([
    ['only the publishable name set (the previous workflow)', { VITE_SUPABASE_ANON_KEY: undefined }, /ANON_KEY is unset/],
    ['only the anon name set', { VITE_SUPABASE_PUBLISHABLE_KEY: undefined }, /PUBLISHABLE_KEY is unset/],
    ['different keys', { VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ iss: 'supabase-demo', role: 'anon', exp: 3 }) }, /differ/],
    ['a hosted-project key', { VITE_SUPABASE_ANON_KEY: HOSTED_KEY, VITE_SUPABASE_PUBLISHABLE_KEY: HOSTED_KEY }, /hosted-project key/],
    ['a service-role key', { VITE_SUPABASE_ANON_KEY: jwt({ iss: 'supabase-demo', role: 'service_role' }), VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ iss: 'supabase-demo', role: 'service_role' }) }, /not an anon key/],
    ['a remote API URL', { VITE_SUPABASE_URL: 'https://example.org' }, /VITE_SUPABASE_URL is not loopback/],
    ['a remote base URL', { E2E_BASE_URL: 'https://example.org' }, /E2E_BASE_URL is not loopback/],
    ['the production ref in any variable', { SOMETHING: `x-${REF}` }, /production ref present in: SOMETHING/],
    ['a service role key variable', { SUPABASE_SERVICE_ROLE_KEY: 'x' }, /SERVICE_ROLE_KEY must not be set/],
  ])('refuses %s', (_n, change, expected) => {
    const env: Record<string, string | undefined> = { ...good, ...change };
    for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
    expect(checkEnv(env, REF).some((p: string) => expected.test(p))).toBe(true);
  });
});

describe('check-local-target dist', () => {
  const build = (files: Record<string, string>) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dist-'));
    for (const [f, text] of Object.entries(files)) { mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); writeFileSync(path.join(dir, f), text); }
    return dir;
  };
  it('accepts a build with the local URL, ignoring source maps that embed the fallback source', () => {
    const dir = build({ 'index.html': '<div id="root"></div>', 'assets/client.js': 'const u="http://127.0.0.1:54321";', 'assets/client.js.map': `"https://${REF}.supabase.co"` });
    expect(checkDist(dir, REF, 'http://127.0.0.1:54321')).toEqual([]);
  });
  it('refuses a build whose JS still carries the production URL', () => {
    const dir = build({ 'assets/client.js': `const u="http://127.0.0.1:54321"||"https://${REF}.supabase.co";` });
    expect(checkDist(dir, REF, 'http://127.0.0.1:54321')).toEqual(['assets/client.js contains the production ref']);
  });
  it('refuses a build that embeds a hosted-project key', () => {
    const dir = build({ 'assets/client.js': `const u="http://127.0.0.1:54321",k="${HOSTED_KEY}";` });
    expect(checkDist(dir, REF, 'http://127.0.0.1:54321').some((p: string) => /hosted-project key/.test(p))).toBe(true);
  });
  it('refuses a build that does not contain the local URL, and an empty build', () => {
    expect(checkDist(build({ 'assets/a.js': 'x' }), REF, 'http://127.0.0.1:54321')).toEqual(['the build does not contain the local API URL http://127.0.0.1:54321']);
    expect(checkDist(build({ 'a.txt': 'x' }), REF, 'http://127.0.0.1:54321')[0]).toMatch(/no built JS/);
  });
});
