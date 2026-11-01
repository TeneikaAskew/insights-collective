#!/usr/bin/env node
// ABOUTME: Fail-closed checks that an isolated E2E job really targets the local stack. `env` mode: every URL the
// ABOUTME: app, Playwright and the seed read is loopback, and both anon-key names hold the same local, non-hosted key.
// ABOUTME: `dist <dir>` mode: the built app (JS/HTML/CSS, not source maps) carries no production ref and no hosted key.
//
// Why both key names: the app client reads VITE_SUPABASE_ANON_KEY (src/config/security.ts) while
// e2e/global-setup.ts reads VITE_SUPABASE_PUBLISHABLE_KEY. Each falls back to the production project when its
// variable is unset, so exporting only one name silently pairs the local URL with the production key.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;

export function productionRef(tomlText) {
  const m = tomlText.match(/^\s*project_id\s*=\s*"([a-z0-9]+)"/m);
  if (!m) throw new Error('deny identity (project_id) not found');
  return m[1];
}

/** Decoded JWT payload, or null when the value is not a JWT. */
export function jwtPayload(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return null; }
}

export function checkEnv(env, prodRef) {
  const problems = [];
  for (const name of ['VITE_SUPABASE_URL', 'E2E_RELAY_TARGET', 'SUPABASE_DB_URL', 'E2E_BASE_URL']) {
    const v = env[name];
    if (!v) { problems.push(`${name} is unset`); continue; }
    let host;
    try { host = new URL(v).hostname; } catch { problems.push(`${name} is not a URL`); continue; }
    if (!LOOPBACK.has(host)) problems.push(`${name} is not loopback`);
  }
  const anon = env.VITE_SUPABASE_ANON_KEY, pub = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!anon) problems.push('VITE_SUPABASE_ANON_KEY is unset (the app would use its production fallback)');
  if (!pub) problems.push('VITE_SUPABASE_PUBLISHABLE_KEY is unset (global-setup would use its production fallback)');
  if (anon && pub && anon !== pub) problems.push('VITE_SUPABASE_ANON_KEY and VITE_SUPABASE_PUBLISHABLE_KEY differ');
  for (const [name, v] of [['VITE_SUPABASE_ANON_KEY', anon], ['VITE_SUPABASE_PUBLISHABLE_KEY', pub]]) {
    if (!v) continue;
    const p = jwtPayload(v);
    if (p && (p.ref !== undefined || p.iss === 'supabase')) problems.push(`${name} is a hosted-project key`);
    if (p && p.role !== 'anon') problems.push(`${name} is not an anon key`);
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY) problems.push('SUPABASE_SERVICE_ROLE_KEY must not be set in this job');
  const hits = Object.entries(env).filter(([, v]) => String(v).includes(prodRef)).map(([k]) => k);
  if (hits.length) problems.push(`production ref present in: ${hits.join(', ')}`);
  return problems;
}

function* files(dir) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) yield* files(p); else yield p;
  }
}

/** Source maps embed original source text (including the unused fallback literals) and are not executed. */
export function checkDist(dir, prodRef, localUrl) {
  const problems = [];
  let scanned = 0, sawLocal = false;
  for (const f of files(dir)) {
    if (!/\.(js|mjs|html|css)$/.test(f)) continue;
    scanned++;
    const text = readFileSync(f, 'utf8');
    const rel = path.relative(dir, f);
    if (text.includes(prodRef)) problems.push(`${rel} contains the production ref`);
    for (const m of text.matchAll(JWT)) {
      const p = jwtPayload(m[0]);
      if (p && (p.ref !== undefined || p.iss === 'supabase')) problems.push(`${rel} embeds a hosted-project key`);
    }
    if (localUrl && text.includes(localUrl)) sawLocal = true;
  }
  if (scanned === 0) problems.push('no built JS/HTML found');
  if (localUrl && !sawLocal) problems.push(`the build does not contain the local API URL ${localUrl}`);
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, dir] = process.argv.slice(2);
  let ref;
  try { ref = productionRef(readFileSync(path.resolve(HERE, '../../supabase/config.toml'), 'utf8')); }
  catch { console.error('deny identity cannot be read'); process.exit(2); }
  let problems;
  if (mode === 'env') problems = checkEnv(process.env, ref);
  else if (mode === 'dist' && dir) problems = checkDist(dir, ref, process.env.VITE_SUPABASE_URL);
  else { console.error('usage: check-local-target.mjs env | dist <dir>'); process.exit(2); }
  if (problems.length) { for (const p of problems) console.error(`refused: ${p}`); process.exit(1); }
  console.log(`local target ${mode}: ok`);
}
