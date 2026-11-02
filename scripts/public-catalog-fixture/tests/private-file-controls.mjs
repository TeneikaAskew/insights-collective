#!/usr/bin/env node
// ABOUTME: Special-file controls for the private-input reader, the proof consumer and the passfile check. Each case runs in a
// ABOUTME: child process with a hard timeout, so a hang (the e62d79fa FIFO failure) is reported as HANG instead of stalling.
//
// Usage: node private-file-controls.mjs [module dir]   (default: this lane's scripts/public-catalog-fixture; pass an exported
// OLD copy to run the causal arm). Prints one line per case and ALL PASS / N FAILED for the expected NEW outcomes.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync, symlinkSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const T = mkdtempSync(path.join(tmpdir(), 'pc-special-'));
const RUN = 'c'.repeat(32); const sid = 'a'.repeat(32);
const json = JSON.stringify({ version: 2, stack_id: sid, db_read: sid, api_read: sid, run_id: RUN, produced_before_seed: true, producer: 'x' });
const mk = {
  regular: () => { const p = path.join(T, 'reg'); writeFileSync(p, json); chmodSync(p, 0o600); return p; },
  fifo: () => { const p = path.join(T, 'fifo'); execFileSync('mkfifo', ['-m', '600', p]); return p; },
  directory: () => { const p = path.join(T, 'dir'); mkdirSync(p, { mode: 0o700 }); return p; },
  symlink: () => { const p = path.join(T, 'link'); symlinkSync(path.join(T, 'reg'), p); return p; },
  missing: () => path.join(T, 'missing'),
  hardlink: () => { const p = path.join(T, 'hard'); linkSync(path.join(T, 'reg'), p); return p; },
  oversize: () => { const p = path.join(T, 'big'); writeFileSync(p, 'x'.repeat(5000)); chmodSync(p, 0o600); return p; },
};
const files = Object.fromEntries(Object.entries(mk).map(([k, f]) => [k, f()]));
// The hard link makes reg nlink 2, so the regular positive gets its own fresh file.
const fresh = path.join(T, 'fresh'); writeFileSync(fresh, json); chmodSync(fresh, 0o600); files.regular = fresh;

const probe = (kind, file) => {
  const code = kind === 'proof'
    ? `import(${JSON.stringify(path.join(DIR, 'proof.mjs'))}).then((m) => console.log('R ' + (m.checkStackProof(${JSON.stringify(file)}, '${RUN}') ?? 'null').split(':')[0]))`
    : `import(${JSON.stringify(path.join(DIR, 'pgconn.mjs'))}).then((m) => console.log('R ' + ((m.checkDb({ PUBLIC_ACCEPT_DB_URL: 'postgresql://postgres@127.0.0.1:54322/postgres', PUBLIC_ACCEPT_DB_PASSFILE: ${JSON.stringify(file)} })[0] ?? 'null').split(':').slice(0, 2).join(':'))))`;
  const r = spawnSync('node', ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 3000 });
  if (r.error?.code === 'ETIMEDOUT' || r.signal) return 'HANG';
  return (r.stdout.match(/^R (.*)$/m) ?? [null, `ERR exit ${r.status}`])[1];
};
const WANT = {
  proof: { regular: 'PUBLIC_CATALOG_E_BLOCKED_NO_PRODUCER', fifo: 'PUBLIC_CATALOG_E_PROOF_FILE', directory: 'PUBLIC_CATALOG_E_PROOF_FILE', symlink: 'PUBLIC_CATALOG_E_NO_STACK_PROOF', missing: 'PUBLIC_CATALOG_E_NO_STACK_PROOF', hardlink: 'PUBLIC_CATALOG_E_PROOF_FILE', oversize: 'PUBLIC_CATALOG_E_PROOF_FILE' },
  passfile: { regular: 'null', fifo: 'PUBLIC_CATALOG_E_DB_PASSFILE: TYPE', directory: 'PUBLIC_CATALOG_E_DB_PASSFILE: TYPE', symlink: 'PUBLIC_CATALOG_E_DB_PASSFILE: OPEN', missing: 'PUBLIC_CATALOG_E_DB_PASSFILE: OPEN', hardlink: 'PUBLIC_CATALOG_E_DB_PASSFILE: LINKS', oversize: 'PUBLIC_CATALOG_E_DB_PASSFILE: SIZE' },
};
let fail = 0;
for (const kind of ['proof', 'passfile']) for (const [name, file] of Object.entries(files)) {
  const got = probe(kind, file); const want = WANT[kind][name]; const ok = got === want; if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${kind} ${name}: ${got}${ok ? '' : ` (wanted ${want})`}`);
}
// One-line pgpass positive: the regular proof JSON is one line too, so check a genuine passfile separately.
const pg = path.join(T, 'pgpass'); writeFileSync(pg, '127.0.0.1:54322:postgres:postgres:x\n'); chmodSync(pg, 0o600);
const pgot = probe('passfile', pg); if (pgot !== 'null') fail++; console.log(`${pgot === 'null' ? 'PASS' : 'FAIL'} passfile genuine one-line 0600: ${pgot}`);
console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
