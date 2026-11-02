#!/usr/bin/env node
// ABOUTME: D1 consumer for this lane: verifies the shared runner's stack-ownership record (#154 stack-ownership.mjs, imported
// ABOUTME: as-is after its blob pin) against this run, this lane's own origins, a LIVE system identifier and the REVIEWED bootstrap.
//
// What it proves: the record was written by the reviewed bootstrap (pinned digest below, not "any well-formed one") for THIS
// run and attempt, naming THIS lane's app/API origins, and the database this lane's DSN reaches is the cluster that bootstrap
// initialised. What it does not prove: `disposable: true` is the bootstrap's declaration, never treated as proof here, and
// the record says nothing about rows (the pairing producer and W0 cover those). Output: one fixed line; exit 0 or 3.
//
// CLI (run.sh step `ownership`, after hermetic verify and before any write):
//   node d1-ownership.mjs verify            live system identifier on stdin (digits only), read by run.sh through psqlx
// Env: STACK_OWNERSHIP_FILE, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, PUBLIC_ACCEPT_BASE_URL, PUBLIC_ACCEPT_API_URL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkHelperPins, D1_PINS } from './helper-pins.mjs';

/** Reviewed bootstrap digest named by the shared owner (PR134 thread, 2026-11-02 00:52Z). Hardcoded on purpose. */
export const EXPECTED_BOOTSTRAP_SHA256 = 'b41a9ed8d7b3207cb2ad4faf71ec8b7fd703a816d02ec0eb92c99a18af452715';
export const D1_MODULE = 'scripts/e2e/stack-ownership.mjs';
const DIGITS = /^[0-9]{1,20}$/;

/** Pure core: verifyRecord is injected so fakes drive every branch. Returns [] when verified, else one fixed code. */
export function ownershipFailures(o) {
  if (!o || typeof o.verifyRecord !== 'function') return ['PUBLIC_CATALOG_E_D1_MODULE'];
  if (!DIGITS.test(String(o.runId ?? ''))) return ['PUBLIC_CATALOG_E_D1_NO_RUN'];
  if (!DIGITS.test(String(o.runAttempt ?? ''))) return ['PUBLIC_CATALOG_E_D1_NO_ATTEMPT'];
  if (!DIGITS.test(String(o.liveSystemIdentifier ?? ''))) return ['PUBLIC_CATALOG_E_D1_LIVE_READ'];
  let r;
  try {
    r = o.verifyRecord(o.file, { runId: o.runId, runAttempt: o.runAttempt, liveSystemIdentifier: o.liveSystemIdentifier,
      apiOrigin: o.apiOrigin, appOrigin: o.appOrigin, expectedBootstrapSha256: EXPECTED_BOOTSTRAP_SHA256 });
  } catch { return ['PUBLIC_CATALOG_E_D1_MODULE']; }
  if (!r || typeof r !== 'object' || typeof r.code !== 'string') return ['PUBLIC_CATALOG_E_D1_MODULE'];
  if (r.ok !== true || r.code !== 'SO_OK') return [`PUBLIC_CATALOG_E_D1_${/^SO_[A-Z_]+$/.test(r.code) ? r.code : 'MODULE'}`];
  // Defence in depth: re-check the fields this lane relies on, rather than trusting ok alone.
  const rec = r.record;
  if (!rec || rec.run_id !== String(o.runId) || rec.run_attempt !== String(o.runAttempt)) return ['PUBLIC_CATALOG_E_D1_RECORD_RUN'];
  if (rec.api_origin !== o.apiOrigin || rec.app_origin !== o.appOrigin) return ['PUBLIC_CATALOG_E_D1_RECORD_ORIGIN'];
  if (rec.bootstrap_sha256 !== EXPECTED_BOOTSTRAP_SHA256) return ['PUBLIC_CATALOG_E_D1_RECORD_BOOTSTRAP'];
  if (rec.pg_system_identifier !== String(o.liveSystemIdentifier)) return ['PUBLIC_CATALOG_E_D1_RECORD_SYSID'];
  return [];
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const pins = checkHelperPins(root, D1_PINS);
  if (pins.length) return pins[0].split(':')[0];
  const live = fs.readFileSync(0, 'utf8').trim();
  let api; let app;
  try { api = new URL(process.env.PUBLIC_ACCEPT_API_URL).origin; app = new URL(process.env.PUBLIC_ACCEPT_BASE_URL).origin; } catch { return 'PUBLIC_CATALOG_E_D1_ORIGINS'; }
  const mod = await import(pathToFileURL(path.join(root, D1_MODULE)).href);
  const bad = ownershipFailures({ verifyRecord: mod.verifyRecord, file: process.env.STACK_OWNERSHIP_FILE, runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT, liveSystemIdentifier: live, apiOrigin: api, appOrigin: app });
  return bad[0] ?? null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv[2] !== 'verify') { console.log('PUBLIC_CATALOG_E_D1_USAGE'); process.exit(3); }
  main().then((code) => {
    if (code) { console.log(code); process.exit(3); }
    console.log('PUBLIC_CATALOG_D1_OK stack ownership record verified for this run, these origins and this cluster (disposable is declared, not proven)');
  }, () => { console.log('PUBLIC_CATALOG_E_D1_MODULE'); process.exit(3); });
}
