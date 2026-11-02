#!/usr/bin/env node
// ABOUTME: Fake controls for served-app-check.mjs: a synthetic product dist, its real hermetic TEST-SERVED copy, and a loopback
// ABOUTME: server. Positive case plus one fixed-code negative per refusal path. Temp dirs only; nothing leaves loopback.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { make, REMOVED_LINE } from '../hermetic-dist.mjs';
import { verifyServedApp } from '../served-app-check.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-check-'));
let fails = 0;
const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} -> ${JSON.stringify(got)}`); };
try {
  const dist = path.join(tmp, 'dist'); fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), `<!doctype html>\n<html><head>\n    ${REMOVED_LINE}\n</head><body><div id="root"></div></body></html>\n`);
  fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)\n');
  const served = path.join(tmp, 'served'); make(dist, served);
  let body = fs.readFileSync(path.join(served, 'index.html')); let status = 200;
  const srv = http.createServer((req, res) => res.writeHead(status).end(body));
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const appOrigin = `http://127.0.0.1:${srv.address().port}`;
  const base = { appOrigin, servedDir: served, productDist: dist, timeoutMs: 3000 };

  check('P1 hermetic copy served live', await verifyServedApp(base), { ok: true });
  check('N1 non-loopback origin', await verifyServedApp({ ...base, appOrigin: 'http://10.0.0.1:8080' }), { ok: false, code: 'SA_INPUT' });
  check('N2 origin with path', await verifyServedApp({ ...base, appOrigin: `${appOrigin}/x` }), { ok: false, code: 'SA_INPUT' });
  check('N3 served dir unset', await verifyServedApp({ ...base, servedDir: undefined }), { ok: false, code: 'SA_SERVED_DIR' });
  check('N4 relative served dir', await verifyServedApp({ ...base, servedDir: 'served' }), { ok: false, code: 'SA_SERVED_DIR' });
  check('N5 served = product (CDN line kept)', await verifyServedApp({ ...base, servedDir: dist }), { ok: false, code: 'SA_HERMETIC' });
  fs.appendFileSync(path.join(served, 'assets', 'app.js'), '//x\n');
  check('N6 non-index byte drift in copy', await verifyServedApp(base), { ok: false, code: 'SA_HERMETIC' });
  fs.writeFileSync(path.join(served, 'assets', 'app.js'), 'console.log(1)\n');
  check('P2 drift restored', await verifyServedApp(base), { ok: true });
  body = fs.readFileSync(path.join(dist, 'index.html'));
  check('N7 live server serves the PRODUCT index', await verifyServedApp(base), { ok: false, code: 'SA_BYTES' });
  body = fs.readFileSync(path.join(served, 'index.html')); status = 404;
  check('N8 live status not 200', await verifyServedApp(base), { ok: false, code: 'SA_STATUS' });
  status = 200; await new Promise((r) => srv.close(r));
  check('N9 nothing listening', await verifyServedApp(base), { ok: false, code: 'SA_FETCH' });
  const r = await verifyServedApp({ ...base, fetchImpl: async () => { throw new Error('boom'); } });
  check('N10 fetch throws', r, { ok: false, code: 'SA_FETCH' });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(fails === 0 ? 'PASS served-app-check selftest (12 cases)' : `FAIL served-app-check selftest: ${fails} case(s)`);
process.exit(fails === 0 ? 0 : 1);
