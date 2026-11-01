#!/usr/bin/env node
// ABOUTME: Stack-free self-test for the public-catalog lane: generated seed, INSERT-only and read-only SQL shapes, run-owned
// ABOUTME: ids, guard refusals and one positive, and spec/config shapes (no login, no mocks, empty storage). Prints PASS/FAIL.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, chmodSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGuards, checkStackProof } from '../guards.mjs';
import { ALL_IDS, ID_PREFIX } from '../fixtures.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); const DIR = path.resolve(HERE, '..'); const ROOT = path.resolve(DIR, '../..');
let fail = 0; const say = (ok, name) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) fail++; };
const read = (p) => readFileSync(path.join(DIR, p), 'utf8');

const seed = read('seed.sql');
say(execFileSync('node', [path.join(DIR, 'gen-seed.mjs')], { encoding: 'utf8' }) === seed, 'seed.sql is exactly the gen-seed.mjs output');
const body = seed.split('\n').filter((l) => !l.startsWith('--'));
say(!body.some((l) => /\b(update|delete|truncate|drop|alter|grant|revoke|create)\b/i.test(l.replace(/'[^']*'/g, ''))), 'seed.sql has no UPDATE/DELETE/TRUNCATE/DDL/grant outside literals');
const ids = [...seed.matchAll(/values \(E'([0-9a-f-]{36})'/g)].map((m) => m[1]);
say(ids.length === ALL_IDS.length && ids.every((i) => i.startsWith(ID_PREFIX) && ALL_IDS.includes(i)), `every seeded row carries a run-owned id (${ids.length})`);
say(/PUBLIC_CATALOG_E_NOT_PRISTINE/.test(seed) && /^begin;$/m.test(seed) && /^commit;$/m.test(seed), 'seed.sql refuses a non-pristine stack, in one transaction');
const w = read('witness.sql');
say(/begin transaction read only;/.test(w) && /rollback;/.test(w) && !/\b(insert|update|delete)\b/i.test(w), 'witness.sql is read-only');
for (const f of ['rls-anon-read.sql', 'rls-anon-write.sql']) say(/set local role anon;/.test(read(f)) && /rollback;\s*$/.test(read(f)), `${f} runs as anon and rolls back`);
const probe = read('anon-probe.mjs');
say([...probe.matchAll(/'(POST|PATCH|DELETE)', `?([^`',]+)/g)].every((m) => !/\?/.test(m[2]) || /id=eq\.\$\{(COURSES|MODULES)\[\d\]\.id\}/.test(m[2])), 'anon write attempts target fixture ids only');

const good = { PUBLIC_ACCEPT_BASE_URL: 'http://127.0.0.1:4173', PUBLIC_ACCEPT_API_URL: 'http://127.0.0.1:54321', PUBLIC_ACCEPT_DB_URL: 'postgresql://postgres@127.0.0.1:54322/postgres', PUBLIC_ACCEPT_ANON_KEY: 'k'.repeat(30) };
const tmp = mkdtempSync(path.join(tmpdir(), 'pc-proof-'));
const proof = (obj, mode = 0o600) => { const p = path.join(tmp, `p${Math.random()}.json`); writeFileSync(p, JSON.stringify(obj)); chmodSync(p, mode); return p; };
const sid = 'a'.repeat(32); const okProof = proof({ version: 1, stack_id: sid, db_read: sid, api_read: sid, produced_before_seed: true });
const has = (env, code) => runGuards(env).some((e) => e.startsWith(code));
say(runGuards({ ...good, PUBLIC_ACCEPT_STACK_PROOF: okProof }).length === 0, 'guards accept loopback targets with a valid proof (positive control)');
say(has(good, 'PUBLIC_CATALOG_E_NO_STACK_PROOF'), 'guards refuse without an owned-stack proof (producer missing today)');
say(has({ ...good, PUBLIC_ACCEPT_STACK_PROOF: proof({ version: 1, stack_id: sid, db_read: sid, api_read: sid, produced_before_seed: true }, 0o644) }, 'PUBLIC_CATALOG_E_BAD_STACK_PROOF'), 'guards refuse a world-readable proof');
say(has({ ...good, PUBLIC_ACCEPT_STACK_PROOF: proof({ version: 1, stack_id: sid, db_read: 'b'.repeat(32), api_read: sid, produced_before_seed: true }) }, 'PUBLIC_CATALOG_E_BAD_STACK_PROOF'), 'guards refuse a proof whose DB and API reads differ');
say(has({ ...good, PUBLIC_ACCEPT_STACK_PROOF: okProof, PUBLIC_ACCEPT_BASE_URL: 'https://example.com' }, 'PUBLIC_CATALOG_E_NOT_LOOPBACK'), 'guards refuse a non-loopback app');
say(has({ ...good, PUBLIC_ACCEPT_STACK_PROOF: okProof, PUBLIC_ACCEPT_API_URL: 'https://siuqvhscuiycvdrtiqsh.supabase.co' }, 'PUBLIC_CATALOG_E_NOT_LOOPBACK'), 'guards refuse the hosted project API');
say(has({ ...good, PUBLIC_ACCEPT_STACK_PROOF: okProof, PUBLIC_ACCEPT_DB_URL: 'postgresql://postgres@db.siuqvhscuiycvdrtiqsh.supabase.co:5432/postgres' }, 'PUBLIC_CATALOG_E_SHARED_GUARD'), 'guards refuse the hosted project DB (shared guard)');
say(has({ ...good, PUBLIC_ACCEPT_STACK_PROOF: okProof, PUBLIC_ACCEPT_DB_URL: undefined }, 'PUBLIC_CATALOG_E_SHARED_GUARD'), 'guards refuse an unset DB target');
say(has({ ...good, PUBLIC_ACCEPT_STACK_PROOF: okProof, E2E_ISOLATED_TARGET_REF: 'abcdefghijklmnopqrst' }, 'PUBLIC_CATALOG_E_ISOLATED_REF_SET'), 'guards refuse any isolated hosted ref (loopback-only lane)');
say(has({ ...good, PUBLIC_ACCEPT_STACK_PROOF: okProof, PUBLIC_ACCEPT_ANON_KEY: '' }, 'PUBLIC_CATALOG_E_NO_ANON_KEY'), 'guards refuse a missing anon key');
say(checkStackProof('/nonexistent/proof.json')?.startsWith('PUBLIC_CATALOG_E_NO_STACK_PROOF'), 'a missing proof file is refused');

const specs = ['catalog.spec.ts', 'sidebar-rail.spec.ts', 'support.ts'].map((f) => readFileSync(path.join(ROOT, 'e2e/public-catalog', f), 'utf8')).join('\n');
say(!/\.fulfill\(|signIn|login|storageState:\s*['"]/i.test(specs), 'specs never fulfil (mock) a response and never sign in');
say(/route\.abort\(\)/.test(specs) && /offOrigin.*toEqual\(\[\]\)/.test(specs), 'off-origin requests are aborted and any unknown one fails the test');
say(/TIER === 'rehearsal' && KNOWN_THIRD_PARTY/.test(specs) && /process\.env\.PUBLIC_ACCEPT_TIER === 'rehearsal' \? 'rehearsal' : 'authentic'/.test(specs), 'known foreign attempts are tolerated ONLY in the rehearsal tier; authentic is the default');
for (const f of ['catalog.spec.ts', 'sidebar-rail.spec.ts']) say(/^test\.skip\(!UNDER_OWN_CONFIG, NOT_OWN_CONFIG_REASON\);$/m.test(readFileSync(path.join(ROOT, 'e2e/public-catalog', f), 'utf8')), `${f} skips itself outside the lane's own config`);
const runsh = read('run.sh');
say(/PUBLIC_CATALOG_E_TIER/.test(runsh) && /export PUBLIC_ACCEPT_TIER=authentic/.test(runsh), 'run.sh refuses the rehearsal tier');
say(/PUBLIC_CATALOG_E_NO_HERMETIC_CONTRACT/.test(runsh) && runsh.indexOf('step hermetic') < runsh.indexOf('step seed'), 'run.sh requires the hermetic served-app verify before the seed');
const cfg = readFileSync(path.join(ROOT, 'playwright.public-catalog.config.ts'), 'utf8');
say(/storageState: \{ cookies: \[\], origins: \[\] \}/.test(cfg) && !/globalSetup:|webServer:/.test(cfg) && /runGuards\(process\.env\)/.test(cfg) && cfg.indexOf("process.env.PUBLIC_ACCEPT_OWN_CONFIG = '1'") > -1 && cfg.indexOf("process.env.PUBLIC_ACCEPT_OWN_CONFIG = '1'") < cfg.indexOf('runGuards(process.env)'), 'config: empty storage, no globalSetup/webServer, own-config flag then guards at load');
say(/'desktop'/.test(cfg) && /'tablet'/.test(cfg) && /'mobile'/.test(cfg), 'config: desktop, tablet and mobile projects');
console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
