// ABOUTME: MOCKED causal control for the proxy layer: the SAME approved -> 302 -> third-loopback-port navigation reaches the
// ABOUTME: sink when "<-loopback>" is left out (implicit bypass), and does not with exactBypassList(). No route gate here.
// Usage (from egress-selftest.sh): node egress-causal-control.mjs <app origin> <loop hits file>
// Chromium args are passed raw so Playwright cannot add "<-loopback>" on its own. Exit 0 only if A hits and B does not.
import fs from 'node:fs';
import net from 'node:net';
import { createRequire } from 'node:module';
import { BROWSER_EGRESS_ARGS, exactBypassList } from '../browser-egress.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [app, hitsFile] = process.argv.slice(2);
const hits = () => fs.readFileSync(hitsFile, 'utf8').split('\n').filter(Boolean).length;
const refused = [];
const srv = net.createServer((s) => { s.once('data', (d) => { refused.push(String(d).split(' ')[1]); s.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'); }); s.on('error', () => {}); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const proxy = `http://127.0.0.1:${srv.address().port}`;

async function run(label, bypass) {
  const before = hits();
  const b = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: [...BROWSER_EGRESS_ARGS, `--proxy-server=${proxy}`, `--proxy-bypass-list=${bypass}`],
  });
  const p = await (await b.newContext()).newPage();
  await p.goto(`${app}/redirect-loopback`, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  await new Promise((r) => setTimeout(r, 500));
  await b.close();
  const n = hits() - before;
  console.log(`${label}: bypass="${bypass}" third-port sink hits ${n}`);
  return n;
}
const a = await run('CONTROL A (implicit bypass kept, "<-loopback>" omitted)', exactBypassList([app]).replace('<-loopback>,', ''));
const b = await run('B (mode: exactBypassList)', exactBypassList([app]));
srv.close();
if (a < 1) { console.log('FAIL control A did not reach the sink, so B proves nothing'); process.exit(1); }
if (b !== 0) { console.log('FAIL B reached the unapproved loopback port'); process.exit(1); }
console.log('PASS causal control: the subtraction of the implicit bypass is what keeps the redirect off the third port');
