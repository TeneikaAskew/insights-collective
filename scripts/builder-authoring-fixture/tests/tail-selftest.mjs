#!/usr/bin/env node
// ABOUTME: Behavioural fake for run.sh's post-browser tail (item 2): the real tail text, extracted from run.sh, runs against
// ABOUTME: stub children. Every failure mode still attempts the after-witness and comparison; the FIRST failure is kept.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.resolve(HERE, '..');
const run = fs.readFileSync(path.join(REAL, 'run.sh'), 'utf8');
const childFn = run.slice(run.indexOf('child() {'), run.indexOf('# step <fixed code>'));
const tail = run.slice(run.indexOf('rc=0\n# From here on'));
assert.ok(childFn.startsWith('child() {') && tail.includes('ALWAYS: witness after'), 'run.sh shape');
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`ok ${n} ${name}`); };

ok('static: between the browser attempt and the after-witness there is no refuse and no exit', () => {
  const between = run.slice(run.indexOf('PW=$?'), run.indexOf('# 11. ALWAYS')).split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(between, /\brefuse\b|\bexit\b/);
  assert.ok(run.indexOf('witness "$RAW" "$RAW/witness-post.txt"') > run.indexOf('PW=$?'));
});

// Stub children: summary.mjs re-uses the real module, but a mode can be forced to refuse (exit 2) or vanish.
const stub = (dir, mode) => {
  fs.writeFileSync(path.join(dir, 'summary.mjs'), `
import { spawnSync } from 'node:child_process';
export * from ${JSON.stringify(path.join(REAL, 'summary.mjs'))};
const m = process.argv[2];
if (process.argv[1] && process.argv[1].endsWith('summary.mjs') && m) {
  if (${JSON.stringify(mode)}.split('+').includes('pw_refuse') && m === 'playwright') { console.log('SUMMARY FAIL reason=report_parse'); process.exit(2); }
  if (${JSON.stringify(mode)}.split('+').includes('manifest_refuse') && m === 'manifest') { console.log('SUMMARY FAIL reason=run_dir'); process.exit(2); }
  if (m === 'witness') { console.log('WITNESS PASS stub=1'); console.log('VERDICT PASS'); process.exit(0); }
  if (m === 'playwright' || m === 'manifest') { console.log('STUB PASS'); console.log('VERDICT PASS'); process.exit(0); }
  const r = spawnSync(process.execPath, [${JSON.stringify(path.join(REAL, 'summary.mjs'))}, ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}`);
  fs.writeFileSync(path.join(dir, 'ba-shots.mjs'), `
import fs from 'node:fs';
if (${JSON.stringify(mode)}.split('+').includes('shots_refuse')) { console.log('ba-shots refused: __proto__'); process.exit(3); }
fs.mkdirSync(process.argv[5], { mode: 0o700 }); console.log('SHOTS captured=0 withheld=0 not_taken=13 planned=13');`);
  fs.writeFileSync(path.join(dir, 'ba-db.mjs'), `
import fs from 'node:fs';
fs.writeFileSync(${JSON.stringify(path.join(dir, 'post-attempted'))}, 'x');
if (${JSON.stringify(mode)}.split('+').includes('post_refuse')) { console.log('ba-db refused: BA_DB_E_PSQL'); process.exit(3); }
fs.writeFileSync(process.argv[4], 'w\\n', { mode: 0o600, flag: 'wx' });`);
};
const scenario = (mode, pw = 1) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-tail-')); fs.chmodSync(d, 0o700);
  const raw = path.join(d, 'raw'), out = path.join(d, 'out'), stubs = path.join(d, 'stubs');
  for (const x of [raw, out, stubs, path.join(d, 'run'), path.join(d, 'shots')]) fs.mkdirSync(x, { mode: 0o700 });
  fs.writeFileSync(path.join(out, 'pairing.txt'), 'PAIRING PASS dsn_write=1 dsn_read=match api_read=match\n');
  fs.writeFileSync(path.join(out, 'seed.txt'), 'BA_SEED_OK courses=3 sections=7 lessons=8\n');
  stub(stubs, mode);
  const script = `set -euo pipefail\numask 077\nrefuse() { echo "builder-authoring refused: $1" >&2; exit "\${2:-3}"; }\n`
    + `HERE=${JSON.stringify(stubs)}; RAW=${JSON.stringify(raw)}; OUT=${JSON.stringify(out)}; PW=${pw}; BA_NONCE=0123456789abcdef\n`
    + `BA_RUN_DIR=${JSON.stringify(path.join(d, 'run'))}; BA_SHOT_DIR=${JSON.stringify(path.join(d, 'shots'))}; BA_SESSION_DIR=x; BA_PAIRING_PROOF=x\n`
    + childFn + '\n' + tail;
  const r = spawnSync('bash', ['-c', script], { encoding: 'utf8' });
  const res = { status: r.status, stderr: r.stderr, attempted: fs.existsSync(path.join(stubs, 'post-attempted')),
    files: fs.readdirSync(out).sort(), read: (f) => fs.readFileSync(path.join(out, f), 'utf8') };
  return { ...res, done: () => fs.rmSync(d, { recursive: true }) };
};

for (const [mode, first] of [['pw_refuse', 'RUN_E_SUMMARY_PLAYWRIGHT'], ['manifest_refuse', 'RUN_E_SUMMARY_MANIFEST'], ['shots_refuse', 'RUN_E_SHOTS'], ['post_refuse', 'RUN_E_WITNESS_POST']]) {
  ok(`${mode}: the after-witness is still attempted, the exact inventory is still staged, the first failure (${first}) is kept`, () => {
    const r = scenario(mode);
    assert.equal(r.attempted, true);
    assert.equal(r.status, 3);
    assert.equal(r.stderr.trim().split('\n').at(-1), `builder-authoring refused: ${first}`);
    assert.deepEqual(r.files, ['manifest.txt', 'pairing.txt', 'playwright-summary.txt', 'screenshots', 'screenshots.txt', 'seed.txt', 'witness.txt']);
    if (mode === 'shots_refuse') assert.equal(r.read('screenshots.txt'), 'SHOTS REFUSED code=UNLISTED\n', 'a hostile child code never prints');
    if (mode === 'post_refuse') assert.equal(r.read('witness.txt'), 'WITNESS FAIL kind=post_not_taken code=BA_DB_E_PSQL\nVERDICT FAIL\n');
    if (mode === 'pw_refuse') assert.equal(r.read('witness.txt'), 'WITNESS PASS stub=1\nVERDICT PASS\n', 'comparison ran');
    r.done();
  });
}
ok('two failures: the FIRST is kept (playwright summary refused, then shots refused, then the after-witness refused)', () => {
  const r = scenario('pw_refuse+shots_refuse+post_refuse');
  assert.equal(r.attempted, true); assert.equal(r.status, 3);
  assert.equal(r.stderr.trim().split('\n').at(-1), 'builder-authoring refused: RUN_E_SUMMARY_PLAYWRIGHT');
  assert.equal(r.read('screenshots.txt'), 'SHOTS REFUSED code=UNLISTED\n');
  assert.match(r.read('witness.txt'), /^WITNESS FAIL kind=post_not_taken code=BA_DB_E_PSQL\n/);
  r.done();
});
ok('a browser failure with every summary readable exits 1 (FAIL lines kept), not a refusal', () => {
  const r = scenario('none', 1);
  assert.equal(r.attempted, true); assert.equal(r.status, 1); assert.doesNotMatch(r.stderr, /refused/);
  r.done();
});
console.log(`PASS builder-authoring run.sh tail selftest (${n} checks)`);
