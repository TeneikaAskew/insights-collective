#!/usr/bin/env node
// ABOUTME: Controls for the public lane's fixed-name screenshots: the pinned #148 capture core (materialized from its git
// ABOUTME: blobs), every decision branch, the private write, and the evidence export grammar. No browser, no stack.
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SHOT_CORE_PINS } from '../helper-pins.mjs';
import { PUBLIC_SHOT_PLAN, PUBLIC_SHOT_NAMES, CARRIER_ID, loadShotCore, publicShotSecrets, decidePublicShot, writePublicShot, ShotError } from '../shot-plan.mjs';
import { exportShots, pngSize } from '../shot-export.mjs';
import { PAIRING_TAG_ID } from '../pairing-producer.mjs';

let bad = 0;
const ok = (c, n) => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); };
const HERE = path.dirname(fileURLToPath(import.meta.url)); const DIR = path.resolve(HERE, '..'); const ROOT = path.resolve(DIR, '../..');
const tmp = fs.mkdtempSync(path.join(tmpdir(), 'pc-shot-'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Plan.
ok(JSON.stringify(PUBLIC_SHOT_NAMES) === JSON.stringify(['PC-catalog-desktop-1440x900', 'PC-catalog-tablet-834x1112', 'PC-catalog-mobile-390x844', 'PC-rail-desktop-1180x757']), 'S1 exactly the 4 fixed names agreed with the job contract');
ok(PUBLIC_SHOT_NAMES.every((n) => { const p = PUBLIC_SHOT_PLAN[n]; return n.endsWith(`-${p.project}-${p.width}x${p.height}`) && p.path === '/courses'; }), 'S2 each name carries its project and exact viewport; every route is /courses');
ok(PUBLIC_SHOT_PLAN['PC-rail-desktop-1180x757'].project === 'desktop' && !PUBLIC_SHOT_NAMES.some((n) => /768/.test(n) || /rail-tablet|rail-mobile/.test(n)), 'S3 rail is desktop only at 1180x757 (no 768, no tablet rail)');
ok(CARRIER_ID === PAIRING_TAG_ID, 'S4 the scanned carrier id equals the producer constant');

// Core: materialize the pinned blobs into a temp root from this repo's object store; drift refuses before import.
const coreRoot = path.join(tmp, 'core');
for (const [rel, blob] of Object.entries(SHOT_CORE_PINS)) { fs.mkdirSync(path.dirname(path.join(coreRoot, rel)), { recursive: true }); fs.writeFileSync(path.join(coreRoot, rel), execFileSync('git', ['-C', ROOT, 'cat-file', 'blob', blob])); }
const core = await loadShotCore(coreRoot);
ok(typeof core.SHOT_GUARD === 'function' && typeof core.captureShot === 'function' && typeof core.scanPage === 'function', 'C1 the pinned #148 core loads (SHOT_GUARD, captureShot, scanPage)');
const drift = path.join(tmp, 'drift'); fs.cpSync(coreRoot, drift, { recursive: true }); fs.appendFileSync(path.join(drift, 'e2e/gradebook-roles/journey/shot-core.mjs'), '\n');
let code = null; try { await loadShotCore(drift); } catch (e) { code = e.code; }
ok(code === 'PUBLIC_SHOT_E_CORE_PIN', 'C2 one changed byte in the core refuses before import (CORE_PIN)');
code = null; try { await loadShotCore(path.join(tmp, 'nothing')); } catch (e) { code = e.code; }
ok(code === 'PUBLIC_SHOT_E_CORE_PIN', 'C3 an absent core refuses (CORE_PIN)');

// Secrets.
const NONCE = 'b'.repeat(32); const RUN = 'c'.repeat(32);
const env = { PUBLIC_ACCEPT_RUN_ID: RUN, PUBLIC_ACCEPT_ANON_KEY: 'anon-key-for-controls-0123456789', PUBLIC_ACCEPT_DB_URL: 'postgresql://postgres@127.0.0.1:54322/postgres' };
const secrets = publicShotSecrets(env, NONCE);
ok(secrets.length === 5 && secrets.map((s) => s.label).join() === 'NONCE,RUN,CARRIER,CREDENTIAL,CREDENTIAL', 'K1 five scanned values: nonce, run id, carrier id, anon key, DB URL');
for (const [label, e, n] of [['K2 missing anon key', { ...env, PUBLIC_ACCEPT_ANON_KEY: '' }, NONCE], ['K3 missing DB URL', { ...env, PUBLIC_ACCEPT_DB_URL: undefined }, NONCE], ['K4 bad run id', { ...env, PUBLIC_ACCEPT_RUN_ID: 'x' }, NONCE], ['K5 bad nonce', env, 'zz']]) {
  let c = null; try { publicShotSecrets(e, n); } catch (x) { c = x.code; } ok(c && c.startsWith('PUBLIC_SHOT_E_NO_'), `${label} refuses (${c})`);
}

// Decisions (the #148 order through captureShot with a fake driver, then the lane decision).
const APP = 'http://127.0.0.1:4173'; const API = 'http://127.0.0.1:54321';
const S = (o = {}) => ({ url: `${APP}/courses`, texts: ['PCA Analytics Course', '<html></html>', '', 'Insights', `${APP}/courses`], images: [`${APP}/hermetic.png`], surfaces: 0, ...o });
const base = (name, o = {}) => { const p = PUBLIC_SHOT_PLAN[name]; return { project: p.project, viewport: { width: p.width, height: p.height }, appOrigin: APP, apiOrigin: API, ...o }; };
const png = (w, h) => { const b = Buffer.alloc(80); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'latin1'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
async function capture(name, { before = S(), after = before, n = 0, nav = 0, tokenOk = true, throwAt = null, bo = {} } = {}) {
  let calls = 0; const order = [];
  const drv = {
    watchNav: (cb) => { order.push('watch'); for (let i = 0; i < nav; i++) cb(); return () => order.push('unwatch'); },
    guard: async (op, t) => { order.push(op); if (throwAt === op) throw new Error('x'); return op === 'arm' ? t : { token: tokenOk ? t : null, n }; },
    sample: async () => { order.push('sample'); calls += 1; return calls === 1 ? before : after; },
    screenshot: async () => { order.push('screenshot'); if (throwAt === 'screenshot') throw new Error('x'); const p = PUBLIC_SHOT_PLAN[name]; return png(p.width, p.height + 300); },
  };
  const r = await core.captureShot(drv, base(name, bo), 'a'.repeat(32), secrets);
  return { ...r, order, d: decidePublicShot(name, r.obs, secrets, core.scanPage) };
}
const N0 = 'PC-catalog-desktop-1440x900';
const pos = await capture(N0);
ok(pos.d.write === true && pos.order.join() === 'watch,arm,sample,screenshot,sample,read,unwatch', 'D1 positive: #148 window order watch,arm,sample,screenshot,sample,read,unwatch; write');
const cases = [
  ['D2 wrong project', N0, { bo: { project: 'tablet' } }, 'PERSONA'],
  ['D3 wrong viewport', N0, { bo: { viewport: { width: 1180, height: 757 } } }, 'VIEWPORT'],
  ['D4 rail captured at catalog viewport', 'PC-rail-desktop-1180x757', { bo: { viewport: { width: 1440, height: 900 } } }, 'VIEWPORT'],
  ['D5 query on the route', N0, { before: S({ url: `${APP}/courses?category=x` }) }, 'ROUTE'],
  ['D6 other path', N0, { before: S({ url: `${APP}/` }) }, 'ROUTE'],
  ['D7 foreign origin', N0, { before: S({ url: 'http://127.0.0.1:9999/courses' }) }, 'ROUTE'],
  ['D8 iframe surface', N0, { before: S({ surfaces: 1 }) }, 'UNSUPPORTED_SURFACE'],
  ['D9 off-origin image', N0, { before: S({ images: ['https://i.pravatar.cc/1'] }) }, 'UNSUPPORTED_SURFACE'],
  ['D10 nonce in page before', N0, { before: S({ texts: ['x', `id ${NONCE}`, '', 't', 'u'] }) }, 'DIRTY_BEFORE'],
  ['D11 carrier id in markup', N0, { before: S({ texts: ['x', `<a href="/t/${CARRIER_ID}">`, '', 't', 'u'] }) }, 'DIRTY_BEFORE'],
  ['D12 anon key in a form value', N0, { before: S({ texts: ['x', 'y', env.PUBLIC_ACCEPT_ANON_KEY, 't', 'u'] }) }, 'DIRTY_BEFORE'],
  ['D13 navigation in window', N0, { nav: 1 }, 'NAVIGATED'],
  ['D14 new document (token lost)', N0, { tokenOk: false }, 'NAVIGATED'],
  ['D15 mutation in window', N0, { n: 2 }, 'MUTATED'],
  ['D16 page changed between samples', N0, { after: S({ texts: ['other', '<html></html>', '', 'Insights', `${APP}/courses`] }) }, 'CHANGED'],
  ['D17 screenshot threw', N0, { throwAt: 'screenshot' }, 'INCOMPLETE'],
  ['D18 guard read threw', N0, { throwAt: 'read' }, 'INCOMPLETE'],
];
for (const [label, name, o, want] of cases) { const r = await capture(name, o); ok(r.d.write === false && r.d.reason === want, `${label}: withheld ${want} (got ${r.d.reason ?? 'write'})`); }
const dirty = await capture(N0, { before: S({ texts: ['x', NONCE, '', 't', 'u'] }) });
ok(dirty.png === null && !dirty.order.includes('screenshot'), 'D19 a dirty BEFORE sample makes no screenshot call at all');
let nc = null; try { decidePublicShot('PC-other', pos.obs, secrets, core.scanPage); } catch (e) { nc = e.code; } ok(nc === 'PUBLIC_SHOT_E_NAME', 'D20 an unknown name throws NAME');

// Private write + export.
const mkdir700 = (p) => { fs.mkdirSync(p, { mode: 0o700 }); fs.chmodSync(p, 0o700); return p; };
async function fullDir(tag, opts = {}) {
  const d = mkdir700(path.join(tmp, `shots-${tag}`));
  for (const name of PUBLIC_SHOT_NAMES) { const r = await capture(name, opts[name] ?? {}); writePublicShot(d, name, r.png, r.obs, secrets, core.scanPage); }
  return d;
}
const runExport = (d, tag) => { const out = path.join(tmp, `ev-${tag}`); fs.mkdirSync(out); const sd = path.join(out, 'screenshots'); const man = path.join(out, 'screenshots.txt');
  const r = spawnSync(process.execPath, [path.join(DIR, 'shot-export.mjs'), d, sd, man], { encoding: 'utf8' });
  return { rc: r.status, out: r.stdout.trim(), sd, man, ls: fs.existsSync(sd) ? fs.readdirSync(sd).sort() : null, lines: fs.existsSync(man) ? fs.readFileSync(man, 'utf8').split('\n') : null }; };
const good = await fullDir('good');
ok(fs.readdirSync(good).length === 8 && PUBLIC_SHOT_NAMES.every((n) => (fs.statSync(path.join(good, `${n}.png`)).mode & 0o777) === 0o600), 'W1 private write: one 0600 PNG + scan record per name');
const e1 = runExport(good, 'good');
const grammar = /^(SHOT PC-[a-z]+-[a-z]+-\d+x\d+ [0-9a-f]{64}|WITHHELD PC-[a-z]+-[a-z]+-\d+x\d+ [A-Z_]+)$/;
ok(e1.rc === 0 && e1.out === 'PUBLIC_SHOT_EXPORT_OK' && JSON.stringify(e1.ls) === JSON.stringify(PUBLIC_SHOT_NAMES.map((n) => `${n}.png`).sort()), 'E1 positive: exit 0, screenshots/ holds exactly the 4 PNGs');
ok(e1.lines.at(-1) === '' && e1.lines.slice(0, -1).length === 4 && e1.lines.slice(0, -1).every((l) => grammar.test(l) && l.startsWith('SHOT ')), 'E2 manifest: exactly 4 `SHOT <name> <sha256>` lines, no other line');
ok(e1.lines.slice(0, -1).every((l) => { const [, n, h] = l.split(' '); return require_sha(path.join(e1.sd, `${n}.png`)) === h; }), 'E3 each manifest hash is the sha256 of the exported file bytes');
function require_sha(p) { return execFileSync('sha256sum', [p], { encoding: 'utf8' }).split(' ')[0]; }
ok((fs.statSync(e1.sd).mode & 0o777) === 0o700 && e1.ls.every((f) => { const st = fs.lstatSync(path.join(e1.sd, f)); return st.isFile() && (st.mode & 0o777) === 0o600; }) && fs.lstatSync(e1.man).isFile(), 'E4 modes: screenshots/ 0700, PNGs 0600 regular, manifest a regular file');
ok(e1.ls.every((f) => { const { width } = pngSize(fs.readFileSync(path.join(e1.sd, f))); return width === PUBLIC_SHOT_PLAN[f.slice(0, -4)].width; }), 'E5 every PNG width equals its viewport width');
const wd = await fullDir('withheld', { 'PC-catalog-mobile-390x844': { n: 1 } });
const e2 = runExport(wd, 'withheld');
ok(e2.rc === 1 && e2.ls.length === 3 && e2.lines.includes('WITHHELD PC-catalog-mobile-390x844 MUTATED') && e2.lines.filter((l) => l.startsWith('SHOT ')).length === 3, 'E6 one withheld: exit 1 (run fails), its WITHHELD line, the dir equals the 3 SHOT lines');
const malformed = [
  ['E7 extra file', async (d) => fs.writeFileSync(path.join(d, 'extra.txt'), 'x')],
  ['E8 PNG bytes changed after the scan record', async (d) => fs.appendFileSync(path.join(d, `${N0}.png`), 'x')],
  ['E9 missing outcome for a name', async (d) => { fs.unlinkSync(path.join(d, `${N0}.png`)); fs.unlinkSync(path.join(d, `${N0}.scan.json`)); }],
  ['E10 PNG replaced by a symlink', async (d) => { const p = path.join(d, `${N0}.png`); const keep = path.join(tmp, `keep-${Date.now()}`); fs.renameSync(p, keep); fs.symlinkSync(keep, p); }],
  ['E11 PNG and withheld record both present', async (d) => fs.writeFileSync(path.join(d, `${N0}.withheld.json`), JSON.stringify({ name: N0, withheld: true, reason: 'MUTATED' }))],
  ['E12 a hardlinked PNG', async (d) => fs.linkSync(path.join(d, `${N0}.png`), path.join(tmp, `hl-${Date.now()}`))],
  ['E13 shot dir mode 0755', async (d) => fs.chmodSync(d, 0o755)],
];
let i = 0;
for (const [label, mutate] of malformed) { const d = await fullDir(`m${i}`); await mutate(d); const r = runExport(d, `m${i++}`); ok(r.rc === 2 && r.ls === null && r.lines === null && /^PUBLIC_SHOT_E_[A-Z_]+$/.test(r.out), `${label}: exit 2, nothing exported (${r.out})`); }
{ const d = mkdir700(path.join(tmp, 'dims')); for (const name of PUBLIC_SHOT_NAMES) { const r = await capture(name); const p = PUBLIC_SHOT_PLAN[name]; writePublicShot(d, name, name === N0 ? png(p.width * 2, p.height * 2) : r.png, r.obs, secrets, core.scanPage); }
  const r = runExport(d, 'dims'); ok(r.rc === 2 && r.out === 'PUBLIC_SHOT_E_DIMENSIONS' && r.ls === null, 'E14 a PNG not at its viewport width (device scale 2) refuses, nothing exported'); }
{ const out = path.join(tmp, 'ev-exists'); fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true }); const r = spawnSync(process.execPath, [path.join(DIR, 'shot-export.mjs'), good, path.join(out, 'screenshots'), path.join(out, 'screenshots.txt')], { encoding: 'utf8' });
  ok(r.status === 2 && r.stdout.trim() === 'PUBLIC_SHOT_E_OUT', 'E15 an existing output dir refuses'); }
{ let c = null; try { writePublicShot(good, N0, pos.png, pos.obs, secrets, core.scanPage); } catch (e) { c = e.code; } ok(c === 'PUBLIC_SHOT_E_EXCLUSIVE_CREATE', 'W2 a second write of the same name refuses (exclusive create)'); }

// Static: placement, config, run.sh order.
const cat = read('e2e/public-catalog/catalog.spec.ts'); const rail = read('e2e/public-catalog/sidebar-rail.spec.ts'); const cfg = read('playwright.public-catalog.config.ts'); const runsh = read('scripts/public-catalog-fixture/run.sh');
const a1 = cat.slice(cat.indexOf("test('A1 "), cat.indexOf("test('A2 "));
ok((cat.match(/await shot\(/g) ?? []).length === 1 && a1.includes('await shot(page, info, CATALOG_SHOT[info.project.name]);') && a1.indexOf('await shot(') > a1.lastIndexOf('expect('), 'T1 catalog: one shot call, inside A1, after its last assertion');
ok((rail.match(/await shot\(/g) ?? []).length === 1 && rail.indexOf("await shot(page, info, 'PC-rail-desktop-1180x757')") > rail.lastIndexOf('expect(') && rail.indexOf("test.skip(info.project.name !== 'desktop'") < rail.indexOf('await shot('), 'T2 rail: one shot call after the desktop-only skip and after its last assertion');
ok(/screenshot: 'off' as const/.test(cfg) && !/screenshot: '(on|only-on-failure)'/.test(cfg), 'T3 Playwright screenshot option stays off');
const at = (s) => runsh.indexOf(s);
ok(at('SHOT_CORE_PINS') < at('step guards') && at('mkdir -m 700 "$PRIV/shots"') < at('step browser') && at('step browser') < at('step shots') && at('step shots') < at('step W2') && /screenshots\.exit"\)" = 0 \] \|\| rc=1/.test(runsh), 'T4 run.sh: core pins first; private shot dir before browser; export after browser, before W2; a non-zero export fails the run');
ok(!/\bfrom ['"].*gradebook-roles/.test(read('scripts/public-catalog-fixture/shot-plan.mjs')) && !/gradebook-roles/.test(read('e2e/public-catalog/shot.ts')), 'T5 the #148 core is reached only through the pinned dynamic import (no static import)');

console.log(bad ? `${bad} FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
