#!/usr/bin/env node
// ABOUTME: HTTP-tier anonymous RLS probe through the stack's real PostgREST with the anon key only (no session). REPORTS what
// ABOUTME: the actual policies return or allow, with no client-side filtering; writes target run-owned fixture ids only.
//
// Usage (after guards.mjs and the seed): node anon-probe.mjs <out.json>. Exit 1 if a private row is readable or any write
// is accepted; the published-flag/draft-status row is reported, never asserted either way.
import { writeFileSync } from 'node:fs';
import { runGuards } from './guards.mjs';
import { COURSES, MODULES, ID_PREFIX } from './fixtures.mjs';

const errors = runGuards(); if (errors.length) { for (const e of errors) console.error(e); process.exit(2); }
const API = process.env.PUBLIC_ACCEPT_API_URL; const KEY = process.env.PUBLIC_ACCEPT_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: 'return=representation' };
const call = async (method, path, body) => {
  const r = await fetch(`${API}/rest/v1/${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined, redirect: 'error' });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* keep text */ }
  return { status: r.status, rows: Array.isArray(json) ? json : null, body: Array.isArray(json) ? undefined : text.slice(0, 300) };
};

const report = { reads: {}, writes: {}, verdicts: [] };
const courses = await call('GET', 'courses?select=id,title,published,status');
const modules = await call('GET', 'modules?select=id,course_id,title,published');
report.reads.courses = courses; report.reads.modules = modules;
const seen = new Set([...(courses.rows ?? []), ...(modules.rows ?? [])].map((r) => r.id));
for (const row of [...COURSES, ...MODULES]) {
  const v = { id: row.id, title: row.title, expected: row.visibility, anonCanRead: seen.has(row.id) };
  v.result = row.visibility === 'policy-report' ? 'REPORTED' : (row.visibility === 'public') === v.anonCanRead ? 'PASS' : 'FAIL';
  report.verdicts.push(v);
}
const W = [
  ['courses.insert', 'POST', 'courses', { id: `${ID_PREFIX}000000000999`, title: 'PCA anon insert', description: 'x', category: 'x', level: 'x' }],
  ['courses.update.published', 'PATCH', `courses?id=eq.${COURSES[0].id}`, { title: 'PCA anon update' }],
  ['courses.update.private', 'PATCH', `courses?id=eq.${COURSES[5].id}`, { published: true }],
  ['courses.delete.published', 'DELETE', `courses?id=eq.${COURSES[1].id}`],
  ['modules.update.unpublished', 'PATCH', `modules?id=eq.${MODULES[1].id}`, { published: true }],
  ['modules.insert', 'POST', 'modules', { id: `${ID_PREFIX}000000000998`, course_id: COURSES[0].id, title: 'PCA anon module', position: 9 }],
];
for (const [name, method, path, body] of W) {
  const r = await call(method, path, body);
  const accepted = r.status < 300 && Array.isArray(r.rows) && r.rows.length > 0;
  report.writes[name] = { ...r, result: accepted ? 'FAIL (write accepted)' : 'PASS (refused or 0 rows)' };
}
writeFileSync(process.argv[2] ?? 'anon-probe.json', JSON.stringify(report, null, 2));
const bad = report.verdicts.filter((v) => v.result === 'FAIL').length + Object.values(report.writes).filter((w) => w.result.startsWith('FAIL')).length;
for (const v of report.verdicts) console.log(`${v.result.padEnd(8)} read ${v.expected.padEnd(13)} anonCanRead=${v.anonCanRead} ${v.title}`);
for (const [k, w] of Object.entries(report.writes)) console.log(`${w.result.padEnd(26)} write ${k} status=${w.status}`);
process.exit(bad ? 1 : 0);
