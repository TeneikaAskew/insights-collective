#!/usr/bin/env node
// ABOUTME: Reads `supabase status -o env` from a private file, registers ::add-mask:: for every generated local credential
// ABOUTME: FIRST, then appends only the loopback endpoints and the anon key to GITHUB_ENV. Prints no value, ever.
// Usage: export-status.mjs <status file (0600)> <GITHUB_ENV path> [<key dir (0700, new)>]
// With a key dir, the anon and service_role keys are ALSO written there as 0600 files (anon, service) for personas.sh and
// api-controls.mjs, and only their PATHS (never values) go to GITHUB_ENV, with T09_API_URL.
// Masked: every value whose key names a key, secret, password, token or JWT, the whole DB_URL, the password inside any
// URL's userinfo, and every value shaped like a JWT. Masks are emitted before anything is written to GITHUB_ENV, so no
// later step can echo an unmasked value. The status file itself is deleted by the caller right after this exits.
import { readFileSync, appendFileSync, writeFileSync, existsSync, mkdirSync, openSync, fstatSync, closeSync, constants } from 'node:fs';

const [file, envFile, keyDir] = process.argv.slice(2);
if (!file || !envFile) { console.error('usage: export-status.mjs <status file> <GITHUB_ENV>'); process.exit(2); }
// Mode check and read on one handle (no check-then-use by path).
const sfd = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK);
const mode = fstatSync(sfd).mode & 0o777;
if (mode & 0o077) { closeSync(sfd); console.error(`export-status: status file mode ${mode.toString(8)} is readable by others; refusing`); process.exit(2); }
const statusText = readFileSync(sfd, 'utf8');
closeSync(sfd);

const kv = {};
for (const line of statusText.split('\n')) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) kv[m[1]] = m[2];
}
for (const k of ['API_URL', 'DB_URL', 'ANON_KEY']) if (!kv[k]) { console.error(`export-status: ${k} missing`); process.exit(2); }

const masks = new Set();
for (const [k, v] of Object.entries(kv)) {
  if (!v) continue;
  if (/KEY|SECRET|PASSWORD|TOKEN|JWT/.test(k) || k === 'DB_URL') masks.add(v);
  if (/^eyJ[A-Za-z0-9_-]{8,}\./.test(v)) masks.add(v);
  try { const u = new URL(v); if (u.password) masks.add(decodeURIComponent(u.password)); } catch { /* not a URL */ }
}
for (const m of masks) if (m.length >= 4) process.stdout.write(`::add-mask::${m}\n`);

const api = new URL(kv.API_URL), db = new URL(kv.DB_URL);
for (const u of [api, db]) if (!['127.0.0.1', 'localhost'].includes(u.hostname)) { console.error('export-status: non-loopback endpoint'); process.exit(2); }
// Same names the isolated job exports: guards and scripts read these.
const out = [
  `VITE_SUPABASE_URL=${kv.API_URL}`,
  `E2E_RELAY_TARGET=${kv.API_URL}`,
  `SUPABASE_DB_URL=${kv.DB_URL}`,
  `VITE_SUPABASE_ANON_KEY=${kv.ANON_KEY}`,
  `VITE_SUPABASE_PUBLISHABLE_KEY=${kv.ANON_KEY}`,
];
if (keyDir) {
  if (existsSync(keyDir)) { console.error('export-status: key dir exists (never reused)'); process.exit(2); }
  if (!kv.SERVICE_ROLE_KEY) { console.error('export-status: SERVICE_ROLE_KEY missing'); process.exit(2); }
  mkdirSync(keyDir, { mode: 0o700 });
  writeFileSync(`${keyDir}/anon`, kv.ANON_KEY, { mode: 0o600 });
  writeFileSync(`${keyDir}/service`, kv.SERVICE_ROLE_KEY, { mode: 0o600 });
  out.push(`T09_API_URL=${kv.API_URL}`, `T09_ANON_KEY_FILE=${keyDir}/anon`, `T09_SERVICE_KEY_FILE=${keyDir}/service`);
}
appendFileSync(envFile, out.join('\n') + '\n');
console.log(`export-status: ${masks.size} value(s) masked before export; exported ${out.length} variables (api ${api.host}, db ${db.host})`);
