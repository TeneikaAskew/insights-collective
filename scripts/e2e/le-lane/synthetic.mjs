// ABOUTME: Lifecycle-matrix SYNTHETIC target (LOCAL candidate, unrun), host CLI only: the `select` check that runs first in the
// ABOUTME: synthetic job, and the `LE-SYN` summary. A synthetic result is NEVER E1 evidence or acceptance.
//
//   synthetic.mjs select                         -> one fixed line; exit 0 only if LE_TARGET is exactly SYNTHETIC and no
//                                                   authentic input or baseURL source is set in this step's environment
//   synthetic.mjs summary <ctl dir> <parent> <repo> -> fixed `LE-SYN ...` lines only (never `LE-E1`); exit 0 only on MATRIX PASS
//
// Design: pr134/e1-lifecycle-matrix-r1/DESIGN-r2.md (6d7df146) with r2.1 (40ce3894) and r2.2 (d16478e9). Differences from E1 are
// disclosed there: no Unix-socket bridge, host app or API, no authentic storage state, no Supabase or realtime traffic, a
// different spec and workload. So nothing here can stand in for E1, and no line it emits is read by the E1 summary.
// The pure pieces (target, binds, env, paths, the closed `LANE SYN` grammar and the summary lines) live in contract.mjs, and
// the fresh-directory creation in run-lane.mjs, so the E1 host import closures are unchanged. Writers: none. The summary reads
// lane.txt through le-e1-summary.mjs readPrivateBounded and the lane verdict through gates.mjs readVerdict (host receipts).
import fs from 'node:fs';
import path from 'node:path';
import { lanePaths, selectLine, synSummaryLines } from './contract.mjs';
import { readVerdict } from './gates.mjs';
import { readPrivateBounded } from '../le-e1-summary.mjs';

if (process.argv[1] && /le-lane\/synthetic\.mjs$/.test(process.argv[1])) {
  const [cmd, C, P, R] = process.argv.slice(2);
  try {
    if (cmd === 'select') { const s = selectLine(process.env); console.log(s.line); process.exit(s.ok ? 0 : 1); }
    if (cmd === 'summary') {
      const L = lanePaths(P, C, R);
      if (!/^syn-\d+-\d+$/.test(path.basename(L.P))) throw new Error('parent');
      const verdict = readVerdict(fs, L);
      const t = readPrivateBounded(L.laneTxt, { max: 4096, fsImpl: fs });
      const s = synSummaryLines({ verdict, laneText: t.ok ? t.text : null });
      for (const l of s.lines) console.log(l);
      process.exit(s.ok ? 0 : 1);
    }
    console.log('LE-SYN USAGE'); process.exit(2);
  } catch { console.log('LE-SYN RESULT UNRESOLVED UNCLASSIFIED'); process.exit(1); }
}
