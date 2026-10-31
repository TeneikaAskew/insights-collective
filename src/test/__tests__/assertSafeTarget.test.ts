// ABOUTME: Unit tests for the fail-closed E2E target guard: loopback and the named isolated
// ABOUTME: project pass; production, look-alikes, pooler tricks and unset values are refused.
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain ESM script without type declarations
import { assessTarget, classifyTarget } from '../../../scripts/e2e/assert-safe-target.mjs';

const PROD = 'siuqvhscuiycvdrtiqsh';
const ISO = 'abcdefghijklmnopqrst';
// Credential-bearing test DSNs are assembled from parts so no tracked line carries a
// `scheme://user:password@host` literal: the repository secret scan (TruffleHog in security.yml) reports that
// shape even for one-letter placeholder passwords, and a flagged commit range stays flagged for the life of the
// branch. src/test/__tests__/noCredentialShapedLiterals.test.ts enforces this for every tracked file.
const uri = (user: string, pw: string, rest: string) => ['postgresql:', '//', user, ':', pw, '@', rest].join('');
const base = (over: Record<string, string | undefined> = {}) => ({
  VITE_SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_DB_URL: 'postgresql://postgres@127.0.0.1:54329/ic_snapshot',
  E2E_RELAY_TARGET: 'http://localhost:54321',
  ...over,
});
const run = (env: Record<string, string | undefined>, mutating = true) =>
  assessTarget({ mutating, env: env as NodeJS.ProcessEnv, prod: PROD });

