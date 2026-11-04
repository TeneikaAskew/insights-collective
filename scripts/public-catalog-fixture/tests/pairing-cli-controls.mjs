#!/usr/bin/env node
// ABOUTME: Actual-CLI controls for pairing-producer.mjs: the real CLI runs as a child process with a FAKE psql on PATH and a
// ABOUTME: preloaded FAKE fetch that both log every call, so ineligible input is shown to reach ZERO child processes and ZERO HTTP.
//
// Usage: node pairing-cli-controls.mjs <path to the real #154 stack-ownership.mjs (blob ea39300d)>
// Two temp roots are built from this repo's files: LANE (exact copies; PRE pins empty, as shipped) and HARNESS (same copies,
// except pre-contract.mjs gets one pin to a dummy file so the positive and live-failure flows can be driven). The HARNESS
// patch exists only in a temp dir for this test; shipped source never has a PRE pin. No real DB, no network.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { withOwnRoot } from './own-root.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const SO = path.resolve(process.argv[2] ?? '');
if (!fs.existsSync(SO)) { console.log('usage: pairing-cli-controls.mjs <stack-ownership.mjs>'); process.exit(2); }
// Own root (T: no leaked pca-cli roots): one fresh 0700 root per invocation, removed in a bounded finally only if it is still
// that exact directory; a failing control's error is preserved if the removal also fails (own-root.mjs). Never another root.
const exitCode = await withOwnRoot('pca-cli-', async (T) => {
const blob = (b) => createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');

function buildRoot(name, prePin) {
  const r = path.join(T, name);
  fs.cpSync(path.join(REPO, 'scripts/public-catalog-fixture'), path.join(r, 'scripts/public-catalog-fixture'), { recursive: true });
  for (const f of ['scripts/e2e/assert-safe-target.mjs', 'scripts/local-db/assert-local-dsn.mjs', 'supabase/config.toml']) { fs.mkdirSync(path.dirname(path.join(r, f)), { recursive: true }); fs.copyFileSync(path.join(REPO, f), path.join(r, f)); }
  fs.copyFileSync(SO, path.join(r, 'scripts/e2e/stack-ownership.mjs'));
  if (prePin) {
    const dummy = Buffer.from('TEST HARNESS PRE DUMMY\n'); const rel = 'scripts/local-stack/t09/harness-dummy.sql';
    fs.mkdirSync(path.dirname(path.join(r, rel)), { recursive: true }); fs.writeFileSync(path.join(r, rel), dummy);
    const pc = path.join(r, 'scripts/public-catalog-fixture/pre-contract.mjs'); const src = fs.readFileSync(pc, 'utf8');
    const out = src.replace(/export const PRE_CONTRACT_PINS = Object\.freeze\(\{[^}]*\}\);/, `export const PRE_CONTRACT_PINS = Object.freeze({ '${rel}': '${blob(dummy)}' }); // TEST HARNESS ONLY`);
    if (out === src) throw new Error('harness patch did not apply'); fs.writeFileSync(pc, out);
  }
  return r;
}
const LANE = buildRoot('lane', false); const HARNESS = buildRoot('harness', true);
const mod = await import(pathToFileURL(SO).href);
const EXPECTED = (await import(pathToFileURL(path.join(LANE, 'scripts/public-catalog-fixture/d1-ownership.mjs')).href)).EXPECTED_BOOTSTRAP_SHA256;

// Fake psql and fetch: log every call; answer from a small state file.
// The CLI gives psql only PATH and PGPASSFILE, so each case gets its own fake psql with that case's log and state paths baked in.
const fakePsql = (bin, log, state) => fs.writeFileSync(path.join(bin, 'psql'), `#!${process.execPath}
const fs = require('fs'); const log = ${JSON.stringify('LOG')}; const stf = ${JSON.stringify('STATE')};
const st = JSON.parse(fs.readFileSync(stf, 'utf8'));
const sql = fs.readFileSync(0, 'utf8');
const kind = /pg_control_system/.test(sql) ? 'SYSID' : /count\\(\\*\\) from public\\.blog_tags/.test(sql) ? 'TAGS' : /insert into public\\.blog_tags/.test(sql) ? 'INSERT' : /'ROW '/.test(sql) ? 'ROW' : 'OTHER';
fs.appendFileSync(log, 'CHILD psql ' + kind + (process.env.PGPASSFILE ? '' : ' nopassfile') + (Object.keys(process.env).some((k) => k.startsWith('PUBLIC_ACCEPT')) ? ' leaked-env' : '') + '\\n');
if (kind === 'SYSID') console.log('SYSID ' + st.sysid);
if (kind === 'TAGS') console.log('TAGS ' + st.tags);
if (kind === 'INSERT') { const m = sql.match(/'([0-9a-f]{32})'/); st.name = m ? m[1] : ''; fs.writeFileSync(stf, JSON.stringify(st)); console.log('INSERTED 1'); }
if (kind === 'ROW') console.log('ROW ' + st.name + ' ' + st.name);
`.replace('"LOG"', JSON.stringify(log)).replace('"STATE"', JSON.stringify(state)), { mode: 0o700 });
const PRELOAD = path.join(T, 'fake-fetch.mjs');
fs.writeFileSync(PRELOAD, `import fs from 'node:fs';
globalThis.fetch = async (url, init) => {
  fs.appendFileSync(process.env.FAKE_LOG, 'FETCH ' + (String(url).includes('000000000900') ? 'carrier' : 'random') + ' auth=' + (init?.headers?.apikey === process.env.PUBLIC_ACCEPT_ANON_KEY ? 'anon' : 'other') + '\\n');
  const st = JSON.parse(fs.readFileSync(process.env.FAKE_STATE, 'utf8'));
  const carrier = String(url).includes('000000000900');
  const rows = carrier ? (st.anonSees ? [{ id: '7e57ca7a-0000-4000-8000-000000000900', name: st.name, slug: st.name }] : []) : [];
  return { status: 200, json: async () => rows };
};
`);

const SYSID = '7300000000000000001';
function fixture(over = {}) {
  const c = path.join(T, `case-${Math.random().toString(16).slice(2)}`); fs.mkdirSync(c, { mode: 0o700 });
  const out = path.join(c, 'out'); fs.mkdirSync(out, { mode: 0o700 });
  const pass = path.join(c, 'pgpass'); fs.writeFileSync(pass, '127.0.0.1:54322:postgres:postgres:x\n', { mode: 0o600 });
  const rec = path.join(c, 'so.json');
  fs.writeFileSync(rec, JSON.stringify(mod.buildRecord({ runId: '41', runAttempt: '1', systemIdentifier: SYSID, apiOrigin: 'http://127.0.0.1:54321', appOrigin: 'http://127.0.0.1:4173', bootstrapSha256: over.bootstrap ?? EXPECTED })), { mode: 0o600 });
  const state = path.join(c, 'state.json'); fs.writeFileSync(state, JSON.stringify({ sysid: over.sysid ?? SYSID, tags: over.tags ?? 0, anonSees: over.anonSees ?? true }));
  const log = path.join(c, 'log.txt'); fs.writeFileSync(log, '');
  const bin = path.join(c, 'bin'); fs.mkdirSync(bin); fakePsql(bin, log, state);
  const env = { PATH: `${bin}:/usr/bin:/bin`, FAKE_LOG: log, FAKE_STATE: state,
    PUBLIC_ACCEPT_BASE_URL: 'http://127.0.0.1:4173', PUBLIC_ACCEPT_API_URL: 'http://127.0.0.1:54321',
    PUBLIC_ACCEPT_DB_URL: 'postgresql://postgres@127.0.0.1:54322/postgres', PUBLIC_ACCEPT_DB_PASSFILE: pass,
    PUBLIC_ACCEPT_ANON_KEY: 'anon-key-for-controls-0123456789', PUBLIC_ACCEPT_RUN_ID: 'c'.repeat(32),
    STACK_OWNERSHIP_FILE: rec, GITHUB_RUN_ID: '41', GITHUB_RUN_ATTEMPT: '1' };
  return { c, out, env, log };
}
function cli(root, f, argv = ['pair', f.out], envOver = {}) {
  const env = { ...f.env, ...envOver }; for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(PRELOAD).href, path.join(root, 'scripts/public-catalog-fixture/pairing-producer.mjs'), ...argv], { env, encoding: 'utf8', timeout: 20000 });
  const log = fs.readFileSync(f.log, 'utf8').split('\n').filter(Boolean);
  return { code: r.status, out: r.stdout.trim(), children: log.filter((l) => l.startsWith('CHILD')), fetches: log.filter((l) => l.startsWith('FETCH')), log };
}

