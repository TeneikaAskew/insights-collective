#!/usr/bin/env node
// ABOUTME: Creates the lesson-editor fixture personas through the LOCAL GoTrue admin API (labelled setup) and signs each in by
// ABOUTME: password grant, writing a 0600 persona file and one 0600 Playwright storageState per persona for the app origin.
// Usage: personas.mjs <api origin> <anon key file> <service key file> <app origin> <out dir (absent)>
//   Reuses the qualified T-09 HTTP path (../t09/api-http.mjs): the API origin is strictly parsed loopback, checked BEFORE
//   any key is read into a request, and redirects are refused. The app origin must be a loopback origin as well.
//   Personas: OWNER (instructor, owns the fixture course), OTHER (instructor, does not), STUDENT. Emails are
//   le-<persona>-<run>@local.test. Passwords: 24 random bytes, only in this process's memory and request bodies.
//   Output dir is created 0700 and must not exist: personas.json {KEY:{id,email,token}} and state-<KEY>.json, all 0600.
//   Any failure after the dir is created removes it, so a partial run never leaves session files behind. Note: accounts
//   already created in GoTrue stay (the stack is disposable and is never reused: preflight P1 refuses existing le-* users).
//   The app's auth storage key is 'supabase.auth.token' (src/integrations/supabase/client.ts).
import { existsSync, mkdirSync, writeFileSync, chmodSync, statSync, rmSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { apiOrigin, readSecretFile, request } from '../t09/api-http.mjs';

export const LE_PERSONAS = ['OWNER', 'OTHER', 'STUDENT'];
const APP_STORAGE_KEY = 'supabase.auth.token';
let created = null; // the private output dir, once this process made it: removed on ANY failure (no partial session files)
const refuse = (m) => {
  if (created) {
    try {
      rmSync(created, { recursive: true, force: true });
      console.log('le-personas: partial private output removed');
    } catch {
      console.log('le-personas: WARNING could not remove partial private output');
    }
  }
  console.log(`FAIL le-personas: ${m}`);
  process.exit(1);
};

const [rawApi, anonFile, serviceFile, rawApp, outDir] = process.argv.slice(2);
if (!rawApi || !anonFile || !serviceFile || !rawApp || !outDir) {
  console.error('usage: personas.mjs <api origin> <anon key file> <service key file> <app origin> <out dir>');
  process.exit(2);
}
let API, APP;
try {
  API = apiOrigin(rawApi);
  APP = apiOrigin(rawApp); // same strict loopback-origin rule for the app the storage state is bound to
} catch (e) {
  refuse(e.message);
}
let anon, service;
try {
  anon = readSecretFile(anonFile, 'anon key');
  service = readSecretFile(serviceFile, 'service key');
} catch (e) {
  refuse(e.message);
}
if (existsSync(outDir)) refuse('output dir exists (never reused)');
mkdirSync(outDir, { mode: 0o700 });
created = outDir;
process.on('uncaughtException', () => refuse('unexpected error (detail withheld)'));
process.on('unhandledRejection', () => refuse('unexpected error (detail withheld)'));

const write600 = (f, s) => {
  writeFileSync(f, s, { mode: 0o600, flag: 'wx' });
  chmodSync(f, 0o600);
  if ((statSync(f).mode & 0o777) !== 0o600) refuse(`${path.basename(f)} is not mode 600`);
};

const run = randomBytes(4).toString('hex');
const personas = {};
for (const p of LE_PERSONAS) {
  const email = `le-${p.toLowerCase()}-${run}@local.test`;
  const password = randomBytes(24).toString('hex');
  let u, t;
  try {
    u = await request(API, 'POST', '/auth/v1/admin/users', {
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
      timeoutMs: 20000,
    });
    if (u.status !== 200 && u.status !== 201) refuse(`create ${p} (setup): HTTP ${u.status}`);
    t = await request(API, 'POST', '/auth/v1/token?grant_type=password', {
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      timeoutMs: 20000,
    });
    if (t.status !== 200) refuse(`sign in ${p}: HTTP ${t.status}`);
  } catch (e) {
    refuse(`${p}: ${e.message}`);
  }
  const id = u.json?.id || u.json?.user?.id;
  const session = t.json;
  if (!/^[0-9a-f-]{36}$/.test(id || '') || typeof session?.access_token !== 'string' || typeof session?.refresh_token !== 'string') {
    refuse(`persona ${p}: response missing id or session`);
  }
  let claims;
  try {
    claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString());
  } catch {
    refuse(`persona ${p}: token not a JWT`);
  }
  if (claims.sub !== id || claims.role !== 'authenticated') refuse(`persona ${p}: token subject or role mismatch`);
  personas[p] = { id, email, token: session.access_token };
  const state = { cookies: [], origins: [{ origin: APP, localStorage: [{ name: APP_STORAGE_KEY, value: JSON.stringify(session) }] }] };
  write600(path.join(outDir, `state-${p}.json`), JSON.stringify(state));
  console.log(`le-persona ${p}: created via local GoTrue admin API (setup), signed in; session only in 0600 files`);
}
write600(path.join(outDir, 'personas.json'), JSON.stringify(personas));
console.log(`PASS le-personas: ${LE_PERSONAS.length} created; storage states bound to ${APP}`);
