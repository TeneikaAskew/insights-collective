#!/usr/bin/env node
// ABOUTME: Later always() steps of the E1 lane: VERIFY the host receipts run-lane.mjs wrote (never a child handle, never a
// ABOUTME: PID-based reap claim) and plan which fixed-line summary producer may run. Read-only; fixed lines only.
//
//   gates.mjs verify <ctl dir> <private parent> <repo>   -> LANE_GATE lines; exit 0 only if lane absence and bridge reap are established
//   gates.mjs plan   <ctl dir> <private parent> <repo>   -> exactly one PLAN line (SKIP | NOTRUN <at> <code> | REFUSED <code> | SUMMARY <pw> <setup> <cleanup>)
//   gates.mjs scope  <ctl dir> <private parent> <repo> <preview> <stack> <producers> <private rm 0|1> <start>
//                    -> LANE_SECRET_SCOPE, SECRET_CONSUMER <name> STOPPED|NEVER_STARTED|UNRESOLVED (x3),
//                       SECRET_CLEANUP_EFFECTIVE|UNRESOLVED <consumers>, CONTROLS REMOVE|KEEP|NONE; exit 0 only if effective.
//                       preview/stack/producers/start are GitHub step outcomes. 'success' = stopped; 'skipped' counts only as
//                       NEVER_STARTED for stack/producers when start is also exactly 'skipped' (contract.mjs consumerState).
//
// Import closure (checked by test): node:fs, node:path, ./contract.mjs, ../le-iso/expect.mjs, ../le-e1-summary.mjs,
// ../../../e2e/lesson-editor/step-codes.mjs. No child_process, no network, no dynamic import, no writer.
import fs from 'node:fs';
import { readPrivateBounded } from '../le-e1-summary.mjs';
import { cleanupScope, laneVerdict, lanePaths, planSummary, pwExitContent } from './contract.mjs';

export function readVerdict(fsx, L) {
  let started;
  try { fsx.lstatSync(L.started); started = true; } catch (e) { started = e?.code === 'ENOENT' ? false : null; }
  if (started === null) return { ok: false, container: 'UNRESOLVED', bridge: 'UNRESOLVED', clients: 'UNRESOLVED', started: 'UNKNOWN', source: 'UNREADABLE' };
  let gatesText = null;
  if (started) { const r = readPrivateBounded(L.gates, { max: 65536, fsImpl: fsx }); gatesText = r.ok ? r.text : null; }
  return laneVerdict({ runLaneStarted: started, gatesText });
}

export function verifyLines(v) {
  return [`LANE_GATE CONTAINER ${v.container}`, `LANE_GATE BRIDGE ${v.bridge}`, `LANE_GATE CLIENTS ${v.clients}`, `LANE_GATE SOURCE ${v.source}`,
    v.ok ? 'LANE_GATE OK' : 'LANE_GATE UNRESOLVED'];
}

export function planLine(fsx, L) {
  const verdict = readVerdict(fsx, L);
  const exists = (p) => { try { fsx.lstatSync(p); return true; } catch (e) { return e?.code === 'ENOENT' ? false : null; } };
  const laneExists = exists(L.laneTxt);
  let laneText = null;
  if (laneExists) { const r = readPrivateBounded(L.laneTxt, { max: 4096, fsImpl: fsx }); laneText = r.ok ? r.text : '\u0000unreadable'; }
  else if (laneExists === null) laneText = '\u0000unreadable';
  const pwState = exists(L.pwExit);
  let pwExit = { state: 'absent' };
  if (pwState === null) pwExit = { state: 'bad' };
  else if (pwState) { const r = readPrivateBounded(L.pwExit, { max: 8, fsImpl: fsx }); pwExit = r.ok ? pwExitContent(r.text) : { state: 'bad' }; }
  const p = planSummary({ verdict, laneText, pwExit });
  if (p.kind === 'skip') return 'PLAN SKIP';
  if (p.kind === 'notrun') return `PLAN NOTRUN ${p.at} ${p.code}`;
  if (p.kind === 'refused') return `PLAN REFUSED ${p.code}`;
  return `PLAN SUMMARY ${p.pw} ${p.setup} ${p.cleanup}`;
}

/** The le_private decision from host records only (contract.mjs cleanupScope). */
export function scopeResult(fsx, L, { outcomes, privateRemoved }) {
  const verdict = readVerdict(fsx, L);
  const read = (p) => { const r = readPrivateBounded(p, { max: 4096, fsImpl: fsx }); return r.ok ? r.text : null; };
  let controlsPresent;
  try { fsx.lstatSync(L.C); controlsPresent = true; } catch (e) { controlsPresent = e?.code === 'ENOENT' ? false : true; }
  return cleanupScope({ verdict, privateRemoved, outcomes, buildRec: controlsPresent ? read(L.imageBuildRec) : null,
    cleanupRec: controlsPresent ? read(L.imageCleanupRec) : null, controlsPresent });
}

if (process.argv[1] && /le-lane\/gates\.mjs$/.test(process.argv[1])) {
  const [cmd, C, P, R, preview, stack, producers, priv, start] = process.argv.slice(2);
  try {
    const L = lanePaths(P, C, R);
    if (cmd === 'verify') { const v = readVerdict(fs, L); for (const l of verifyLines(v)) console.log(l); process.exit(v.ok ? 0 : 1); }
    if (cmd === 'plan') { console.log(planLine(fs, L)); process.exit(0); }
    if (cmd === 'scope') {
      const r = scopeResult(fs, L, { outcomes: { preview, stack, producers, start }, privateRemoved: priv === '0' });
      for (const l of r.lines) console.log(l);
      process.exit(r.effective ? 0 : 1);
    }
    console.log('LANE_GATE USAGE'); process.exit(2);
  } catch {
    if (cmd === 'scope') { console.log('LANE_SECRET_SCOPE UNRESOLVED'); console.log('SECRET_CLEANUP_UNRESOLVED unclassified'); console.log('CONTROLS KEEP'); process.exit(1); }
    console.log(cmd === 'plan' ? 'PLAN SKIP' : 'LANE_GATE UNRESOLVED'); process.exit(cmd === 'plan' ? 0 : 1);
  }
}
