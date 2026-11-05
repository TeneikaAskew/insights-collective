// ABOUTME: REAL-Chromium selftest of e2e/gradebook-roles/origin-guard.mjs against loopback test servers only (no Supabase,
// ABOUTME: no network beyond 127.0.0.1). Proves zero bytes reach a foreign or wrong-API origin on every browser path.
// Servers: APP and API are the approved origins; FOREIGN and WRONGAPI are loopback servers that are NOT approved and count
// every request and WebSocket upgrade they receive. The pass condition for each negative is: the guard recorded the
// attempt AND the target server received nothing. Positives prove real local responses pass through unchanged.
// Usage: node scripts/gradebook-fixture/tests/origin-guard-selftest.mjs   (exit 0 only if every case passes)
import http from 'node:http';
import { chromium } from '@playwright/test';
import { installOriginGuard, newGuardedContext } from '../../../e2e/gradebook-roles/origin-guard.mjs';

const hits = { FOREIGN: 0, WRONGAPI: 0 };
function server(name, handler) {
  const s = http.createServer(handler);
  if (name in hits) s.on('upgrade', (_req, sock) => { hits[name]++; sock.destroy(); });
  return new Promise((res) => s.listen(0, '127.0.0.1', () => res({ s, origin: `http://127.0.0.1:${s.address().port}` })));
}
const counting = (name) => (req, res) => { hits[name]++; res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }); res.end('reached'); };
const FOREIGN = await server('FOREIGN', counting('FOREIGN'));
const WRONGAPI = await server('WRONGAPI', counting('WRONGAPI'));
const API = await server('API', (req, res) => {
  if (req.url === '/hop1') { res.writeHead(302, { location: `${FOREIGN.origin}/second-hop` }); return res.end(); }
  if (req.url === '/redirect-out') { res.writeHead(302, { location: `${FOREIGN.origin}/from-api` }); return res.end(); }
  res.writeHead(200, { 'content-type': 'application/json', 'x-real-local': 'yes', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-real-local' });
  res.end(JSON.stringify({ real: 'api-body', path: req.url, auth: req.headers['authorization'] ?? null }));
});
const page = (body) => `<!doctype html><meta charset="utf-8"><body><pre id="out">pending</pre><script>${body}</script></body>`;
const APP = await server('APP', (req, res) => {
  const send = (b) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(b); };
  const F = FOREIGN.origin, W = WRONGAPI.origin, A = API.origin;
  const out = `(v)=>document.getElementById('out').textContent=v`;
  switch (req.url) {
    case '/fetch-foreign': return send(page(`fetch('${F}/x').then(()=>(${out})('sent'),()=>(${out})('blocked'))`));
    case '/redirect-foreign': res.writeHead(302, { location: `${F}/redir` }); return res.end();
    case '/api-redirects-out': return send(page(`fetch('${A}/redirect-out').then(r=>r.text()).then(t=>(${out})('got:'+t),()=>(${out})('blocked'))`));
    case '/popup': return send(page(`window.open('${F}/popup'); (${out})('opened')`));
    case '/iframe': return send(`<!doctype html><iframe src="${F}/frame"></iframe><img src="${F}/img.png"><link rel="stylesheet" href="${F}/x.css"><script src="${F}/x.js"></script>`);
    case '/ws': return send(page(`const w=new WebSocket('${F.replace('http','ws')}/sock'); w.onerror=()=>(${out})('ws-error'); w.onclose=()=>(${out})('ws-closed')`));
    case '/beacon': return send(page(`navigator.sendBeacon('${F}/beacon','x'); (${out})('beaconed')`));
    case '/sw': return send(page(`(async()=>{ if(!navigator.serviceWorker) return (${out})('sw-unavailable'); try { await navigator.serviceWorker.register('/sw.js'); } catch(e) { return (${out})('sw-refused'); } await new Promise(r=>setTimeout(r,800)); const regs = await navigator.serviceWorker.getRegistrations(); const live = regs.filter(r=>r.active||r.installing||r.waiting).length; (${out})('sw-live:'+live); })()`));
    case '/sw.js': res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(`self.addEventListener('install',()=>fetch('${F}/from-sw'))`);
    case '/wrong-api': return send(page(`fetch('${W}/rest/v1/courses').then(()=>(${out})('sent'),()=>(${out})('blocked'))`));
    case '/api-ok': return send(page(`fetch('${A}/rest/v1/ok?q=1').then(async r=>(${out})(r.status+' '+r.headers.get('x-real-local')+' '+await r.text()),()=>(${out})('blocked'))`));
    case '/local-redirect': res.writeHead(302, { location: '/landing' }); return res.end();
    case '/chain': res.writeHead(302, { location: `${A}/hop1` }); return res.end();
    case '/landing': return send(page(`(${out})('landed')`));
    default: res.writeHead(404); return res.end();
  }
});

const launch = process.env.GB_CHROMIUM_PATH ? { executablePath: process.env.GB_CHROMIUM_PATH } : {};
const browser = await chromium.launch(launch);
let pass = 0, fail = 0;
const ok = (l, d) => { console.log(`PASS ${l} :: ${d}`); pass++; };
const no = (l, d) => { console.log(`FAIL ${l} :: ${d}`); fail++; };
async function scenario(label, path, { expectBlockedOrigin, expectOut, wait = 800 } = {}) {
  const before = { ...hits };
  const { context, blocked } = await newGuardedContext(browser, [APP.origin, API.origin]);
  const p = await context.newPage();
  let navErr = null;
  try { await p.goto(APP.origin + path, { waitUntil: 'load', timeout: 10_000 }); } catch (e) { navErr = String(e.message).split('\n')[0]; }
  await p.waitForTimeout(wait);
  const out = navErr ? `nav-error` : await p.locator('#out').textContent().catch(() => null);
  await context.close();
  const sent = { FOREIGN: hits.FOREIGN - before.FOREIGN, WRONGAPI: hits.WRONGAPI - before.WRONGAPI };
  const seen = blocked.map((b) => `${b.origin === FOREIGN.origin ? 'FOREIGN' : b.origin === WRONGAPI.origin ? 'WRONGAPI' : b.origin}:${b.kind}`);
  const reasons = [];
  if (sent.FOREIGN || sent.WRONGAPI) reasons.push(`target received ${JSON.stringify(sent)}`);
  if (expectBlockedOrigin && !seen.some((s) => s.startsWith(expectBlockedOrigin))) reasons.push(`guard did not record ${expectBlockedOrigin} (saw ${JSON.stringify(seen)})`);
  if (!expectBlockedOrigin && seen.length) reasons.push(`unexpected blocks ${JSON.stringify(seen)}`);
  if (expectOut && !(expectOut instanceof RegExp ? expectOut.test(out ?? '') : out === expectOut)) reasons.push(`page out ${JSON.stringify(out)} (nav ${navErr})`);
  (reasons.length ? no : ok)(label, reasons.length ? reasons.join('; ') : `blocked ${JSON.stringify(seen)}, foreign sends 0, wrong-API sends 0, out=${JSON.stringify(out)}`);
}
await scenario('N1 fetch to a foreign origin', '/fetch-foreign', { expectBlockedOrigin: 'FOREIGN', expectOut: 'blocked' });
await scenario('N2 top-level redirect from the app to a foreign origin', '/redirect-foreign', { expectBlockedOrigin: 'FOREIGN' });
await scenario('N3 approved API answers 302 to a foreign origin', '/api-redirects-out', { expectBlockedOrigin: 'FOREIGN', expectOut: 'blocked' });
await scenario('N4 popup / new page to a foreign origin', '/popup', { expectBlockedOrigin: 'FOREIGN', expectOut: 'opened', wait: 1500 });
await scenario('N5 iframe, img, stylesheet and script from a foreign origin', '/iframe', { expectBlockedOrigin: 'FOREIGN' });
await scenario('N6 WebSocket to a foreign origin', '/ws', { expectBlockedOrigin: 'FOREIGN', expectOut: /ws-(error|closed)/ });
await scenario('N7 sendBeacon to a foreign origin', '/beacon', { expectBlockedOrigin: 'FOREIGN', expectOut: 'beaconed' });
await scenario('N8 service worker: no live worker and no foreign send (workers blocked)', '/sw', { expectOut: /^(sw-refused|sw-unavailable|sw-live:0)$/, wait: 2000 });
await scenario('N9 WRONG-SERVED APP: app calls an API origin that is loopback but not the approved one', '/wrong-api', { expectBlockedOrigin: 'WRONGAPI', expectOut: 'blocked' });
await scenario('N11 approved -> approved -> FOREIGN redirect chain (second hop escapes a single check)', '/chain', { expectBlockedOrigin: 'FOREIGN' });
await scenario('P1 approved API: real local status, header and body pass through unchanged', '/api-ok', { expectOut: '200 yes {"real":"api-body","path":"/rest/v1/ok?q=1","auth":null}' });
await scenario('P2 same-origin redirect inside the app is followed', '/local-redirect', { expectOut: 'landed' });
// The specs' labelled fault injections (U1 url rewrite, U2 header substitution) use page.route(...).fallback(overrides):
// the guard must still judge the request and must forward the OVERRIDDEN url and headers to the real local API.
{
  const { context, blocked } = await newGuardedContext(browser, [APP.origin, API.origin]);
  const p = await context.newPage();
  await p.route(`${API.origin}/rest/v1/**`, (route) => route.fallback({ url: route.request().url().replace('/ok?q=1', '/rewritten?q=2'), headers: { ...route.request().headers(), authorization: 'Bearer substituted' } }));
  await p.goto(APP.origin + '/api-ok'); await p.waitForTimeout(800);
  const out = await p.locator('#out').textContent(); await context.close();
  out === '200 yes {"real":"api-body","path":"/rest/v1/rewritten?q=2","auth":"Bearer substituted"}' && !blocked.length
    ? ok('P3 page.route fallback overrides reach the real local API through the guard', out) : no('P3 fallback overrides', `${out} blocked=${JSON.stringify(blocked)}`);
}
{
  const before = hits.FOREIGN;
  const { context, blocked } = await newGuardedContext(browser, [APP.origin, API.origin]);
  const p = await context.newPage();
  await p.route(`${API.origin}/rest/v1/**`, (route) => route.fallback({ url: `${FOREIGN.origin}/rewritten-out` }));
  await p.goto(APP.origin + '/api-ok'); await p.waitForTimeout(800); await context.close();
  hits.FOREIGN === before && blocked.some((b) => b.origin === FOREIGN.origin)
    ? ok('N12 a fallback url override pointing at a foreign origin is still blocked', `blocked ${JSON.stringify(blocked.map((b) => b.kind))}, foreign sends 0`) : no('N12 fallback override to foreign', `sends ${hits.FOREIGN - before} blocked ${JSON.stringify(blocked)}`);
}
// Causal control: the SAME foreign fetch page without the guard does reach the foreign server (the negatives are not vacuous).
{
  const before = hits.FOREIGN;
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  await p.goto(APP.origin + '/fetch-foreign'); await p.waitForTimeout(800); await ctx.close();
  hits.FOREIGN - before > 0 ? ok('C1 control without the guard', `foreign server received ${hits.FOREIGN - before} request(s)`) : no('C1 control without the guard', 'foreign server received nothing: the negatives would be vacuous');
}
// Guard installed on an EXISTING context with an open page (as the spec fixture does) still blocks.
{
  const before = hits.FOREIGN;
  const ctx = await browser.newContext({ serviceWorkers: 'block' }); const p = await ctx.newPage();
  const blocked = await installOriginGuard(ctx, [APP.origin, API.origin]);
  await p.goto(APP.origin + '/fetch-foreign'); await p.waitForTimeout(800); await ctx.close();
  hits.FOREIGN === before && blocked.length ? ok('N10 guard installed after page creation', `blocked ${blocked.length}, foreign sends 0`) : no('N10 guard installed after page creation', `sends ${hits.FOREIGN - before}, blocked ${blocked.length}`);
}
await browser.close();
for (const s of [FOREIGN, WRONGAPI, API, APP]) s.s.close();
console.log(`== origin-guard selftest (REAL Chromium, loopback test servers only): ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