describe('assert-safe-target', () => {
  it('accepts loopback targets in mutating mode', () => {
    expect(run(base()).ok).toBe(true);
  });

  it('refuses when any target is unset (the code default is production)', () => {
    for (const name of ['VITE_SUPABASE_URL', 'SUPABASE_DB_URL', 'E2E_RELAY_TARGET']) {
      const r = run(base({ [name]: undefined }));
      expect(r.ok, name).toBe(false);
      expect(r.reason).toContain(name);
    }
  });

  it('refuses the production project by host and by pooler user', () => {
    expect(run(base({ VITE_SUPABASE_URL: `https://${PROD}.supabase.co` })).ok).toBe(false);
    expect(run(base({ SUPABASE_DB_URL: uri(`postgres.${PROD}`, `x`, `aws-0-us-east-1.pooler.supabase.com:6543/postgres`) })).ok).toBe(false);
    expect(run(base({ SUPABASE_DB_URL: uri(`postgres`, `x`, `db.${PROD}.supabase.co:5432/postgres`) })).ok).toBe(false);
  });

  it('refuses deceptive look-alike hosts and anything containing the production ref', () => {
    const bad = [
      `https://${PROD}.supabase.co.attacker.example`,
      `https://attacker.example/${PROD}`,
      `https://localhost.attacker.example`,
      `postgresql://localhost@attacker.example/postgres`,
      `https://127.0.0.1.attacker.example`,
      `https://10.0.0.5:5432`,
      `postgresql://postgres@%6cocalhost:5432/db`,
      `https://${PROD.toUpperCase()}.supabase.co`,
      `not a url`,
      `https://${PROD}.supabase.co?x=1#localhost`,
    ];
    for (const v of bad) {
      expect(run(base({ SUPABASE_DB_URL: v })).ok, v).toBe(false);
    }
  });

  it('accepts a non-production Supabase project only when E2E_ISOLATED_TARGET_REF names it', () => {
    const iso = {
      VITE_SUPABASE_URL: `https://${ISO}.supabase.co`,
      SUPABASE_DB_URL: uri(`postgres.${ISO}`, `x`, `aws-0-eu-west-1.pooler.supabase.com:6543/postgres`),
      E2E_RELAY_TARGET: `https://${ISO}.supabase.co`,
    };
    expect(run(iso).ok).toBe(false); // ref not declared → refused
    expect(run({ ...iso, E2E_ISOLATED_TARGET_REF: ISO }).ok).toBe(true);
    expect(run({ ...iso, E2E_ISOLATED_TARGET_REF: 'zzzzzzzzzzzzzzzzzzzz' }).ok).toBe(false);
    expect(run({ ...iso, E2E_ISOLATED_TARGET_REF: PROD }).ok).toBe(false);
    // isolated ref declared, but one variable still points at production
    expect(run({ ...iso, E2E_ISOLATED_TARGET_REF: ISO, SUPABASE_DB_URL: uri(`postgres`, `x`, `db.${PROD}.supabase.co:5432/postgres`) }).ok).toBe(false);
  });

  it('refuses a mixed set where one target is production and the rest loopback', () => {
    expect(run(base({ E2E_RELAY_TARGET: `https://${PROD}.supabase.co` })).ok).toBe(false);
  });

  it('refuses when VITE_SUPABASE_PROJECT_ID is the production ref', () => {
    expect(run(base({ VITE_SUPABASE_PROJECT_ID: PROD })).ok).toBe(false);
  });

  it('has no opt-in: no environment value makes production acceptable for a mutating run', () => {
    const prodEnv = { VITE_SUPABASE_URL: `https://${PROD}.supabase.co`, SUPABASE_DB_URL: uri(`postgres`, `x`, `db.${PROD}.supabase.co:5432/postgres`), E2E_RELAY_TARGET: `https://${PROD}.supabase.co` };
    for (const v of ['yes', 'true', PROD, 'I_UNDERSTAND', '1']) {
      expect(run({ ...prodEnv, E2E_ALLOW_PRODUCTION_TARGET: v }).ok, v).toBe(false);
      expect(run({ ...prodEnv, E2E_ISOLATED_TARGET_REF: PROD, E2E_ALLOW_PRODUCTION_TARGET: v }).ok, v).toBe(false);
    }
  });

  it('never blocks in read-only mode', () => {
    expect(run({}, false).ok).toBe(true);
  });

  it('evaluates SUPABASE_DB_URL as a libpq DSN: query/fragment/multihost redirections are refused', () => {
    const redirects = [
      'postgresql://u@localhost:5432/db?hostaddr=203.0.113.9',
      'postgresql://u@localhost:5432/db?host=remote.example',
      'postgresql://u@localhost:5432/db?service=production',
      'postgresql://u@localhost:5432/db#?host=remote.example',
      'postgresql://u@localhost:5432/db#?hostaddr=203.0.113.9',
      'postgresql://u@localhost/db%3F?host=remote.example',
      'postgresql://a@b@localhost/db',
      'postgresql://u@localhost,remote.example/db',
      'host=localhost hostaddr=203.0.113.9 dbname=db',
      'postgresql://127.0.0.1@remote.example/db',
      'postgresql:///db',
      'postgresql://u@localhost/db?options=-c%20x',
      'postgresql://u@localhost/db?passfile=/tmp/x',
      'postgresql://u@LOCALHOST/db',
    ];
    for (const dsn of redirects) {
      const r = run(base({ SUPABASE_DB_URL: dsn }));
      expect(r.ok, dsn).toBe(false);
      expect(r.targets.find((t: { name: string }) => t.name === 'SUPABASE_DB_URL')?.verdict, dsn).toBe('refused');
    }
    expect(run(base({ SUPABASE_DB_URL: 'host=127.0.0.1 port=54329 dbname=db user=postgres' })).ok).toBe(true);
  });

  it('refuses API targets carrying userinfo, query or fragment', () => {
    for (const v of ['http://u@localhost:54321', 'http://localhost:54321/?x=1', 'http://localhost:54321/#frag', 'ftp://localhost']) {
      expect(run(base({ VITE_SUPABASE_URL: v })).ok, v).toBe(false);
    }
  });

  it('classifies API hosts, and the libpq evaluator redacts credentials', () => {
    expect(classifyTarget('http://localhost:54321').kind).toBe('loopback');
    expect(classifyTarget(`https://${PROD}.supabase.co`).kind).toBe('supabase');
    const r = run(base({ SUPABASE_DB_URL: uri('postgres', 'SECRET', '127.0.0.1:5432/db') }));
    expect(r.ok).toBe(true);
    const t = r.targets.find((x: { name: string }) => x.name === 'SUPABASE_DB_URL');
    expect(t.shown).toContain('password=<redacted>');
    expect(JSON.stringify(r)).not.toContain('SECRET');
  });

  it('never echoes a database credential in any target verdict', () => {
    const S = 'SYNTHETIC_SECRET!';
    for (const dsn of [`host=localhost password=${S}`, uri(`u`, `${S}`, `remote.example/db`), uri(`u`, `${S}`, `localhost/db?host=remote.example`), uri(`u`, `${S}`, `127.0.0.1:5432/db`)]) {
      const r = run(base({ SUPABASE_DB_URL: dsn }));
      expect(JSON.stringify(r), dsn).not.toContain(S);
    }
  });
});
