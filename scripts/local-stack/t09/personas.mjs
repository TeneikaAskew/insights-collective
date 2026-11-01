#!/usr/bin/env node
// ABOUTME: Creates the T-09 API personas through the LOCAL GoTrue admin API (service key, labelled setup) and signs each in by
// ABOUTME: password grant. Origin is strictly validated first; no redirect; passwords exist only in this process's memory.
// Usage: personas.mjs <api origin> <anon key file> <service key file> <persona output file>
//   Order of checks, all before ANY credential-bearing request: origin (api-http.mjs apiOrigin, parsed, loopback, no userinfo),
//   both key files (regular, non-empty, 0600), output file absent. Only then are the keys read into headers.
//   Personas: A, B (students), I, J (instructors), ADMIN, and the two protected-history learners HC (holds the legacy
//   certificate in course H) and HG (genuine pre-migration history in H). history-hash.sql seeds H for HC and HG by id.
//   Passwords: 24 random bytes per persona, generated here, sent only in a request body over the validated origin; never on a
//   command line, in the environment, in a file or in output. Output: {"A":{"id","token"},...}, written 0600.
import { existsSync, writeFileSync, chmodSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { apiOrigin, readSecretFile, request } from './api-http.mjs';

export const PERSONAS = ['A', 'B', 'I', 'J', 'ADMIN', 'HC', 'HG'];
const refuse = (m) => { console.log(`FAIL personas: ${m}`); process.exit(1); };

const [rawApi, anonFile, serviceFile, out] = process.argv.slice(2);
if (!rawApi || !anonFile || !serviceFile || !out) { console.error('usage: personas.mjs <api origin> <anon key file> <service key file> <out>'); process.exit(2); }
let API;
try { API = apiOrigin(rawApi); } catch (e) { refuse(e.message); }
let anon, service;
try { anon = readSecretFile(anonFile, 'anon key'); service = readSecretFile(serviceFile, 'service key'); } catch (e) { refuse(e.message); }
if (existsSync(out)) refuse('persona file exists (never reused)');

const run = randomBytes(4).toString('hex');
const result = {};
for (const p of PERSONAS) {
  const email = `t09-${p.toLowerCase()}-${run}@local.test`;
  const password = randomBytes(24).toString('hex');
  let u, t;
  try {
    u = await request(API, 'POST', '/auth/v1/admin/users', {
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }), timeoutMs: 20000,
    });
    if (u.status !== 200 && u.status !== 201) refuse(`create ${p} (setup): HTTP ${u.status}`);
    t = await request(API, 'POST', '/auth/v1/token?grant_type=password', {
      headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), timeoutMs: 20000,
    });
    if (t.status !== 200) refuse(`sign in ${p}: HTTP ${t.status}`);
  } catch (e) { refuse(`${p}: ${e.message}`); }
  const id = u.json?.id || u.json?.user?.id;
  const token = t.json?.access_token;
  if (!/^[0-9a-f-]{36}$/.test(id || '') || typeof token !== 'string') refuse(`persona ${p}: response missing id or token`);
  let claims;
  try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()); } catch { refuse(`persona ${p}: token not a JWT`); }
  if (claims.sub !== id || claims.role !== 'authenticated') refuse(`persona ${p}: token subject or role mismatch`);
  result[p] = { id, token };
  console.log(`persona ${p}: created via local GoTrue admin API (setup) and signed in by password grant; token kept in the 0600 persona file`);
}
writeFileSync(out, JSON.stringify(result), { mode: 0o600, flag: 'wx' });
chmodSync(out, 0o600);
if ((statSync(out).mode & 0o777) !== 0o600) refuse('persona file is not mode 600');
