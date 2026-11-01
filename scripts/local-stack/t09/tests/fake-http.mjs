#!/usr/bin/env node
// ABOUTME: FAKE-ONLY loopback HTTP endpoint for the boundary selftests. Records every request it receives (method, path, whether
// ABOUTME: an apikey or Authorization header arrived) and, in gotrue mode, whether a received password is visible in ANY argv.
// Usage: fake-http.mjs <port> <log file> count|gotrue|redirect=<status>:<location>
//   count     answers 200 {} to everything (a stand-in "other host": any request it logs is a credential that left the origin)
//   gotrue    answers POST /auth/v1/admin/users and POST /auth/v1/token like GoTrue (unsigned JWT; personas.mjs only decodes it);
//             on each request carrying a password it scans /proc/*/cmdline of every process and logs argvLeak:true if found
//   redirect  answers every request with the given 3xx and Location (never a body the client could use)
// Never used by an evidence run. No real credential exists here: keys are fixed fake strings written by the selftest.
import http from 'node:http';
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const [port, log, mode] = process.argv.slice(2);
const argvHas = (secret) => {
  for (const pid of readdirSync('/proc').filter((d) => /^\d+$/.test(d))) {
    try { if (readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(secret)) return true; } catch { /* process gone */ }
  }
  return false;
};
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const rec = { method: req.method, path: req.url.split('?')[0], apikey: req.headers.apikey !== undefined, auth: req.headers.authorization !== undefined };
    let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { /* not JSON */ }
    if (mode === 'gotrue' && typeof body.password === 'string') { rec.password = body.password; rec.argvLeak = argvHas(body.password); }
    appendFileSync(log, JSON.stringify(rec) + '\n');
    if (mode.startsWith('redirect=')) {
      const [st, ...loc] = mode.slice(9).split(':');
      res.writeHead(Number(st), { location: loc.join(':') }); return res.end();
    }
    if (mode === 'gotrue') {
      if (req.url === '/auth/v1/admin/users') { const id = randomUUID(); (globalThis.ids ??= new Map()).set(body.email, id); res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ id, email: body.email })); }
      if (req.url.startsWith('/auth/v1/token')) {
        // The fake signs nothing; the subject is recovered from the email it was created with, kept per process.
        const id = (globalThis.ids ??= new Map()).get(body.email) ?? randomUUID();
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ access_token: `${b64({ alg: 'none' })}.${b64({ sub: id, role: 'authenticated' })}.x` }));
      }
    }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
}).listen(Number(port), '127.0.0.1');
