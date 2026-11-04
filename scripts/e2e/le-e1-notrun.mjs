#!/usr/bin/env node
// ABOUTME: The reviewed fixed-line adapter for an E1 lane that never reached run.sh setup (a lane pre-check refused, or the lane
// ABOUTME: container never started). Prints the same nine LE-E1 lines as le-e1-summary.mjs with NOT RUN values; never a pass.
//
//   le-e1-notrun.mjs <commit> <lane-precheck|not-started> <code>
// It creates no file and fabricates no run.sh evidence: no setup.txt is read or written, and nothing claims setup ran.
// Import closure: node:fs (via le-e1-summary.mjs) and e2e/lesson-editor/step-codes.mjs. Exit status is always 1.
import { lines } from './le-e1-summary.mjs';

/** Codes this adapter accepts; must equal contract.mjs PRECHECK_CODES (test) plus LANE_NOT_STARTED. */
export const NOTRUN_CODES = Object.freeze({
  'lane-precheck': ['LANE_E_UMASK', 'LANE_E_ENV', 'LANE_E_APPARMOR', 'LANE_E_CLOSURE', 'LANE_E_FORWARD', 'LANE_E_BRIDGE_REACH',
    'LANE_E_SESSION_PARENT', 'LANE_E_PAIR_RECHECK'],
  'not-started': ['LANE_NOT_STARTED'],
});

export function notRunLines(argv) {
  const [commit, at, code] = argv;
  if (argv.length !== 3 || !/^[0-9a-f]{40}$/.test(commit ?? '') || !Object.hasOwn(NOTRUN_CODES, at) || !NOTRUN_CODES[at].includes(code)) return ['LE-E1 REFUSED LE_SUM_E_NOTRUN_USAGE'];
  return lines({ commit, setup: 'NOT RUN', stage: at, code, contract: 'unattempted', result: 'unattempted', step: 'none', cleanup: 'NOT RUN' });
}

if (process.argv[1] && /le-e1-notrun\.mjs$/.test(process.argv[1])) {
  try { for (const l of notRunLines(process.argv.slice(2))) console.log(l); } catch { console.log('LE-E1 REFUSED LE_SUM_E_UNCLASSIFIED'); }
  process.exit(1);
}
