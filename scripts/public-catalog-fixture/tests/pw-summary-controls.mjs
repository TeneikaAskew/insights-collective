#!/usr/bin/env node
// ABOUTME: Controls for pw-summary.mjs: a failing test names only its deepest allowlisted step title, never a message; passing
// ABOUTME: and skipped tests are unchanged; titles are allowlisted; the REAL runner's report shape is checked browserless.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { summarize, failedStep, failedCheck, STEP_RE } from '../pw-summary.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
// Own-root lifecycle (the K1 writers' contract): the probe's outputDir is a fresh 0700 temp root removed whatever happens; if
// the check fails and removal fails too, the check's error is rethrown unchanged and the removal error only attached.
const withOwnRoot = (fn) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pca-pwsum-'));
  let failed = false, primary;
  try { fs.chmodSync(d, 0o700); return fn(d); } catch (e) { failed = true; primary = e; throw e; } finally {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (c) {
      if (!failed) throw c;
      console.error(`CLEANUP_SECONDARY root=${path.basename(d)} code=${(c && c.code) || 'unknown'}`);
      if (primary && typeof primary === 'object') { try { Object.defineProperty(primary, 'cleanupError', { value: c, enumerable: true }); } catch { /* kept */ } }
    }
  }
};
let n = 0;
// Fixed writer source: writes PCA_PIPE_DATA into the pipe named by its first argument (data only, never code).
const WRITE_PIPE = "require('node:fs').writeFileSync(process.argv[1], process.env.PCA_PIPE_DATA);";
const ok = (name, fn) => { fn(); n += 1; console.log(`ok ${n} ${name}`); };
const SECRET = 'Expected: "Estimated time: 2.5 hours" Received: "secret page text 7e57ca7a"';
const err = { message: SECRET, stack: SECRET };
const report = (results) => ({ suites: [{ specs: [{ file: 'catalog.spec.ts', line: 113, title: 'A8 t', tests: [{ projectName: 'desktop', results }] }] }] });

