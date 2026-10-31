// ABOUTME: Unit tests for the fail-closed E2E target guard: loopback and the named isolated
// ABOUTME: project pass; production, look-alikes, pooler tricks and unset values are refused.
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain ESM script without type declarations
import { assessTarget, classifyTarget } from '../../../scripts/e2e/assert-safe-target.mjs';

const PROD = 'siuqvhscuiycvdrtiqsh';
const ISO = 'abcdefghijklmnopqrst';
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
    expect(run(base({ SUPABASE_DB_URL: `postgresql://postgres.${PROD}:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres` })).ok).toBe(false);
    expect(run(base({ SUPABASE_DB_URL: `postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres` })).ok).toBe(false);
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
      SUPABASE_DB_URL: `postgresql://postgres.${ISO}:x@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
      E2E_RELAY_TARGET: `https://${ISO}.supabase.co`,
    };
    expect(run(iso).ok).toBe(false); // ref not declared → refused
    expect(run({ ...iso, E2E_ISOLATED_TARGET_REF: ISO }).ok).toBe(true);
    expect(run({ ...iso, E2E_ISOLATED_TARGET_REF: 'zzzzzzzzzzzzzzzzzzzz' }).ok).toBe(false);
    expect(run({ ...iso, E2E_ISOLATED_TARGET_REF: PROD }).ok).toBe(false);
    // isolated ref declared, but one variable still points at production
    expect(run({ ...iso, E2E_ISOLATED_TARGET_REF: ISO, SUPABASE_DB_URL: `postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres` }).ok).toBe(false);
  });

  it('refuses a mixed set where one target is production and the rest loopback', () => {
    expect(run(base({ E2E_RELAY_TARGET: `https://${PROD}.supabase.co` })).ok).toBe(false);
  });

  it('refuses when VITE_SUPABASE_PROJECT_ID is the production ref', () => {
    expect(run(base({ VITE_SUPABASE_PROJECT_ID: PROD })).ok).toBe(false);
  });

  it('has no opt-in: no environment value makes production acceptable for a mutating run', () => {
    const prodEnv = { VITE_SUPABASE_URL: `https://${PROD}.supabase.co`, SUPABASE_DB_URL: `postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres`, E2E_RELAY_TARGET: `https://${PROD}.supabase.co` };
    for (const v of ['yes', 'true', PROD, 'I_UNDERSTAND', '1']) {
      expect(run({ ...prodEnv, E2E_ALLOW_PRODUCTION_TARGET: v }).ok, v).toBe(false);
      expect(run({ ...prodEnv, E2E_ISOLATED_TARGET_REF: PROD, E2E_ALLOW_PRODUCTION_TARGET: v }).ok, v).toBe(false);
    }
  });

  it('never blocks in read-only mode', () => {
    expect(run({}, false).ok).toBe(true);
  });

  it('classifies hosts without leaking credentials', () => {
    const c = classifyTarget('postgresql://postgres:SECRET@127.0.0.1:5432/db');
    expect(c.kind).toBe('loopback');
    expect(c.shown).not.toContain('SECRET');
  });
});
