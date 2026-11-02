#!/usr/bin/env node
// ABOUTME: Stack-free self-test for the public-catalog lane: generated seed, INSERT-only and read-only SQL shapes, run-owned
// ABOUTME: ids, guard refusals and one positive, and spec/config shapes (no login, no mocks, empty storage). Prints PASS/FAIL.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, chmodSync, mkdtempSync, symlinkSync, linkSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGuards } from '../guards.mjs';
import { checkStackProof, assessProofStat, assessProofFields } from '../proof.mjs';
import { canonicalDsn, checkDb } from '../pgconn.mjs';
import { checkHelperPins, HELPER_PINS } from '../helper-pins.mjs';
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

const tmp = mkdtempSync(path.join(tmpdir(), 'pc-proof-'));
const file = (name, text, mode = 0o600) => { const p = path.join(tmp, name); writeFileSync(p, text); chmodSync(p, mode); return p; };
const pass = file('pgpass', '127.0.0.1:54322:postgres:postgres:x\n');
const RUN = 'c'.repeat(32); const sid = 'a'.repeat(32);
const fields = { version: 2, stack_id: sid, db_read: sid, api_read: sid, run_id: RUN, produced_before_seed: true, producer: 'scripts/local-stack/stack-proof.mjs' };
const okProof = file('proof.json', JSON.stringify(fields));
const good = { PUBLIC_ACCEPT_BASE_URL: 'http://127.0.0.1:4173', PUBLIC_ACCEPT_API_URL: 'http://127.0.0.1:54321', PUBLIC_ACCEPT_DB_URL: 'postgresql://postgres@127.0.0.1:54322/postgres', PUBLIC_ACCEPT_DB_PASSFILE: pass, PUBLIC_ACCEPT_ANON_KEY: 'k'.repeat(30), PUBLIC_ACCEPT_STACK_PROOF: okProof, PUBLIC_ACCEPT_RUN_ID: RUN };
const codes = (env) => runGuards(env).map((e) => e.split(':')[0]);
const has = (env, code) => codes(env).includes(code);
say(JSON.stringify(codes(good)) === JSON.stringify(['PUBLIC_CATALOG_E_BLOCKED_NO_PRODUCER']), 'a fully valid environment is refused ONLY by BLOCKED_NO_PRODUCER (no reviewed producer exists)');
say(has({ ...good, PUBLIC_ACCEPT_STACK_PROOF: undefined }, 'PUBLIC_CATALOG_E_NO_STACK_PROOF'), 'guards refuse without a proof');
const link = path.join(tmp, 'proof-link.json'); symlinkSync(okProof, link);
say(checkStackProof(link, RUN)?.startsWith('PUBLIC_CATALOG_E_NO_STACK_PROOF'), 'a symlinked proof is refused (O_NOFOLLOW)');
say(checkStackProof(file('p644.json', JSON.stringify(fields), 0o644), RUN)?.startsWith('PUBLIC_CATALOG_E_PROOF_FILE'), 'a 0644 proof is refused');
say(checkStackProof(file('p400.json', JSON.stringify(fields), 0o400), RUN)?.startsWith('PUBLIC_CATALOG_E_PROOF_FILE'), 'a 0400 proof is refused (mode must be exactly 0600)');
const hard = path.join(tmp, 'proof-hard.json'); linkSync(file('ph.json', JSON.stringify(fields)), hard);
say(checkStackProof(hard, RUN)?.startsWith('PUBLIC_CATALOG_E_PROOF_FILE'), 'a hard-linked proof (nlink 2) is refused');
say(assessProofStat({ isFile: () => true, nlink: 1, uid: 4242, mode: 0o100600 }, 0)?.endsWith('OWNER'), 'a proof owned by another uid is refused');
say(assessProofStat({ isFile: () => true, nlink: 1, uid: 0, mode: 0o100600 }, 0) === null, 'owner 0600 single-link file stat is accepted (pure positive)');
say(assessProofFields({ ...fields, run_id: 'd'.repeat(32) }, RUN)?.startsWith('PUBLIC_CATALOG_E_PROOF_FIELDS'), 'a proof bound to another run is refused');
say(assessProofFields({ ...fields, db_read: 'b'.repeat(32) }, RUN)?.startsWith('PUBLIC_CATALOG_E_PROOF_FIELDS'), 'a proof whose DB and API reads differ is refused');
say(assessProofFields({ ...fields, version: 1, run_id: undefined }, RUN)?.startsWith('PUBLIC_CATALOG_E_PROOF_FIELDS'), 'the old unbound v1 shape is refused');
say(has({ ...good, PUBLIC_ACCEPT_BASE_URL: 'https://example.com' }, 'PUBLIC_CATALOG_E_NOT_LOOPBACK'), 'guards refuse a non-loopback app');
say(has({ ...good, PUBLIC_ACCEPT_API_URL: 'https://siuqvhscuiycvdrtiqsh.supabase.co' }, 'PUBLIC_CATALOG_E_NOT_LOOPBACK'), 'guards refuse the hosted project API');
say(has({ ...good, PUBLIC_ACCEPT_DB_URL: 'postgresql://postgres@db.siuqvhscuiycvdrtiqsh.supabase.co:5432/postgres' }, 'PUBLIC_CATALOG_E_SHARED_GUARD'), 'guards refuse the hosted project DB (shared guard)');
say(has({ ...good, E2E_ISOLATED_TARGET_REF: 'abcdefghijklmnopqrst' }, 'PUBLIC_CATALOG_E_ISOLATED_REF_SET'), 'guards refuse any isolated hosted ref');
say(has({ ...good, PUBLIC_ACCEPT_ANON_KEY: '' }, 'PUBLIC_CATALOG_E_NO_ANON_KEY'), 'guards refuse a missing anon key');
say(has({ ...good, PUBLIC_ACCEPT_TIER: 'rehearsal' }, 'PUBLIC_CATALOG_E_TIER'), 'the rehearsal tier no longer exists');
say(canonicalDsn('postgresql://postgres:pw@127.0.0.1:54322/postgres').error?.startsWith('PUBLIC_CATALOG_E_DB_DSN'), 'a DSN carrying a password is refused');
say(canonicalDsn('postgresql://postgres@127.0.0.1:54322/postgres?sslmode=disable').error?.startsWith('PUBLIC_CATALOG_E_DB_DSN'), 'a DSN with query options is refused');
say(has({ ...good, PGPASSWORD: 'x' }, 'PUBLIC_CATALOG_E_DB_ENV'), 'an ambient PGPASSWORD is refused');
say(has({ ...good, PUBLIC_ACCEPT_DB_PASSFILE: file('pass644', 'x', 0o644) }, 'PUBLIC_CATALOG_E_DB_PASSFILE'), 'a 0644 passfile is refused');
say(checkDb({ ...good }).length === 0, 'canonical DSN plus owner-0600 passfile is accepted (positive)');

