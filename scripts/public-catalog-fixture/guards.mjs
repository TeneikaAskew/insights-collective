#!/usr/bin/env node
// ABOUTME: PRE guards for the anonymous public-catalog acceptance. Fail closed, before any seed, browser or HTTP call:
// ABOUTME: loopback-only targets (consumes scripts/e2e/assert-safe-target.mjs --mutating), a canonical DB DSN plus private
// ABOUTME: passfile, an anon key, and an owned-stack proof read by the no-follow consumer in proof.mjs (BLOCKED: no producer).
//
// This lane is LOOPBACK ONLY: unlike the shared guard it never accepts an isolated hosted project, so a set
// E2E_ISOLATED_TARGET_REF is itself a refusal. Secrets are never printed.
import { assessTarget } from '../e2e/assert-safe-target.mjs';
import { checkStackProof } from './proof.mjs';
import { checkDb } from './pgconn.mjs';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
export const E = {
  NOT_LOOPBACK: 'PUBLIC_CATALOG_E_NOT_LOOPBACK',
  SHARED_GUARD: 'PUBLIC_CATALOG_E_SHARED_GUARD',
  ISOLATED_REF: 'PUBLIC_CATALOG_E_ISOLATED_REF_SET',
  NO_KEY: 'PUBLIC_CATALOG_E_NO_ANON_KEY',
  TIER: 'PUBLIC_CATALOG_E_TIER',
};

function loopbackHttpOrigin(name, raw) {
  let u;
  try { u = new URL(String(raw ?? '')); } catch { return `${E.NOT_LOOPBACK}: ${name} is not a URL`; }
  if (u.protocol !== 'http:') return `${E.NOT_LOOPBACK}: ${name} must be plain http on loopback`;
  if (u.username || u.password || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) return `${E.NOT_LOOPBACK}: ${name} must be a bare origin`;
  if (!LOOPBACK.has(u.hostname) || !/^\d+$/.test(u.port)) return `${E.NOT_LOOPBACK}: ${name} host must be loopback with an explicit port`;
  return null;
}

export function runGuards(env = process.env) {
  const errors = [];
  for (const name of ['PUBLIC_ACCEPT_BASE_URL', 'PUBLIC_ACCEPT_API_URL']) {
    const e = loopbackHttpOrigin(name, env[name]); if (e) errors.push(e);
  }
  if ((env.E2E_ISOLATED_TARGET_REF || '').trim()) errors.push(`${E.ISOLATED_REF}: this lane is loopback only`);
  const shared = assessTarget({
    mutating: true,
    env: { VITE_SUPABASE_URL: env.PUBLIC_ACCEPT_API_URL, SUPABASE_DB_URL: env.PUBLIC_ACCEPT_DB_URL, E2E_RELAY_TARGET: env.PUBLIC_ACCEPT_API_URL },
  });
  if (!shared.ok) errors.push(`${E.SHARED_GUARD}: ${shared.reason}`);
  else if (shared.targets.some((t) => t.kind !== 'loopback' && t.kind !== 'libpq')) errors.push(`${E.NOT_LOOPBACK}: shared guard accepted a non-loopback target`);
  if (!/^[A-Za-z0-9._-]{20,}$/.test(env.PUBLIC_ACCEPT_ANON_KEY || '')) errors.push(`${E.NO_KEY}: PUBLIC_ACCEPT_ANON_KEY is missing or malformed`);
  // There is one tier. The old rehearsal tolerance for known third-party attempts is gone: any foreign attempt fails.
  if (env.PUBLIC_ACCEPT_TIER !== undefined && env.PUBLIC_ACCEPT_TIER !== 'authentic') errors.push(`${E.TIER}: only the authentic tier exists`);
  errors.push(...checkDb(env));
  const proof = checkStackProof(env.PUBLIC_ACCEPT_STACK_PROOF, env.PUBLIC_ACCEPT_RUN_ID); if (proof) errors.push(proof);
  return errors;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const errors = runGuards();
  if (errors.length) { for (const e of errors) console.error(e.split(':')[0]); process.exit(2); }
  console.log('PUBLIC_CATALOG_GUARDS_OK');
}
