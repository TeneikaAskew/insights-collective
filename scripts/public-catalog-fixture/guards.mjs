#!/usr/bin/env node
// ABOUTME: PRE guards for the anonymous public-catalog acceptance. Fail closed, before any seed, browser or HTTP call:
// ABOUTME: loopback-only targets (consumes scripts/e2e/assert-safe-target.mjs --mutating), an owned-stack proof, an anon key.
//
// This lane is LOOPBACK ONLY: unlike the shared guard it never accepts an isolated hosted project, so a set
// E2E_ISOLATED_TARGET_REF is itself a refusal. Secrets are never printed.
import { readFileSync, statSync } from 'node:fs';
import { assessTarget } from '../e2e/assert-safe-target.mjs';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
export const E = {
  NOT_LOOPBACK: 'PUBLIC_CATALOG_E_NOT_LOOPBACK',
  SHARED_GUARD: 'PUBLIC_CATALOG_E_SHARED_GUARD',
  ISOLATED_REF: 'PUBLIC_CATALOG_E_ISOLATED_REF_SET',
  NO_KEY: 'PUBLIC_CATALOG_E_NO_ANON_KEY',
  NO_PROOF: 'PUBLIC_CATALOG_E_NO_STACK_PROOF',
  BAD_PROOF: 'PUBLIC_CATALOG_E_BAD_STACK_PROOF',
};

function loopbackHttpOrigin(name, raw) {
  let u;
  try { u = new URL(String(raw ?? '')); } catch { return `${E.NOT_LOOPBACK}: ${name} is not a URL`; }
  if (u.protocol !== 'http:') return `${E.NOT_LOOPBACK}: ${name} must be plain http on loopback`;
  if (u.username || u.password || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) return `${E.NOT_LOOPBACK}: ${name} must be a bare origin`;
  if (!LOOPBACK.has(u.hostname) || !/^\d+$/.test(u.port)) return `${E.NOT_LOOPBACK}: ${name} host must be loopback with an explicit port`;
  return null;
}

/** Owned-stack proof. The PRODUCER does not exist yet (owned by the local-stack lane); until it does this fails closed.
 *  Required shape: {version:1, stack_id:<32 hex>, db_read:<same>, api_read:<same>, produced_before_seed:true}, mode 0600. */
export function checkStackProof(path) {
  if (!path) return `${E.NO_PROOF}: PUBLIC_ACCEPT_STACK_PROOF is unset (no owned-stack proof producer exists yet)`;
  let st;
  try { st = statSync(path); } catch { return `${E.NO_PROOF}: ${path} does not exist`; }
  if (!st.isFile() || (st.mode & 0o077) !== 0) return `${E.BAD_PROOF}: proof must be a regular file with mode 0600`;
  let p;
  try { p = JSON.parse(readFileSync(path, 'utf8')); } catch { return `${E.BAD_PROOF}: proof is not JSON`; }
  const hex = /^[0-9a-f]{32}$/;
  if (p?.version !== 1 || !hex.test(p.stack_id ?? '') || p.db_read !== p.stack_id || p.api_read !== p.stack_id || p.produced_before_seed !== true) {
    return `${E.BAD_PROOF}: proof fields do not pair the DB and the API to one stack before the seed`;
  }
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
  const proof = checkStackProof(env.PUBLIC_ACCEPT_STACK_PROOF); if (proof) errors.push(proof);
  return errors;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const errors = runGuards();
  if (errors.length) { for (const e of errors) console.error(e); process.exit(2); }
  console.log('guards OK: loopback-only targets, owned-stack proof present');
}
