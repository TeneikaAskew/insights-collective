#!/usr/bin/env node
// ABOUTME: Pure, browserless consistency control for the fixed screenshot names: shot plan, the strict expected mapping,
// ABOUTME: catalog.spec CATALOG_SHOT, the lane config's viewports and the job NAMES fixture must agree. Reads files only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_SHOT_PLAN, PUBLIC_SHOT_NAMES } from '../shot-plan.mjs';
import { PUBLIC_SHOT_EXPECT, JOB_NAMES_FIXTURE } from './shot-expect.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let bad = 0;
const ok = (c, n) => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const names = Object.keys(PUBLIC_SHOT_EXPECT);
ok(names.length === 4 && same(PUBLIC_SHOT_NAMES, names), 'N1 the shot plan exports exactly the 4 expected names, in order');
ok(same(JOB_NAMES_FIXTURE.split(' '), names), 'N2 the job NAMES fixture lists exactly the same 4 names, in order');
ok(names.every((n) => { const p = PUBLIC_SHOT_PLAN[n], e = PUBLIC_SHOT_EXPECT[n];
  return p && same(Object.keys(p).sort(), ['height', 'path', 'project', 'width']) && p.path === '/courses'
    && p.project === e.project && p.width === e.width && p.height === e.height; }), 'N3 each plan entry equals its strict {project, width, height} and routes /courses');
ok(names.every((n) => n.endsWith(`-${PUBLIC_SHOT_EXPECT[n].width}x${PUBLIC_SHOT_EXPECT[n].height}`)), 'N4 each name ends with its exact viewport (no project-name assumption)');
ok(!names.some((n) => /834/.test(n)) && PUBLIC_SHOT_EXPECT['PC-rail-desktop-1180x757'].project === 'desktop' && !names.some((n) => /rail-(tablet|mobile)/.test(n)), 'N5 no 834 name; the rail is desktop only');

const cat = read('e2e/public-catalog/catalog.spec.ts');
const m = /const CATALOG_SHOT[^=]*= \{\s*([^}]*)\}/.exec(cat);
const shotMap = m ? Object.fromEntries([...m[1].matchAll(/'?([a-z0-9-]+)'?: '([^']+)'/g)].map((x) => [x[1], x[2]])) : null;
const noShot = /NO_SHOT_PROJECTS = new Set\(\[([^\]]*)\]\)/.exec(cat);
const noShotSet = noShot ? [...noShot[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null;
ok(shotMap && Object.keys(shotMap).length === 3 && Object.entries(shotMap).every(([proj, n]) => PUBLIC_SHOT_EXPECT[n] && PUBLIC_SHOT_EXPECT[n].project === proj && n.startsWith('PC-catalog-')),
  'N6 CATALOG_SHOT maps 3 projects, each to a catalog name whose expected project is that key');
const cfg = read('playwright.public-catalog.config.ts');
const projects = Object.fromEntries([...cfg.matchAll(/name: '([a-z0-9-]+)', use: \{[^}]*viewport: \{ width: (\d+), height: (\d+) \}/g)].map((x) => [x[1], { width: +x[2], height: +x[3] }]));
ok(shotMap && noShotSet && same(Object.keys(projects).sort(), [...Object.keys(shotMap), ...noShotSet].sort()), 'N7 every config project is either in CATALOG_SHOT or in NO_SHOT_PROJECTS, never both or neither');
ok(names.every((n) => { const e = PUBLIC_SHOT_EXPECT[n]; return n.startsWith('PC-rail-') || (projects[e.project] && projects[e.project].width === e.width && projects[e.project].height === e.height); }),
  'N8 each catalog name\'s viewport is exactly its config project\'s viewport');

// Live NAMES, when the shared job is present on this ref: it must equal the fixture. Absent on lane-only refs.
let wf = ''; try { wf = read('.github/workflows/e2e.yml'); } catch { /* no workflow file on this ref */ }
const live = [...wf.matchAll(/NAMES="(PC-[^"]*)"/g)].map((x) => x[1]);
if (!live.length) console.log('note LIVE_NAMES absent on this ref (fixture only)');
else ok(live.length === 1 && live[0] === JOB_NAMES_FIXTURE, `N9 the shared job NAMES equals the fixture (LIVE_NAMES ${live.length === 1 && live[0] === JOB_NAMES_FIXTURE ? 'match' : 'MISMATCH'})`);

console.log(bad ? `FAIL shot-names controls (${bad} failed)` : 'PASS shot-names controls');
process.exit(bad ? 1 : 0);
