#!/usr/bin/env node
// ABOUTME: FAKE loopback API + app for preflight.mjs self-tests only (no GoTrue, no PostgREST). Answers the read-only probes
// ABOUTME: preflight sends, from values given in env, and logs every request method+path so a test can prove no POST was made.
// Usage: fake-stack-http.mjs <api port> <app port> <log file>
//   env FAKE_USERS, FAKE_COURSES (numbers), FAKE_TABLES (comma list), FAKE_BUNDLE = api | hosted | none
import http from 'node:http';
import { appendFileSync } from 'node:fs';

const [apiPort, appPort, log] = process.argv.slice(2);
const API = `http://127.0.0.1:${apiPort}`;
const note = (who, req) => appendFileSync(log, `${who} ${req.method} ${new URL(req.url, 'http://x').pathname}\n`);
const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};
http.createServer((req, res) => {
  note('api', req);
  const u = new URL(req.url, 'http://x');
  if (req.method !== 'GET') return json(res, 405, { msg: 'fake: read-only' });
  if (u.pathname === '/auth/v1/admin/users') return json(res, 200, { users: [] }, { 'x-total-count': process.env.FAKE_USERS ?? '0' });
  if (u.pathname === '/rest/v1/courses') return json(res, 200, [], { 'content-range': `*/${process.env.FAKE_COURSES ?? '0'}` });
  if (u.pathname === '/rest/v1/') {
    const defs = Object.fromEntries((process.env.FAKE_TABLES ?? '').split(',').filter(Boolean).map((t) => [t, {}]));
    return json(res, 200, { definitions: defs });
  }
  return json(res, 404, {});
}).listen(Number(apiPort), '127.0.0.1');
http.createServer((req, res) => {
  note('app', req);
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end('<!doctype html><script type="module" crossorigin src="/assets/index-fake.js"></script>');
  }
  if (u.pathname === '/assets/index-fake.js') {
    const b = process.env.FAKE_BUNDLE ?? 'api';
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end(b === 'api' ? `const u="${API}";` : b === 'hosted' ? `const u="${API}";const h="https://abcdefghijklmnopqrst.supabase.co";` : 'const u="";');
  }
  res.writeHead(404).end();
}).listen(Number(appPort), '127.0.0.1', () => console.log('fake-stack-http ready'));
