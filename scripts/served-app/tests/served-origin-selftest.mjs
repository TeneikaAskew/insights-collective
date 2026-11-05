// ABOUTME: Real-Chromium before/after for the hermetic contract: the PRODUCT build attempts a foreign send on load (blocked
// ABOUTME: before send), the TEST-SERVED copy attempts none, and an injected foreign request in the served app is still caught.
// Usage: node served-origin-selftest.mjs <product dist> <served dir>. Loopback static servers only; every non-approved request
// is aborted before it leaves the browser, so nothing reaches any network. Exit 0 only if all cases pass.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const [productDir, servedDir] = process.argv.slice(2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' };
function serve(root) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(root, rel);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' }).end(fs.readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, origin: `http://127.0.0.1:${srv.address().port}` }));
  });
}
const API = 'http://127.0.0.1:54321'; // approved but not running here: the app's API calls fail locally, they are not foreign
async function visit(browser, origin, inject) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const blocked = [];
  await context.route('**/*', (route) => {
    const o = new URL(route.request().url()).origin;
    if (o === origin || o === API) return route.continue();
    blocked.push(`${o} ${route.request().resourceType()}`);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  for (const p of ['/', '/login']) { await page.goto(origin + p, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); }
  const rootFilled = await page.evaluate(() => (document.getElementById('root')?.childElementCount ?? 0) > 0);
  if (inject) { await page.evaluate(() => { const i = new Image(); i.src = 'https://foreign.example.test/pixel.png'; document.body.appendChild(i); }); await page.waitForTimeout(800); }
  await context.close();
  return { blocked: [...new Set(blocked)], rootFilled };
}
const browser = await chromium.launch({ executablePath: process.env.GB_CHROMIUM_PATH || undefined });
const P = await serve(path.resolve(productDir)); const S = await serve(path.resolve(servedDir));
let pass = 0, fail = 0; const check = (ok, label, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label} :: ${detail}`); ok ? pass++ : fail++; };
const a = await visit(browser, P.origin, false);
check(a.blocked.includes('https://cdn.gpteng.co script'), 'C1 PRODUCT build: the guard stops the CDN script before send (the integration blocker, reproduced)', JSON.stringify(a.blocked));
const b = await visit(browser, S.origin, false);
check(b.blocked.length === 0 && b.rootFilled, 'P1 TEST-SERVED copy: zero foreign attempts on / and /login, app mounted', JSON.stringify(b));
const c = await visit(browser, S.origin, true);
check(c.blocked.length === 1 && c.blocked[0].startsWith('https://foreign.example.test'), 'N1 TEST-SERVED copy + injected foreign image: still caught (a lane test would fail)', JSON.stringify(c.blocked));
await browser.close(); P.srv.close(); S.srv.close();
console.log(`== served-origin selftest (REAL Chromium, loopback only): ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
