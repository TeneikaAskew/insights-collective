#!/usr/bin/env node
// ABOUTME: Controls for pw-summary.mjs: a failing test names only its deepest allowlisted step title, never a message; passing
// ABOUTME: and skipped tests are unchanged; every step title the specs use is on the allowlist. In memory only, no files written.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize, failedStep, STEP_RE } from '../pw-summary.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
let n = 0;
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
ok('a teardown net_* step is reported when every body step passed', () => {
  assert.equal(failedStep([{ title: 'a8_load' }, { title: 'net_foreign', error: err }]), 'net_foreign');
});
ok('every step title the public-catalog specs and support use is on the allowlist, and each allowlisted A4/A8 title is used', () => {
  const src = ['e2e/public-catalog/catalog.spec.ts', 'e2e/public-catalog/support.ts'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const used = [...src.matchAll(/\.step\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(used.length >= 19, `steps found: ${used.length}`);
  for (const t of used) assert.ok(STEP_RE.test(t), `allowlisted: ${t}`);
  for (const t of ['a4_tab_reach', 'a4_back', 'a4_forward', 'a8_open_card', 'a8_estimate', 'a8_public_module', 'a8_hidden_module', 'net_foreign']) assert.ok(used.includes(t), `used: ${t}`);
});
ok('the CLI prints the same summary for a report file path given as run.sh gives it', () => {
  const r = spawnSync(process.execPath, ['-e', `import('${path.join(ROOT, 'scripts/public-catalog-fixture/pw-summary.mjs')}')`], { encoding: 'utf8' });
  assert.equal(r.status, 0); assert.equal(r.stdout, '', 'importing does not print');
  // The report reaches the CLI through a bash process-substitution pipe, so this control writes no file.
  const json = JSON.stringify(report([{ status: 'failed', error: err, steps: [{ title: 'a4_tab_reach', error: err }] }]));
  const cli = spawnSync('bash', ['-c', 'node "$1" <(printf "%s" "$2")', 'bash', path.join(ROOT, 'scripts/public-catalog-fixture/pw-summary.mjs'), json], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr); assert.equal(cli.stdout, 'desktop|catalog.spec.ts:113|A8 t|failed|step=a4_tab_reach\n');
});
console.log(`PASS pw-summary controls (${n} checks)`);