// Helper pins: real tree, plus absent and drifted copies in a scratch root.
const pinErr = checkHelperPins(ROOT);
say(pinErr.length === 0 || pinErr.every((e) => e.startsWith('PUBLIC_CATALOG_E_HELPER_ABSENT: e2e/lesson-editor/')), `helper pins: ${pinErr.length ? 'only the #152 lesson-editor helpers are absent (not on this ref; composition pending)' : 'all 4 pinned helpers present and exact'}`);
const fakeRoot = path.join(tmp, 'root'); for (const rel of Object.keys(HELPER_PINS)) mkdirSync(path.join(fakeRoot, path.dirname(rel)), { recursive: true });
for (const rel of Object.keys(HELPER_PINS)) writeFileSync(path.join(fakeRoot, rel), 'drifted\n');
say(checkHelperPins(fakeRoot).every((e) => e.startsWith('PUBLIC_CATALOG_E_HELPER_DRIFT')) && checkHelperPins(fakeRoot).length === 4, 'drifted helpers are refused');
say(checkHelperPins(path.join(tmp, 'nothing')).filter((e) => e.startsWith('PUBLIC_CATALOG_E_HELPER_ABSENT')).length === 4, 'absent helpers are refused');

const specs = ['catalog.spec.ts', 'sidebar-rail.spec.ts', 'support.ts'].map((f) => readFileSync(path.join(ROOT, 'e2e/public-catalog', f), 'utf8')).join('\n');
say(!/\.fulfill\(|signIn|login|storageState:\s*['"]/i.test(specs), 'specs never fulfil (mock) a response and never sign in');
say(!/estimatedTime'|formatEstimatedHours/.test(specs), 'specs do not import the production Estimated time formatter as their oracle');
say(/from '\.\.\/lesson-editor\/egress-test'/.test(specs) && !/route\.abort|KNOWN_THIRD_PARTY|rehearsal/.test(specs), 'specs use the pinned egress boundary; no own route, no third-party exception, no rehearsal tier');
say(/!\(want \?\? ''\)\.includes\(`\$\{c\.duration\} hour`\)/.test(specs), 'A2 applies the legacy-duration negative only where it discriminates from the expected value');
{ const { COURSES } = await import('../fixtures.mjs'); const lit = { 'PCA Analytics Course': '2.5 hours', 'PCA BI Course': '12 hours', 'PCA Leading Space Course': '1 hour', 'PCA Newline Name Course': null, 'PCA Unicode Course': 'Under 0.1 hours', 'PCA Published-Flag Draft-Status Course': '4 hours' };
  const skipped = COURSES.filter((c) => c.published && c.duration != null && (lit[c.title] ?? '').includes(`${c.duration} hour`)).map((c) => c.title);
  say(JSON.stringify(skipped) === JSON.stringify(['PCA Published-Flag Draft-Status Course']), `A2 legacy negative skipped only for the non-discriminating flags course (${skipped.join(', ')})`); }
say(/offOrigin, 'no foreign request attempt'\)\.toEqual\(\[\]\)/.test(specs), 'any foreign attempt fails the test');
say(/^export const UNDER_OWN_CONFIG = process\.env\.PUBLIC_ACCEPT_OWN_CONFIG === '1';$/m.test(specs) && /^export const NOT_OWN_CONFIG_REASON = /m.test(specs), 'support.ts exports the own-config flag and reason the specs import');
for (const f of ['catalog.spec.ts', 'sidebar-rail.spec.ts']) say(/^test\.skip\(!UNDER_OWN_CONFIG, NOT_OWN_CONFIG_REASON\);$/m.test(readFileSync(path.join(ROOT, 'e2e/public-catalog', f), 'utf8')), `${f} skips itself outside the lane's own config`);
const runsh = read('run.sh');
const at = (t) => runsh.indexOf(t);
say(at('step pins') < at('step guards') && at('step guards') < at('step pre-contract') && at('step pre-contract') < at('step inventory') && at('step inventory') < at('step served') && at('step served') < at('step hermetic') && at('step hermetic') < at('step W0') && at('step W0') < at('step seed'), 'run.sh order: pins, guards, shared PRE contract, diagnostic inventory, served provenance, hermetic, W0, seed');
say(at('PUBLIC_CATALOG_E_W2_MISMATCH') > 0 && at('PUBLIC_CATALOG_E_W2_MISMATCH') < at('step probe') && at('PUBLIC_CATALOG_E_W2_FAILED') < at('step probe'), 'a W2 failure or mismatch stops the run before any write probe');
say(!/\bcat\b/.test(runsh.replace(/^#.*$/gm, '')) && /trap 'rm -rf -- "\$PRIV"' EXIT/.test(runsh) && /umask 077/.test(runsh), 'run.sh prints no raw output (no cat), stages privately with umask 077, always removes private staging');
say(/env -i PATH="\$PATH" PGPASSFILE=/.test(runsh) && /psql -w/.test(runsh), 'psql runs with a clean env, the private passfile and -w (no prompt, no password in argv)');
say(/PUBLIC_CATALOG_E_LIST_ONLY_SET/.test(runsh), 'run.sh refuses PUBLIC_ACCEPT_LIST_ONLY');
for (const f of ['seed.sql', 'witness.sql', 'pre-stack.sql', 'rls-anon-read.sql', 'rls-anon-write.sql']) {
  const raw = read(f).split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  // The only DELETE allowed anywhere is rls-anon-write.sql's anon attempt on one exact fixture id, inside a rolled-back transaction.
  const dels = [...raw.matchAll(/\bdelete\s+from\b[^;]*;/gi)].map((m) => m[0]);
  const delOk = f === 'rls-anon-write.sql' ? dels.every((d) => /^delete from public\.(courses|modules) where id = '7e57ca7a-0000-4000-8000-\d{12}';$/.test(d)) && /set local role anon;/.test(raw) && /rollback;\s*$/.test(raw) : dels.length === 0;
  say(delOk && !/\b(truncate|drop)\b/i.test(raw.replace(/'[^']*'/g, '')), `${f}: no cleanup SQL (no TRUNCATE/DROP; DELETE only as the anon probe on one fixture id, rolled back)`);
}
say(/begin transaction read only;/.test(read('pre-stack.sql')) && !/FAIL/.test(read('pre-stack.sql')) && !/\|\| *'ok'|'\|ok'/.test(runsh), 'pre-stack.sql is a read-only diagnostic inventory and gates nothing (no ok/FAIL gate in run.sh)');
const preC = await import('../pre-contract.mjs');
say(Object.keys(preC.PRE_CONTRACT_PINS).length === 0 && preC.checkPreContract(ROOT)[0].startsWith('PUBLIC_CATALOG_E_BLOCKED_NO_PRE_CONTRACT'), 'the shared PRE contract is not integrated: BLOCKED_NO_PRE_CONTRACT (pin table empty, not filled from the expected list)');
say(/PUBLIC_CATALOG_E_PRE_CONTRACT/.test(runsh) && at('PUBLIC_CATALOG_E_PRE_CONTRACT') < at('step W0'), 'run.sh stops on the missing PRE contract before W0 and the seed');
const sbc = read('served-build-check.mjs');
say(/for \(const \[rel, want\] of Object\.entries\(prov\.files\)\)/.test(sbc) && /ASSET_HASH/.test(sbc) && /FOREIGN_REF/.test(sbc), 'served check fetches EVERY provenance file (lazy chunks and imported assets too), not only index references');
say(/every app-origin response is bound to the hermetic provenance/.test(specs) && /const want = expectedHash\(prov, p\);/.test(read('response-binding.mjs')), 'specs bind every app-origin response the browser receives to the provenance (oracle in response-binding.mjs)');
const sp = await import('../served-provenance.mjs');
const fakeProv = { served_index_sha256: 'i'.repeat(64), files: { 'index.html': 'p'.repeat(64), 'assets/a.js': 'a'.repeat(64) } };
say(sp.expectedHash(fakeProv, '/assets/a.js') === 'a'.repeat(64) && sp.expectedHash(fakeProv, '/') === 'i'.repeat(64) && sp.expectedHash(fakeProv, '/courses/x') === 'i'.repeat(64)
  && sp.expectedHash(fakeProv, '/assets/lazy.js') === null && sp.expectedHash(fakeProv, '/HERMETIC-PROVENANCE.json') === null && sp.expectedHash(fakeProv, '/assets/../x.js') === null,
  'expectedHash: pinned file, served index for / and SPA routes; unpinned asset, provenance file and traversal are unbound');
const pf = read('private-file.mjs');
say(/O_RDONLY \| constants\.O_NOFOLLOW \| constants\.O_NONBLOCK \| constants\.O_NOCTTY/.test(pf) && /fstatSync\(fd\)/.test(pf) && !/statSync\(file|lstatSync/.test(read('proof.mjs') + read('pgconn.mjs')), 'proof and passfile go through the one opened-handle, non-blocking, bounded reader');
const fifo = execFileSync('node', [path.join(HERE, 'private-file-controls.mjs')], { encoding: 'utf8', timeout: 60000 });
say(/^ALL PASS$/m.test(fifo) && !/HANG/.test(fifo), 'FIFO, directory, symlink, missing, hard-link and oversize controls: refused, none hangs');
const cfg = readFileSync(path.join(ROOT, 'playwright.public-catalog.config.ts'), 'utf8');
say(/storageState: \{ cookies: \[\], origins: \[\] \}/.test(cfg) && !/globalSetup:|webServer:/.test(cfg) && /trace: 'off'/.test(cfg) && /screenshot: 'off'/.test(cfg), 'config: empty storage, no globalSetup/webServer, traces and screenshots off');
say(cfg.indexOf('checkHelperPins(ROOT)') < cfg.indexOf("await import('./e2e/support/chromium-executable')") && cfg.indexOf('checkHelperPins(ROOT)') < cfg.indexOf('runGuards(process.env)'), 'config: helper pins are checked before any helper import and before guards');
say(/process\.argv\.includes\('--list'\)/.test(cfg) && /LE_ALLOWED_ORIGINS', 'LE_EGRESS_CONTROL'/.test(cfg), 'config: LIST_ONLY only with --list; egress self-test overrides refused');
say(!/proxy:\s*\{/.test(cfg) && /EXCLUDE 127\.0\.0\.1/.test(cfg), 'config: no own proxy bypassing loopback; the shared resolver rule is used');
say(/'desktop'/.test(cfg) && /'tablet'/.test(cfg) && /'mobile'/.test(cfg), 'config: desktop, tablet and mobile projects');
const cls = execFileSync('node', [path.join(HERE, 'probe-classifier-controls.mjs')], { encoding: 'utf8' });
say(/^ALL PASS$/m.test(cls), 'probe classifier fake controls pass (see probe-classifier-controls.mjs)');
const sup = readFileSync(path.join(ROOT, 'e2e/public-catalog/support.ts'), 'utf8');
say(/createResponseBinder\(context,/.test(sup) && !/page\.on\('response'/.test(sup) && !/Promise\.all\(bindings\)/.test(sup), 'support: response binding is context-wide via createResponseBinder, not a page-only growing Promise.all');
say(/finally \{[\s\S]*?binder\.freeze\(BINDING_SETTLE_MS\)[\s\S]*?\}/.test(sup) && sup.indexOf('binder.freeze(') < sup.indexOf("expect({ unfinished"), 'support: freeze runs in finally (use failure too) and before every assertion');
say(/toEqual\(\{ unfinished: 0, timedOut: false, late: 0 \}\)/.test(sup) && /frozen\.failed/.test(sup), 'support: an incomplete capture or a failed app request is a refusal');
const rb = execFileSync('node', [path.join(HERE, 'response-binding-controls.mjs')], { encoding: 'utf8' });
say(/^ALL PASS$/m.test(rb), 'response-binding OLD/NEW controls pass (see response-binding-controls.mjs)');
say(at('step ownership') > at('step hermetic') && at('step ownership') < at('step W0') && /d1-ownership\.mjs" verify/.test(runsh), 'run.sh verifies the D1 ownership record after hermetic verify and before W0 and any write');
say(at('m.SERVED_APP_PINS') > at('step hermetic') && at('m.SERVED_APP_PINS') < at('avatar-fixture.mjs" verify') && at('m.SERVED_APP_PINS') < at('hermetic-dist.mjs" verify'), 'run.sh pins the served-app helpers before executing either of them');
say(/EXPECTED_BOOTSTRAP_SHA256 = 'b41a9ed8d7b3207cb2ad4faf71ec8b7fd703a816d02ec0eb92c99a18af452715'/.test(read('d1-ownership.mjs')), 'D1: the reviewed bootstrap digest is hardcoded in lane source');
say(/target outside|AVATAR_SUB_TARGET/.test(read('served-provenance.mjs')) && /assets\\\/\[A-Za-z0-9\._-\]\+\\\.js\$/.test(read('served-provenance.mjs')), 'avatar: substitutions may target only assets/*.js (never index.html)');
say(at('PUBLIC_CATALOG_E_NONCANONICAL_PATH') > at('step hermetic') && at('PUBLIC_CATALOG_E_NONCANONICAL_PATH') < at('avatar-fixture.mjs" verify') && /realpath -e --/.test(runsh), 'run.sh requires canonical physical input paths before the served-app helpers run');
say(/PUBLIC_CATALOG_E_D1_NO_VERDICT/.test(runsh) && /realpathSync\(process\.argv\[1\]\)/.test(read('d1-ownership.mjs')), 'D1: a skipped CLI (symlinked path) cannot pass: realpath isMain and the OK line is required');
const ic = execFileSync('node', [path.join(HERE, 'integration-controls.mjs')], { encoding: 'utf8' });
say(/^ALL PASS$/m.test(ic), 'integration controls (avatar binding, D1 consumer) pass');
console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
