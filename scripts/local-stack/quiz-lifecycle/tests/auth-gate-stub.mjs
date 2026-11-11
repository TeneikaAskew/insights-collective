#!/usr/bin/env node
// ABOUTME: LOCAL SELFTEST ONLY. Loopback stub of two GoTrue routes for auth-gate-selftest.sh: /auth/v1/health and the
// ABOUTME: password grant, answering a fixed per-request status script. It proves the gate's CONTROL FLOW, not GoTrue.
// Usage: node auth-gate-stub.mjs <port> <statuses, e.g. 400,200 | 200 | 400,400 | 302>
// It never echoes the request body. A 200 carries a synthetic token and the expected (or, for "200w", a wrong) user id.
import http from 'node:http';
const [port, script] = process.argv.slice(2);
const seq = String(script).split(',');
let n = 0;
http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/auth/v1/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"version":"v2.999.0","name":"GoTrue"}'); return; }
  if (req.method === 'POST' && req.url === '/auth/v1/token?grant_type=password') {
    req.resume();
    req.on('end', () => {
      const s = seq[Math.min(n, seq.length - 1)]; n += 1;
      if (s === '302') { res.writeHead(302, { location: 'http://127.0.0.1:1/' }); res.end(); return; }
      if (s === '200' || s === '200w') {
        const id = s === '200' ? '9c000000-0000-4000-8000-0000000000a1' : '9c000000-0000-4000-8000-0000000000ff';
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ access_token: 'stub-SECRETTOKEN-not-a-jwt', user: { id } })); return;
      }
      res.writeHead(Number(s), { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error_code: s === '400' ? 'invalid_credentials' : 'unexpected_failure', msg: 'stub-BODYTEXT' }));
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(Number(port), '127.0.0.1');
