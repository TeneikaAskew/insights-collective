#!/usr/bin/env node
// ABOUTME: Host CLI of the sealed video lane: builds the lane image with the video closure and runs the ONE orchestrator with the
// ABOUTME: frozen kinds.mjs video table. E1's image.mjs and run-lane.mjs CLIs and import closures are untouched by this file.
//
//   video-lane.mjs image <ctl dir (absent)> <repo> <node abs path> <headless shell abs path>
//   video-lane.mjs run   <ctl dir> <private parent> <repo> <node abs path> <headless shell abs path> <commit>
// Cleanup and gate verification reuse E1's unchanged CLIs (image.mjs cleanup, gates.mjs verify): they read only the control
// dir's receipts, whose names are identical for both kinds. SOURCE CANDIDATE (sealed-video r1). UNRUN.
import { buildLaneImage, realDeps as imageDeps } from './image.mjs';
import { realDeps as laneDeps, runLane } from './run-lane.mjs';
import { KINDS } from './kinds.mjs';

export const VIDEO_KIND = KINDS.video;

if (process.argv[1] && /le-lane\/video-lane\.mjs$/.test(process.argv[1])) {
  process.umask(0o077);
  const [cmd, ...a] = process.argv.slice(2);
  const done = (ok, lines) => { for (const l of lines) console.log(l); process.exit(ok ? 0 : 1); };
  (async () => {
    if (cmd === 'image' && a.length === 4) {
      const [ctl, repo, node, shell] = a;
      const r = await buildLaneImage(imageDeps, { ctl, repo, node, shell, kind: VIDEO_KIND });
      done(r.code === 'LANE_IMAGE_OK', [r.code, ...(Array.isArray(r.fieldLines) ? r.fieldLines : []),
        `LANE_IMAGE_CLIENTS ${r.clientsReaped ? 'REAPED' : 'UNRESOLVED'}`, r.record ? 'LANE_IMAGE_RECORD_OK' : 'LANE_E_IMAGE_RECORD']);
    } else if (cmd === 'run' && a.length === 6) {
      const [C, P, R, node, shell, commit] = a;
      const r = await runLane(laneDeps, { C, P, R, node, shell, commit, kind: VIDEO_KIND });
      done(r.ok, r.say);
    } else done(false, ['LANE_E_USAGE']);
  })().catch(() => done(false, ['LANE_E_UNCLASSIFIED']));
}