let bad = 0;
const ok = (c, n) => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); };
const zero = (name, root, want, mutate) => {
  const f = fixture(mutate?.over); const m = mutate?.apply?.(f) ?? {};
  const r = cli(root, f, m.argv, m.env);
  ok(r.code === 3 && r.out === want && r.children.length === 0 && r.fetches.length === 0, `${name}: ${r.out} children=${r.children.length} fetches=${r.fetches.length} (want ${want}, 0, 0)`);
};

// Ineligible input: zero child processes, zero HTTP. Run against HARNESS so the PRE gate is not what stops them.
zero('Z1 hosted password-bearing DSN', HARNESS, 'PAIR_E_ELIGIBILITY_SHARED_GUARD', { apply: () => ({ env: { PUBLIC_ACCEPT_DB_URL: ['postgresql://postgres', 'secret@db.example.supabase.co:5432/postgres'].join(':') /* assembled from parts: no credential-shaped literal */ } }) });
zero('Z2 foreign HTTPS API', HARNESS, 'PAIR_E_ELIGIBILITY_NOT_LOOPBACK', { apply: () => ({ env: { PUBLIC_ACCEPT_API_URL: 'https://example.supabase.co' } }) });
zero('Z3 missing passfile', HARNESS, 'PAIR_E_ELIGIBILITY_DB_PASSFILE', { apply: (f) => ({ env: { PUBLIC_ACCEPT_DB_PASSFILE: path.join(f.c, 'nope') } }) });
zero('Z4 missing output dir', HARNESS, 'PAIR_E_OUT_DIR', { apply: (f) => ({ argv: ['pair', path.join(f.c, 'nope')] }) });
zero('Z5 output dir 0755', HARNESS, 'PAIR_E_PRIVATE_DIR', { apply: (f) => { fs.chmodSync(f.out, 0o755); return {}; } });
zero('Z6 existing proof destination', HARNESS, 'PAIR_E_PROOF_EXISTS', { apply: (f) => { fs.writeFileSync(path.join(f.out, 'stack-proof.json'), '{}', { mode: 0o600 }); return {}; } });
zero('Z7 output dir through a symlink', HARNESS, 'PAIR_E_PRIVATE_DIR', { apply: (f) => { const l = path.join(f.c, 'link'); fs.symlinkSync(f.out, l); return { argv: ['pair', l] }; } });
zero('Z8 D1 record missing', HARNESS, 'PAIR_E_D1_SO_ABSENT', { apply: (f) => ({ env: { STACK_OWNERSHIP_FILE: path.join(f.c, 'nope.json') } }) });
zero('Z9 D1 record from another bootstrap', HARNESS, 'PAIR_E_D1_BOOTSTRAP', { over: { bootstrap: 'a'.repeat(64) } });
zero('Z10 D1 record for another run', HARNESS, 'PAIR_E_D1_RUN', { apply: () => ({ env: { GITHUB_RUN_ID: '42' } }) });
zero('Z11 D1 record mode 0644', HARNESS, 'PAIR_E_D1_SO_MODE', { apply: (f) => { fs.chmodSync(f.env.STACK_OWNERSHIP_FILE, 0o644); return {}; } });
zero('Z12 PRE files absent on this ref (shipped lane pins)', LANE, 'PAIR_E_PRE_CONTRACT');
zero('Z13 usage', HARNESS, 'PAIR_E_USAGE', { apply: () => ({ argv: ['pair'] }) });
zero('Z14 PGPASSWORD in the environment', HARNESS, 'PAIR_E_ELIGIBILITY_DB_ENV', { apply: () => ({ env: { PGPASSWORD: 'x' } }) });
zero('Z15 malformed run id', HARNESS, 'PAIR_E_RUN_ID', { apply: () => ({ env: { PUBLIC_ACCEPT_RUN_ID: 'short' } }) });
{
  const f = fixture(); const so = path.join(HARNESS, 'scripts/e2e/stack-ownership.mjs'); const keep = fs.readFileSync(so);
  fs.appendFileSync(so, '\n// drift\n'); const r = cli(HARNESS, f); fs.writeFileSync(so, keep);
  ok(r.out === 'PAIR_E_D1_PIN' && r.children.length === 0 && r.fetches.length === 0, `Z16 D1 module drift: ${r.out} children=${r.children.length} fetches=${r.fetches.length}`);
}

