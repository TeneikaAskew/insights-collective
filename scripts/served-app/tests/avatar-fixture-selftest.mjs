#!/usr/bin/env node
// ABOUTME: Controls for avatar-fixture.mjs. Static: synthetic product dist -> hermetic copy -> fixture copy, one positive and
// ABOUTME: one fixed-code negative per refusal. Browser (optional, real build): before/after on `/` with every foreign request aborted.
// Browser tier: the loopback API origin is STUBBED (every call answers 200 []) so `/` renders without a stack; this is a
// served-bytes control, not authentic public-UI evidence. Every other origin is aborted before send.
// Usage: avatar-fixture-selftest.mjs [<product dist> <hermetic copy> <fixture copy>]   (browser part only with the three dirs)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { make as makeHermetic, REMOVED_LINE } from '../hermetic-dist.mjs';
import { SUBSTITUTIONS } from '../avatar-fixture.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'avatar-fixture.mjs');
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` -> ${detail}` : ''}`); };
const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' }).status;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avf-'));
try {
  const mk = (name, js, extra = {}) => {
    const d = path.join(tmp, name); fs.mkdirSync(path.join(d, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(d, 'index.html'), `<html><head>\n  ${REMOVED_LINE}\n</head><body><div id="root"></div></body></html>\n`);
    fs.writeFileSync(path.join(d, 'assets', 'app.js'), js);
    fs.writeFileSync(path.join(d, 'assets', 'app.js.map'), JSON.stringify({ sourcesContent: [SUBSTITUTIONS.map((s) => s.from).join(' ')] }));
    for (const [f, b] of Object.entries(extra)) fs.writeFileSync(path.join(d, f), b);
    const h = `${d}-h`; makeHermetic(d, h); return [d, h];
  };
  const good = `const t=[${SUBSTITUTIONS.map((s) => `{avatar:"${s.from}"}`).join(',')}];\n`;
  const [d1, h1] = mk('good', good);
  check('P1 make', run('make', d1, h1, path.join(tmp, 'o1')) === 0);
  check('P2 verify', run('verify', d1, h1, path.join(tmp, 'o1')) === 0);
  const js = fs.readFileSync(path.join(tmp, 'o1', 'assets', 'app.js'), 'utf8');
  check('P3 no provider reference left in served JS', !js.includes('pravatar') && SUBSTITUTIONS.every((s) => js.includes(`"${s.to}"`)));
  check('P4 source map byte-identical', fs.readFileSync(path.join(tmp, 'o1', 'assets', 'app.js.map')).equals(fs.readFileSync(path.join(h1, 'assets', 'app.js.map'))));
  check('N1 usage', run('make', d1, h1) === 20);
  check('N2 hermetic copy = product (not verified)', run('make', d1, d1, path.join(tmp, 'o2')) === 21);
  const [d3, h3] = mk('dup', good + `const u="${SUBSTITUTIONS[0].from}";\n`);
  check('N3 a source occurs twice', run('make', d3, h3, path.join(tmp, 'o3')) === 22);
  const [d4, h4] = mk('moved', good.replace(SUBSTITUTIONS[1].from, 'x'));
  check('N4 a source is missing (source moved)', run('make', d4, h4, path.join(tmp, 'o4')) === 22);
  const [d5, h5] = mk('residual', good + 'const r="https://i.pravatar.cc/150?img=99";\n');
  check('N5 another provider URL remains', run('make', d5, h5, path.join(tmp, 'o5')) === 23);
  const [d10, h10] = mk('inindex', good.replace(`{avatar:"${SUBSTITUTIONS[2].from}"}`, '0'), {});
  const ix = path.join(h10, 'index.html');
  fs.writeFileSync(ix, fs.readFileSync(ix, 'utf8').replace('<div id="root"></div>', `<div id="root" data-a="${SUBSTITUTIONS[2].from}"></div>`));
  fs.writeFileSync(path.join(d10, 'index.html'), fs.readFileSync(path.join(d10, 'index.html'), 'utf8').replace('<div id="root"></div>', `<div id="root" data-a="${SUBSTITUTIONS[2].from}"></div>`));
  fs.rmSync(h10, { recursive: true }); makeHermetic(d10, h10);
  check('N10 a source in index.html (never substituted there)', run('make', d10, h10, path.join(tmp, 'o10')) === 22);
  check('N6 out dir exists', run('make', d1, h1, path.join(tmp, 'o1')) === 24);
  fs.writeFileSync(path.join(tmp, 'o1', 'extra.txt'), 'x');
  check('N7 extra file in fixture copy', run('verify', d1, h1, path.join(tmp, 'o1')) === 25);
  fs.rmSync(path.join(tmp, 'o1', 'extra.txt'));
  const svg = path.join(tmp, 'o1', 'hermetic-avatars', 'avatar-fixture-11.svg'); const keep = fs.readFileSync(svg);
  fs.writeFileSync(svg, Buffer.concat([keep, Buffer.from(' ')]));
  check('N8 fixture asset byte drift in copy', run('verify', d1, h1, path.join(tmp, 'o1')) === 26);
  fs.writeFileSync(svg, keep);
  const pv = path.join(tmp, 'o1', 'AVATAR-PROVENANCE.json'); const pkeep = fs.readFileSync(pv, 'utf8');
  fs.writeFileSync(pv, pkeep.replace('NOT production bytes', 'production bytes'));
  check('N9 provenance label weakened', run('verify', d1, h1, path.join(tmp, 'o1')) === 27);
  fs.writeFileSync(pv, pkeep);
  check('P5 restored copy verifies', run('verify', d1, h1, path.join(tmp, 'o1')) === 0);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

const [productDir, hermeticDir, fixtureDir] = process.argv.slice(2);
if (fixtureDir) {
  const { chromium } = await import('@playwright/test');
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' };
  const serve = (root) => new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(root, rel);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' }).end(fs.readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, origin: `http://127.0.0.1:${srv.address().port}` }));
  });
  const API = 'http://127.0.0.1:54321';
  const browser = await chromium.launch({ executablePath: process.env.GB_CHROMIUM_PATH || undefined });
  const visit = async (root) => {
    const { srv, origin } = await serve(root);
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const foreign = [];
    await context.route('**/*', (r) => { const o = new URL(r.request().url()).origin; if (o === origin) return r.continue(); if (o === API) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); foreign.push(o); return r.abort('blockedbyclient'); });
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    for (let i = 0; i < 12; i += 1) { await page.mouse.wheel(0, 800); await page.waitForTimeout(400); }   // lazy sections mount on view
    await page.waitForTimeout(2500);
    const avatars = await page.evaluate(() => [...document.querySelectorAll('img')].filter((i) => /Thompson|Johnson|Rodriguez/.test(i.alt))
      .map((i) => ({ alt: i.alt, loaded: i.complete && i.naturalWidth > 0, natural: i.naturalWidth, box: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)] })));
    const fallbacks = await page.evaluate(() => [...document.querySelectorAll('span.bg-muted.rounded-full')].map((e) => e.textContent).filter((t) => /^[ASM]$/.test(t ?? '')).sort());
    await context.close(); srv.close();
    return { foreign: [...new Set(foreign)], avatars, fallbacks };
  };
  const before = await visit(hermeticDir);
  const after = await visit(fixtureDir);
  await browser.close();
  check('B1 hermetic copy (no fixture): the page attempts i.pravatar.cc (blocked before send)', before.foreign.includes('https://i.pravatar.cc'), JSON.stringify(before.foreign));
  check('B2 hermetic copy: no avatar image mounts; the three fallback initials A, M, S render (provider blocked)', before.avatars.length === 0 && JSON.stringify(before.fallbacks) === '["A","M","S"]', JSON.stringify(before.fallbacks));
  check('B5 fixture copy: no fallback initial renders once the local images load', after.fallbacks.length === 0, JSON.stringify(after.fallbacks));
  check('B3 fixture copy: zero foreign attempts on /', after.foreign.length === 0, JSON.stringify(after.foreign));
  check('B4 fixture copy: three avatar images load, 150 px square source, 40x40 box', after.avatars.length === 3 && after.avatars.every((a) => a.loaded && a.natural === 150 && a.box[0] === 40 && a.box[1] === 40), JSON.stringify(after.avatars));
  void productDir;
}
console.log(fails === 0 ? 'PASS avatar-fixture selftest' : `FAIL avatar-fixture selftest: ${fails} case(s)`);
process.exit(fails === 0 ? 0 : 1);
