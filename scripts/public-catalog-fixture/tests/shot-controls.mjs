#!/usr/bin/env node
// ABOUTME: Controls for the public lane's fixed-name screenshots: the pinned #148 capture core (materialized from its git
// ABOUTME: blobs), every decision branch, the private write, and the evidence export grammar. No browser, no stack.
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { SHOT_CORE_PINS, checkHelperPins } from '../helper-pins.mjs';
import { PUBLIC_SHOT_PLAN, PUBLIC_SHOT_NAMES, CARRIER_ID, loadShotCore, publicShotSecrets, decidePublicShot, writePublicShot, ShotError } from '../shot-plan.mjs';
import { exportShots, loadExportCore } from '../shot-export.mjs';
import { PAIRING_TAG_ID } from '../pairing-producer.mjs';

let bad = 0;
const ok = (c, n) => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); };
const HERE = path.dirname(fileURLToPath(import.meta.url)); const DIR = path.resolve(HERE, '..'); const ROOT = path.resolve(DIR, '../..');
const tmp = fs.mkdtempSync(path.join(tmpdir(), 'pc-shot-'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Plan.
ok(JSON.stringify(PUBLIC_SHOT_NAMES) === JSON.stringify(['PC-catalog-desktop-1440x900', 'PC-catalog-tablet-768x1024', 'PC-catalog-mobile-390x844', 'PC-rail-desktop-1180x757']), 'S1 exactly the 4 fixed names agreed with the job contract');
ok(PUBLIC_SHOT_NAMES.every((n) => { const p = PUBLIC_SHOT_PLAN[n]; return n.endsWith(`-${p.project}-${p.width}x${p.height}`) && p.path === '/courses'; }), 'S2 each name carries its project and exact viewport; every route is /courses');
ok(PUBLIC_SHOT_PLAN['PC-rail-desktop-1180x757'].project === 'desktop' && PUBLIC_SHOT_PLAN['PC-catalog-tablet-768x1024'].project === 'tablet-768' && !PUBLIC_SHOT_NAMES.some((n) => /834/.test(n) || /rail-tablet|rail-mobile/.test(n)), 'S3 rail is desktop only at 1180x757; the tablet shot is 768x1024 (no 834 name, no tablet rail)');
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
async function capture(name, { before = S(), after = before, n = 0, nav = 0, tokenOk = true, throwAt = null, bo = {}, shotBytes = null } = {}) {
  let calls = 0; const order = [];
  const drv = {
    watchNav: (cb) => { order.push('watch'); for (let i = 0; i < nav; i++) cb(); return () => order.push('unwatch'); },
    guard: async (op, t) => { order.push(op); if (throwAt === op) throw new Error('x'); return op === 'arm' ? t : { token: tokenOk ? t : null, n }; },
    sample: async () => { order.push('sample'); calls += 1; return calls === 1 ? before : after; },
    screenshot: async () => { order.push('screenshot'); if (throwAt === 'screenshot') throw new Error('x'); if (shotBytes) return shotBytes; const p = PUBLIC_SHOT_PLAN[name]; return png(p.width, p.height + 300); },
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

// Private write + export, through the pinned #148 export primitives (materialized above with the rest of the core).
const { createRequire } = await import('node:module');
const zlib = await import('node:zlib');
const { crc32 } = await import(pathToFileURL(path.join(coreRoot, 'scripts/gradebook-fixture/journey/shot-export.mjs')).href);
const xcore = await loadExportCore(coreRoot);
// Real PNGs: Chromium screenshots of a synthetic page at each name's exact viewport (full page, as the capture does).
const realPng = {};
{ // The environment's preinstalled Playwright + Chromium (resolved outside the repo, so a repo-pinned Playwright cannot shadow it).
  const { chromium } = createRequire(path.join(tmpdir(), 'pc-shot-resolve.cjs'))('playwright'); const b = await chromium.launch();
  try { for (const name of PUBLIC_SHOT_NAMES) { const p = PUBLIC_SHOT_PLAN[name]; const pg = await b.newPage({ viewport: { width: p.width, height: p.height }, deviceScaleFactor: 1 });
    await pg.setContent(`<body style="margin:0"><h1>PCA synthetic ${name}</h1><div style="height:${p.height + 400}px;background:#eef"></div></body>`); realPng[name] = await pg.screenshot({ fullPage: true, animations: 'disabled' }); await pg.close(); } }
  finally { await b.close(); } }
const chunk = (type, body) => { const t = Buffer.from(type, 'latin1'); const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, body]))); return Buffer.concat([len, t, body, crc]); };
const IEND_AT = (b) => b.length - 12;
const withText = (b, text) => Buffer.concat([b.subarray(0, 33), chunk('tEXt', Buffer.from(text, 'latin1')), b.subarray(33)]);
const mkdir700 = (p) => { fs.mkdirSync(p, { mode: 0o700 }); fs.chmodSync(p, 0o700); return p; };
let seq = 0;
/** A shot dir written by the real writePublicShot; override[name] = bytes to capture instead of the real PNG. */
async function fullDir(override = {}, opts = {}) {
  const d = mkdir700(path.join(tmp, `shots-${seq++}`));
  for (const name of PUBLIC_SHOT_NAMES) {
    const r = await capture(name, { ...(opts[name] ?? {}), shotBytes: override[name] ?? realPng[name] });
    writePublicShot(d, name, r.png, r.obs, secrets, core.scanPage);
  }
  return d;
}
async function exp(d, o = {}) {
  const out = path.join(tmp, `ev-${seq++}`); fs.mkdirSync(out); const sd = path.join(out, 'screenshots'); const man = path.join(out, 'screenshots.txt');
  let rc, code = null; try { rc = await exportShots(d, sd, man, { core: xcore, ...o }); } catch (e) { rc = 2; code = e.code; }
  return { rc, code, sd, man, ls: fs.existsSync(sd) ? fs.readdirSync(sd).sort() : null, lines: fs.existsSync(man) ? fs.readFileSync(man, 'utf8').split('\n') : null };
}
const grammar = /^(SHOT PC-[a-z]+-[a-z]+-\d+x\d+ [0-9a-f]{64}|WITHHELD PC-[a-z]+-[a-z]+-\d+x\d+ [A-Z_]+)$/;
const sum = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const good = await fullDir();
ok(fs.readdirSync(good).length === 8 && PUBLIC_SHOT_NAMES.every((n) => (fs.statSync(path.join(good, `${n}.png`)).mode & 0o777) === 0o600), 'W1 private write: one 0600 real Chromium PNG + scan record per name');
const e1 = await exp(good);
ok(e1.rc === 0 && JSON.stringify(e1.ls) === JSON.stringify(PUBLIC_SHOT_NAMES.map((n) => `${n}.png`).sort()), 'E1 real valid PNG positive: exit 0, screenshots/ holds exactly the 4 PNGs');
ok(e1.lines.at(-1) === '' && e1.lines.length === 5 && e1.lines.slice(0, -1).every((l) => grammar.test(l) && l.startsWith('SHOT ')), 'E2 manifest: exactly 4 `SHOT <name> <sha256>` lines, no other line');
ok(e1.lines.slice(0, -1).every((l) => { const [, n, h] = l.split(' '); return sum(path.join(e1.sd, `${n}.png`)) === h; }), 'E3 final manifest hash = sha256 of each exported file');
ok((fs.statSync(e1.sd).mode & 0o777) === 0o700 && e1.ls.every((f) => { const st = fs.lstatSync(path.join(e1.sd, f)); return st.isFile() && (st.mode & 0o777) === 0o600; }) && fs.lstatSync(e1.man).isFile(), 'E4 modes: screenshots/ 0700, PNGs 0600 regular, manifest a regular file');
ok(e1.ls.every((f) => { const b = fs.readFileSync(path.join(e1.sd, f)); return b.readUInt32BE(16) === PUBLIC_SHOT_PLAN[f.slice(0, -4)].width && b.toString('latin1', IEND_AT(b) + 4, IEND_AT(b) + 8) === 'IEND'; }), 'E5 every exported PNG has its exact viewport width and ends in IEND');