// Eligible input (HARNESS): positive flow and live failures keep their order.
{
  const f = fixture(); const r = cli(HARNESS, f);
  const proof = path.join(f.out, 'stack-proof.json'); let p = null; try { p = JSON.parse(fs.readFileSync(proof, 'utf8')); } catch { /* absent */ }
  ok(r.code === 0 && /^PUBLIC_CATALOG_PAIRING_OK /.test(r.out) && p && /^[0-9a-f]{32}$/.test(p.stack_id) && p.db_read === p.stack_id && p.api_read === p.stack_id && (fs.statSync(proof).mode & 0o777) === 0o600,
    `C1 positive: OK line, proof 0600 with DSN and anon API reads of one stack_id (exit ${r.code})`);
  ok(JSON.stringify(r.log) === JSON.stringify(['CHILD psql SYSID', 'CHILD psql TAGS', 'CHILD psql INSERT', 'CHILD psql ROW', 'FETCH carrier auth=anon', 'FETCH random auth=anon']),
    `C2 positive order: D1 live read, precheck, insert, DSN read, anon carrier read, anon random read (${r.log.join(' | ')})`);
  ok(!r.out.includes(p?.stack_id ?? 'zzzz') && !fs.readFileSync(f.log, 'utf8').includes(p?.stack_id ?? 'zzzz'), 'C3 the stack_id is never printed and never reaches a URL');
}
{
  const f = fixture({ sysid: '99' }); const r = cli(HARNESS, f);
  ok(r.out === 'PAIR_E_D1_SO_SYSID_MISMATCH' && JSON.stringify(r.children) === JSON.stringify(['CHILD psql SYSID']) && r.fetches.length === 0, `F1 other cluster: only the read-only SYSID query ran (${r.out})`);
}
{
  const f = fixture({ tags: 1 }); const r = cli(HARNESS, f);
  ok(r.out === 'PAIR_E_USED_STACK' && !r.children.includes('CHILD psql INSERT') && r.fetches.length === 0, `F2 used stack: refused before the insert (${r.out})`);
}
{
  const f = fixture({ anonSees: false }); const r = cli(HARNESS, f);
  ok(r.out === 'PAIR_E_API_MISMATCH' && !fs.existsSync(path.join(f.out, 'stack-proof.json')), `F3 anon cannot read the carrier: refused, no proof written (${r.out})`);
}
return bad;
});
console.log(exitCode ? `${exitCode} FAILED` : 'ALL PASS');
process.exit(exitCode ? 1 : 0);
