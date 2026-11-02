#!/usr/bin/env node
// ABOUTME: Controls for avatar-live-check.mjs with a FAKE fetch (no server, no browser): synthetic product dist -> hermetic
// ABOUTME: copy -> avatar-fixture copy; one positive, then one fixed-code negative per way the live binding can be wrong.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { make as makeHermetic, REMOVED_LINE } from '../hermetic-dist.mjs';
import { make as makeFixture, SUBSTITUTIONS } from '../avatar-fixture.mjs';
import { checkAvatarLive } from '../avatar-live-check.mjs';

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` -> ${detail}` : ''}`); };
const O = 'http://127.0.0.1:8080';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avl-'));
// A fake origin that serves files from one directory ('' = index.html); hooks change one answer.
const serveFrom = (dir, hook = () => null) => async (url, opts) => {
  if (opts?.redirect !== 'error') throw new Error('redirects must be refused');
  const rel = url.slice(O.length + 1) || 'index.html';
  const h = hook(rel); if (h) return h;
  const f = path.join(dir, rel);
  if (!fs.existsSync(f)) return new Response('not found', { status: 404 });
  return new Response(fs.readFileSync(f), { status: 200 });
};
try {
  const d = path.join(tmp, 'dist'); fs.mkdirSync(path.join(d, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(d, 'index.html'), `<html><head>\n  ${REMOVED_LINE}\n</head><body><div id="root"></div></body></html>\n`);
  fs.writeFileSync(path.join(d, 'assets', 'app-x1.js'), `const t=[${SUBSTITUTIONS.map((s) => `{avatar:"${s.from}"}`).join(',')}];\n`);
  fs.writeFileSync(path.join(d, 'assets', 'other-x2.js'), 'export const n=1;\n');
  const h = path.join(tmp, 'herm'); makeHermetic(d, h);
  const s = path.join(tmp, 'served'); makeFixture(d, h, s);
  const args = { appOrigin: O, productDist: d, hermeticDir: h, servedDir: s };

  let r = await checkAvatarLive({ ...args, fetchImpl: serveFrom(s) });
  check('P1 the served copy is bound live: index, the changed chunk and the three SVGs', r.ok === true && r.files === 5, JSON.stringify(r));
  r = await checkAvatarLive({ ...args, fetchImpl: serveFrom(h) });
  check('N1 origin serving the plain HERMETIC copy (same index) is refused', r.code === 'AL_BYTES', JSON.stringify(r));
  r = await checkAvatarLive({ ...args, fetchImpl: serveFrom(s, (rel) => (rel === 'assets/app-x1.js' ? new Response(fs.readFileSync(path.join(h, 'assets', 'app-x1.js')), { status: 200 }) : null)) });
  check('N2 a live chunk that still carries the provider URLs is refused', r.code === 'AL_BYTES', JSON.stringify(r));
  r = await checkAvatarLive({ ...args, fetchImpl: serveFrom(s, (rel) => (rel.endsWith('-13.svg') ? new Response('x', { status: 404 }) : null)) });
  check('N3 a missing fixture SVG is refused', r.code === 'AL_STATUS', JSON.stringify(r));
  r = await checkAvatarLive({ ...args, fetchImpl: serveFrom(s, (rel) => (rel.endsWith('-11.svg') ? new Response('<svg/>', { status: 200 }) : null)) });
  check('N4 different SVG bytes are refused', r.code === 'AL_BYTES', JSON.stringify(r));
  r = await checkAvatarLive({ ...args, fetchImpl: serveFrom(s, (rel) => { if (rel.endsWith('-20.svg')) throw new TypeError('redirect'); return null; }) });
  check('N5 a redirect or network error is refused', r.code === 'AL_FETCH', JSON.stringify(r));
  r = await checkAvatarLive({ ...args, fetchImpl: serveFrom(s, (rel) => (rel === 'index.html' ? new Response(Buffer.alloc((8 << 20) + 1), { status: 200 }) : null)) });
  check('N6 an oversize answer is refused without buffering past the cap', r.code === 'AL_BYTES', JSON.stringify(r));
  for (const o of ['http://10.0.0.1:8080', 'https://127.0.0.1:8080', 'http://127.0.0.1:8080/', 'http://i.pravatar.cc:80']) {
    r = await checkAvatarLive({ ...args, appOrigin: o, fetchImpl: () => { throw new Error('must not fetch'); } });
    check(`N7 non-loopback or non-origin app origin refused before any fetch (${o.replace(/[^a-z0-9.:]/gi, '_')})`, r.code === 'AL_INPUT');
  }
  r = await checkAvatarLive({ ...args, servedDir: 'relative/dir', fetchImpl: serveFrom(s) });
  check('N8 a relative dir is refused', r.code === 'AL_INPUT');
  const svg = path.join(s, 'hermetic-avatars', 'avatar-fixture-11.svg'); const keep = fs.readFileSync(svg);
  fs.writeFileSync(svg, Buffer.concat([keep, Buffer.from(' ')]));
  r = await checkAvatarLive({ ...args, fetchImpl: serveFrom(s) });
  check('N9 a served copy that no longer verifies is refused before any fetch', r.code === 'AL_FIXTURE');
  fs.writeFileSync(svg, keep);
  r = await checkAvatarLive({ ...args, servedDir: h, fetchImpl: serveFrom(h) });
  check('N10 naming the hermetic copy as the served copy is refused', r.code === 'AL_FIXTURE');
  const seen = [];
  r = await checkAvatarLive({ ...args, fetchImpl: (u, o) => { seen.push(u); return serveFrom(s)(u, o); } });
  check('P2 only loopback app-origin paths are requested, each once', r.ok && seen.length === 5 && new Set(seen).size === 5 && seen.every((u) => u.startsWith(`${O}/`)) && !seen.some((u) => u.includes('pravatar')));
  check('P3 the result never carries a path, URL or byte', Object.keys(r).sort().join(',') === 'files,ok');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(fails ? `FAIL avatar-live-check selftest (${fails})` : 'PASS avatar-live-check selftest');
process.exit(fails ? 1 : 0);