// The old 80-byte false positive: signature + IHDR only, zero-filled, no IDAT/IEND. Accepted 4/4 by 823c88b; refused now.
const fake80 = Object.fromEntries(PUBLIC_SHOT_NAMES.map((n) => { const p = PUBLIC_SHOT_PLAN[n]; const b = Buffer.alloc(80); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'latin1'); b.writeUInt32BE(p.width, 16); b.writeUInt32BE(p.height + 300, 20); return [n, b]; }));
const f80 = await exp(await fullDir(fake80));
ok(f80.rc === 2 && f80.ls === null && f80.lines === null && /^PUBLIC_SHOT_E_PNG_/.test(f80.code), `E6 four 80-byte IHDR-only files (old false positive): exit 2, nothing written (${f80.code})`);

const R0 = realPng[N0];
const badCrc = Buffer.from(R0); badCrc[29] ^= 0xff;                                 // inside IHDR body -> CRC mismatch
const pngCases = [
  ['E7 CRC mismatch', badCrc, 'PUBLIC_SHOT_E_PNG_CRC'],
  ['E8 truncated (IEND cut)', R0.subarray(0, R0.length - 6), 'PUBLIC_SHOT_E_PNG_TRUNCATED'],
  ['E9 trailing bytes after IEND', Buffer.concat([R0, Buffer.from('trailing')]), 'PUBLIC_SHOT_E_PNG_TRAILING'],
  ['E10 trailing chunk after IEND', Buffer.concat([R0, chunk('tEXt', Buffer.from('k\0v'))]), 'PUBLIC_SHOT_E_PNG_TRAILING'],
  ['E11 unknown critical chunk', Buffer.concat([R0.subarray(0, 33), chunk('ZZZZ', Buffer.from('x')), R0.subarray(33)]), 'PUBLIC_SHOT_E_PNG_CHUNK'],
];
for (const [label, bytes, want] of pngCases) { const r = await exp(await fullDir({ [N0]: bytes })); ok(r.rc === 2 && r.code === want && r.ls === null && r.lines === null, `${label}: exit 2 ${want}, nothing written (got ${r.code})`); }
{ const anc = withText(R0, `Comment\0painted ${NONCE}`); const d = await fullDir({ [N0]: anc }); const r = await exp(d);
  const out = fs.readFileSync(path.join(r.sd, `${N0}.png`)); const line = r.lines.find((l) => l.startsWith(`SHOT ${N0} `));
  ok(r.rc === 0 && !out.includes(Buffer.from('tEXt')) && !out.includes(Buffer.from(NONCE)) && out.equals(R0) && line === `SHOT ${N0} ${createHash('sha256').update(R0).digest('hex')}` && line.split(' ')[2] !== createHash('sha256').update(anc).digest('hex'),
    'E12 ancillary tEXt is stripped by sanitizePng: exported bytes = the critical chunks, manifest hashes the RESULT, not the original'); }
{ const d = await fullDir(); const p = path.join(d, `${N0}.scan.json`); const rec = JSON.parse(fs.readFileSync(p, 'utf8')); fs.unlinkSync(p);
  fs.writeFileSync(p, JSON.stringify({ ...rec, sha256: createHash('sha256').update(Buffer.from('other')).digest('hex') }), { mode: 0o600 });
  const r = await exp(d); ok(r.rc === 2 && r.code === 'PUBLIC_SHOT_E_RECORD' && r.ls === null, 'E13 scan record hash not equal to the ORIGINAL bytes: RECORD, nothing written'); }
