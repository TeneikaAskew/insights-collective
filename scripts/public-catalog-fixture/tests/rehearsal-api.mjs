#!/usr/bin/env node
// ABOUTME: REHEARSAL ONLY, never acceptance: a loopback stand-in for PostgREST that serves fixtures.mjs rows with the
// ABOUTME: snapshot's anon read policies emulated, so the browser specs can be exercised OLD vs NEW where no stack exists.
//
// It implements just the request shapes the anonymous pages send (select with embeds, eq/in filters, order, single-object
// Accept, HEAD count). Its policy emulation is a hand copy and proves nothing about the real policies; anon-probe.mjs and
// rls-anon-*.sql do that against the real stack and the snapshot. Writes are always refused here (405).
import http from 'node:http';
import { COURSES, MODULES } from '../fixtures.mjs';

const port = Number(process.argv[2] || 54399);
const courses = COURSES.filter((c) => c.published).map(({ visibility, ...c }) => ({ ...c, description: 'Synthetic public-catalog fixture.', instructor_id: null, image_url: null, thumbnail: null, tags: null, settings: {}, enrollment_status: 'open', enrollment_count: 0, difficulty_level: 'beginner', updated_at: c.created_at }));
const pubIds = new Set(courses.map((c) => c.id));
const modules = MODULES.filter((m) => m.published && pubIds.has(m.course_id)).map(({ visibility, ...m }) => ({ ...m, description: '', requirements: [], completion_requirements: [], prerequisite_module_ids: [], publish_final_grade: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }));
const TABLES = { courses, modules };
const log = [];

function apply(rows, params) {
  let out = rows.slice();
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const m = /^(not\.)?(eq|in|is)\.(.*)$/.exec(v); if (!m) continue;
    const [, neg, op, arg] = m; const col = k.includes('.') ? null : k; if (!col) { out = []; continue; }
    const test = (r) => op === 'eq' ? String(r[col]) === arg : op === 'is' ? (arg === 'null' ? r[col] == null : String(r[col]) === arg) : arg.replace(/^\(|\)$/g, '').split(',').includes(String(r[col]));
    out = out.filter((r) => (neg ? !test(r) : test(r)));
  }
  const order = params.get('order');
  if (order) for (const part of order.split(',').reverse()) { const [c, dir] = part.split('.'); out.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
  return out.map((r) => ({ ...r, instructor: null }));
}

http.createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${port}`);
  log.push(`${req.method} ${u.pathname}${u.search}`);
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,HEAD,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'Content-Range' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (u.pathname === '/__log') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify(log)); }
  const m = /^\/rest\/v1\/([a-z_]+)$/.exec(u.pathname);
  if (!m) { res.writeHead(404, cors); return res.end('{}'); }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, cors); return res.end('{"message":"rehearsal API refuses writes"}'); }
  const rows = apply(TABLES[m[1]] ?? [], u.searchParams);
  const single = (req.headers.accept || '').includes('vnd.pgrst.object');
  const headers = { ...cors, 'Content-Type': 'application/json', 'Content-Range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` };
  if (single) {
    if (rows.length !== 1) { res.writeHead(406, headers); return res.end(JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })); }
    res.writeHead(200, headers); return res.end(req.method === 'HEAD' ? '' : JSON.stringify(rows[0]));
  }
  res.writeHead(200, headers); res.end(req.method === 'HEAD' ? '' : JSON.stringify(rows));
}).listen(port, '127.0.0.1', () => console.log(`rehearsal API on http://127.0.0.1:${port} (NOT acceptance)`));
