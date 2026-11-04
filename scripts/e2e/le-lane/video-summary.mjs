#!/usr/bin/env node
// ABOUTME: Host summary of the sealed video lane: only after run-lane's host receipts establish lane absence and bridge reap, the
// ABOUTME: container's lane.txt is read (bounded) as untrusted data against the closed video grammar. Fixed lines only; read-only.
//
//   video-summary.mjs <ctl dir> <private parent> <repo>
// Exit 0 only for VIDEO_LANE PASS. SOURCE CANDIDATE (sealed-video r1). UNRUN.
import fs from 'node:fs';
import { readPrivateBounded } from '../le-e1-summary.mjs';
import { readVerdict } from './gates.mjs';
import { parseVideoLaneOut, videoLaneVerdict, videoPaths } from './kinds.mjs';

/** Fixed summary lines from the host verdict and the lane text. Never prints lane content beyond the parsed closed fields. */
export function videoSummaryLines(verdict, laneText) {
  if (!verdict?.ok) return { pass: false, lines: ['VIDEO_LANE SUMMARY NOT RUN: lane absence or bridge reaping unresolved'] };
  const p = parseVideoLaneOut(laneText);
  const v = videoLaneVerdict(p);
  if (!p.ok) return { pass: false, lines: ['VIDEO_LANE OUT INVALID', 'VIDEO_LANE UNRESOLVED'] };
  return {
    pass: v === 'PASS',
    lines: [
      `VIDEO_LANE APPARMOR ${p.apparmor ?? 'NONE'}`,
      `VIDEO_LANE PRECHECK ${p.precheck ?? 'NONE'}`,
      `VIDEO_LANE RAN ${p.ran ? 'YES' : 'NO'}`,
      `VIDEO_LANE WORKER_APPARMOR ${p.workerAppArmor ?? 'NONE'}`,
      `VIDEO_LANE TEXT_RENDER ${p.textRender ?? 'NONE'}`,
      `VIDEO_LANE RESULT ${p.result ?? 'NONE'}`,
      `VIDEO_LANE EGRESS ${p.egress ?? 'NONE'}`,
      `VIDEO_LANE ${p.interrupted ? 'UNRESOLVED' : v}`,
    ],
  };
}

if (process.argv[1] && /le-lane\/video-summary\.mjs$/.test(process.argv[1])) {
  try {
    const [C, P, R, ...rest] = process.argv.slice(2);
    if (rest.length) throw new Error('usage');
    const V = videoPaths(P, C, R);
    const verdict = readVerdict(fs, V);
    const r = verdict.ok ? readPrivateBounded(V.laneTxt, { max: 4096, fsImpl: fs }) : null;
    const s = videoSummaryLines(verdict, r?.ok ? r.text : null);
    for (const l of s.lines) console.log(l);
    process.exit(s.pass ? 0 : 1);
  } catch { console.log('VIDEO_LANE UNRESOLVED'); process.exit(1); }
}