const fileCases = [
  ['E14 PNG mode 0644', (d) => fs.chmodSync(path.join(d, `${N0}.png`), 0o644), 'PUBLIC_SHOT_E_MODE'],
  ['E15 scan record mode 0644', (d) => fs.chmodSync(path.join(d, `${N0}.scan.json`), 0o644), 'PUBLIC_SHOT_E_MODE'],
  ['E16 withheld record mode 0644', null, 'PUBLIC_SHOT_E_MODE'],
  ['E17 PNG owned by another uid', (d) => fs.chownSync(path.join(d, `${N0}.png`), 4242, 4242), 'PUBLIC_SHOT_E_MODE'],
  ['E18 PNG is a symlink', (d) => { const p = path.join(d, `${N0}.png`); const k = path.join(tmp, `keep-${seq++}`); fs.renameSync(p, k); fs.symlinkSync(k, p); }, 'PUBLIC_SHOT_E_OPEN'],
  ['E19 PNG hardlinked elsewhere', (d) => fs.linkSync(path.join(d, `${N0}.png`), path.join(tmp, `hl-${seq++}`)), 'PUBLIC_SHOT_E_LINKS'],
  ['E20 PNG is a FIFO', (d) => { const p = path.join(d, `${N0}.png`); fs.unlinkSync(p); execFileSync('mkfifo', ['-m', '600', p]); }, 'PUBLIC_SHOT_E_TYPE'],
  ['E21 extra file', (d) => fs.writeFileSync(path.join(d, 'extra.txt'), 'x', { mode: 0o600 }), 'PUBLIC_SHOT_E_EXTRA'],
  ['E22 missing outcome for a name', (d) => { fs.unlinkSync(path.join(d, `${N0}.png`)); fs.unlinkSync(path.join(d, `${N0}.scan.json`)); }, 'PUBLIC_SHOT_E_MISSING'],
  ['E23 PNG and withheld record both present', (d) => fs.writeFileSync(path.join(d, `${N0}.withheld.json`), JSON.stringify({ name: N0, withheld: true, reason: 'MUTATED' }), { mode: 0o600 }), 'PUBLIC_SHOT_E_BOTH'],
  ['E24 shot dir mode 0755', (d) => fs.chmodSync(d, 0o755), 'PUBLIC_SHOT_E_DIR'],
];
for (const [label, mutate, want] of fileCases) {
  const d = mutate ? await fullDir() : await fullDir({}, { 'PC-catalog-mobile-390x844': { n: 1 } });
  if (mutate) mutate(d); else fs.chmodSync(path.join(d, 'PC-catalog-mobile-390x844.withheld.json'), 0o644);
  const r = await exp(d); ok(r.rc === 2 && r.code === want && r.ls === null && r.lines === null, `${label}: exit 2 ${want}, nothing written (got ${r.code})`);
}
{ // Changed handle: the file grows between fstat and the bounded read on the same fd (injected io; the real #148 readHandle).
  const d = await fullDir(); const target = path.join(d, `${N0}.png`);
  const io = { ...fs, readSync: (fd, buf, off, len, pos) => { const n = fs.readSync(fd, buf, off, len, pos); if (n > 0 && off === 0) fs.appendFileSync(target, 'grow'); return n; } };
  const r = await exp(d, { io }); ok(r.rc === 2 && r.code === 'PUBLIC_SHOT_E_GROWTH' && r.ls === null, `E25 file changed under the open handle: GROWTH, nothing written (got ${r.code})`); }
{ const r = await exp(await fullDir({ [N0]: realPng['PC-catalog-tablet-768x1024'] })); ok(r.rc === 2 && r.code === 'PUBLIC_SHOT_E_DIMENSIONS' && r.ls === null, 'E26 a valid PNG at another viewport width: DIMENSIONS, nothing written'); }
const wd = await fullDir({}, { 'PC-catalog-mobile-390x844': { n: 1 } });
const ew = await exp(wd);
ok(ew.rc === 1 && ew.ls.length === 3 && ew.lines.includes('WITHHELD PC-catalog-mobile-390x844 MUTATED') && ew.lines.filter((l) => l.startsWith('SHOT ')).length === 3 && ew.lines.slice(0, -1).every((l) => grammar.test(l)), 'E27 one withheld: exit 1 (run fails), its WITHHELD line, the dir equals the 3 SHOT lines');
{ const out = path.join(tmp, `ev-exists-${seq++}`); fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true }); let c = null; try { await exportShots(good, path.join(out, 'screenshots'), path.join(out, 'screenshots.txt'), { core: xcore }); } catch (e) { c = e.code; }
  ok(c === 'PUBLIC_SHOT_E_OUT', 'E28 an existing output dir refuses'); }
{ const out = path.join(tmp, `ev-cli-${seq++}`); fs.mkdirSync(out); const r = spawnSync(process.execPath, [path.join(DIR, 'shot-export.mjs'), good, path.join(out, 's'), path.join(out, 'm')], { encoding: 'utf8' });
  const coreHere = checkHelperPins(ROOT, SHOT_CORE_PINS).length === 0;
  ok(coreHere ? (r.status === 0 && r.stdout.trim() === 'PUBLIC_SHOT_EXPORT_OK') : (r.status === 2 && r.stdout.trim() === 'PUBLIC_SHOT_E_CORE_PIN' && !fs.existsSync(path.join(out, 's'))), `E29 actual CLI on this tree: ${coreHere ? 'pinned core present, exit 0' : 'core absent, CORE_PIN, nothing written'} (${r.stdout.trim()})`); }
{ let c = null; try { writePublicShot(good, N0, R0, pos.obs, secrets, core.scanPage); } catch (e) { c = e.code; } ok(c === 'PUBLIC_SHOT_E_EXCLUSIVE_CREATE', 'W2 a second write of the same name refuses (exclusive create)'); }

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