ok('a passing and a skipped test print exactly the old four fields', () => {
  assert.equal(summarize(report([{ status: 'passed', steps: [{ title: 'a8_load' }] }])), 'desktop|catalog.spec.ts:113|A8 t|passed');
  assert.equal(summarize(report([{ status: 'skipped' }])), 'desktop|catalog.spec.ts:113|A8 t|skipped');
});
ok('a failure names the deepest failed allowlisted step, and no message text appears', () => {
  const out = summarize(report([{ status: 'failed', error: err, steps: [{ title: 'a8_load' }, { title: 'a8_estimate', error: err, steps: [{ title: 'expect.toEqual', error: err }] }] }]));
  assert.equal(out, 'desktop|catalog.spec.ts:113|A8 t|failed|step=a8_estimate');
  assert.ok(!out.includes('secret') && !out.includes('Expected'));
});
ok('the last attempt counts; timedOut is a failure status too', () => {
  assert.equal(summarize(report([{ status: 'failed', error: err, steps: [{ title: 'a8_heading', error: err }] }, { status: 'timedOut', error: err, steps: [{ title: 'a8_open_card', error: err }] }])), 'desktop|catalog.spec.ts:113|A8 t|timedOut|step=a8_open_card');
});
ok('a failed step whose title is not allowlisted is UNLISTED; a failure outside every step is UNSTEPPED', () => {
  assert.equal(failedStep([{ title: 'Estimated time: secret', error: err }]), 'UNLISTED');
  assert.equal(summarize(report([{ status: 'failed', error: err, steps: [{ title: 'a8_load' }] }])), 'desktop|catalog.spec.ts:113|A8 t|failed|step=UNSTEPPED');
  assert.equal(failedStep([{ title: 'a8_estimate', error: err, steps: [{ title: 'a8_estimate x', error: err }] }]), 'a8_estimate', 'an unlisted inner step does not hide its allowlisted parent');
  assert.equal(failedStep([{ title: 'a4_open', error: err, steps: [{ title: 'a4_arrow', error: err }] }]), 'a4_arrow', 'the deepest allowlisted step wins');
});
ok('a failed teardown check is read from its annotation, through the same allowlist, only when no step failed', () => {
  const ann = (d) => [{ type: 'pc_failed_check', description: d }];
  assert.equal(summarize(report([{ status: 'failed', error: err, steps: [{ title: 'a8_load' }], annotations: ann('net_foreign') }])), 'desktop|catalog.spec.ts:113|A8 t|failed|step=net_foreign');
  assert.equal(summarize(report([{ status: 'failed', error: err, steps: [{ title: 'a8_estimate', error: err }], annotations: ann('net_foreign') }])), 'desktop|catalog.spec.ts:113|A8 t|failed|step=a8_estimate', 'a failed body step wins');
  assert.equal(failedCheck(ann('a8_estimate')), 'UNLISTED', 'only net_* titles come from annotations');
  assert.equal(failedCheck(ann(SECRET)), 'UNLISTED');
  assert.equal(failedCheck([{ type: 'other', description: 'net_foreign' }]), null);
});
ok('REAL runner and JSON reporter (browserless probe): teardown net_foreign, body a8_estimate, refused unlisted title, a pass', () => {
  withOwnRoot((root) => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/playwright/cli.js'), 'test', '-c', path.join(HERE, 'probe/pw.probe.config.cjs')],
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PCA_PROBE_OUT: path.join(root, 'out'), CI: '1' }, maxBuffer: 16 << 20, timeout: 120000 });
    assert.equal(r.status, 1, 'three probe tests fail on purpose');
    const report = JSON.parse(r.stdout);
    assert.ok(JSON.stringify(report).includes('pc_failed_check'), 'the real reporter carries the annotation');
    const lines = summarize(report).split('\n').map((l) => l.replace(/^\|[^|]*:\d+\|/, '|').replace(/^[^|]*\|/, ''));
    assert.deepEqual(lines, [
      'P1 all pass|passed',
      'P2 body passes, teardown net_foreign fails|failed|step=net_foreign',
      'P3 body step fails|failed|step=a8_estimate',
      'P4 an unlisted teardown title is refused before it runs|failed|step=UNSTEPPED',
    ]);
    assert.ok(!summarize(report).includes('secret'), 'no message or value text in the summary');
  });
});
ok('every step and teardown-check title the public-catalog specs and support use is on the allowlist, and each allowlisted A4/A8 title is used', () => {
  const src = ['e2e/public-catalog/catalog.spec.ts', 'e2e/public-catalog/support.ts'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const used = [...src.matchAll(/\.step\('([^']+)'/g), ...src.matchAll(/check\(testInfo, '([^']+)'/g)].map((m) => m[1]);
  assert.equal(src.match(/check\(testInfo, 'net_/g).length, 5, 'all five teardown checks go through failed-check.mjs');
  assert.doesNotMatch(src, /\.step\('net_/, 'no teardown test.step (the JSON reporter drops it)');
  assert.ok(used.length >= 19, `steps found: ${used.length}`);
  for (const t of used) assert.ok(STEP_RE.test(t), `allowlisted: ${t}`);
  for (const t of ['a4_tab_reach', 'a4_back', 'a4_forward', 'a8_open_card', 'a8_estimate', 'a8_public_module', 'a8_hidden_module', 'net_foreign']) assert.ok(used.includes(t), `used: ${t}`);
});
ok('the CLI prints the same summary for a report file path given as run.sh gives it', () => {
  const r = spawnSync(process.execPath, ['-e', `import('${path.join(ROOT, 'scripts/public-catalog-fixture/pw-summary.mjs')}')`], { encoding: 'utf8' });
  assert.equal(r.status, 0); assert.equal(r.stdout, '', 'importing does not print');
  // The report reaches the CLI through a named pipe in a private temp dir (a pipe path, as run.sh's process substitution
  // gives), so this control writes no regular file and runs no shell. A child writer feeds the pipe while the CLI reads it.
  const json = JSON.stringify(report([{ status: 'failed', error: err, steps: [{ title: 'a4_tab_reach', error: err }] }]));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pca-pws-'));
  let cli;
  try {
    const fifo = path.join(dir, 'report.pipe');
    assert.equal(spawnSync('mkfifo', ['-m', '600', fifo]).status, 0, 'mkfifo');
    // The report travels as environment data, so the writer needs nothing from this (blocked) process once started.
    const writer = spawn(process.execPath, ['-e', WRITE_PIPE, fifo], { stdio: 'ignore', env: { ...process.env, PCA_PIPE_DATA: json } });
    cli = spawnSync(process.execPath, [path.join(ROOT, 'scripts/public-catalog-fixture/pw-summary.mjs'), fifo], { encoding: 'utf8', timeout: 10000 });
    writer.kill();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  assert.equal(cli.status, 0, cli.stderr); assert.equal(cli.stdout, 'desktop|catalog.spec.ts:113|A8 t|failed|step=a4_tab_reach\n');
});
console.log(`PASS pw-summary controls (${n} checks)`);
