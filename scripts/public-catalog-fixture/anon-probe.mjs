#!/usr/bin/env node
// ABOUTME: HTTP-tier anonymous RLS probe through the stack's real PostgREST with the anon key only (no session). Reads are
// ABOUTME: unfiltered; writes target run-owned fixture ids only. Every response goes through probe-classify.mjs.
//
// Usage (run.sh only, after the seed and AFTER W2 == W1): node anon-probe.mjs <private report.json> <evidence summary.txt>
// Exit: 0 every verdict passes; 1 a private row is readable or a write was ACCEPTED; 3 any UNVERIFIED response; 2 guards.
// The report records verdicts, statuses, recognized codes, row counts and which FIXTURE ids were seen. It never records a
// response body, a header or a non-fixture id (only their count).
import { writeFileSync } from 'node:fs';
import { runGuards } from './guards.mjs';
import { COURSES, MODULES, ID_PREFIX, ALL_IDS } from './fixtures.mjs';
import { classifyRead, classifyWrite, writePasses, V } from './probe-classify.mjs';

const errors = runGuards(); if (errors.length) { for (const e of errors) console.error(e.split(':')[0]); process.exit(2); }
const [REPORT, SUMMARY] = process.argv.slice(2);
if (!REPORT || !SUMMARY) { console.error('PUBLIC_CATALOG_E_USAGE'); process.exit(2); }
const API = new URL(process.env.PUBLIC_ACCEPT_API_URL).origin; const KEY = process.env.PUBLIC_ACCEPT_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'Content-Type': 'application/json', Prefer: 'return=representation' };
const call = async (method, path, body) => {
  try {
    const r = await fetch(`${API}/rest/v1/${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    return { status: r.status, contentType: r.headers.get('content-type') || '', text: await r.text() };
  } catch {
    return { status: 0, contentType: '', text: '' };
  }
};

const FIXTURE_IDS = new Set(ALL_IDS);
const report = { reads: {}, verdicts: [], writes: {} };
const seen = new Set(); let unverified = 0; let bad = 0;
for (const [name, path] of [['courses', 'courses?select=id'], ['modules', 'modules?select=id']]) {
  const r = classifyRead(await call('GET', path));
  const ids = r.ids.filter((x) => FIXTURE_IDS.has(x));
  ids.forEach((x) => seen.add(x));
  report.reads[name] = { verdict: r.verdict, status: r.status, fixtureIdsSeen: ids.sort(), nonFixtureRows: r.ids.length - ids.length };
  if (r.verdict === V.UNVERIFIED || r.ids.length !== ids.length) unverified++;
}
for (const row of [...COURSES, ...MODULES]) {
  const v = { id: row.id, expected: row.visibility, anonCanRead: seen.has(row.id) };
  v.result = report.reads.courses.verdict !== 'READ' || report.reads.modules.verdict !== 'READ' ? 'UNVERIFIED'
    : row.visibility === 'policy-report' ? 'REPORTED' : (row.visibility === 'public') === v.anonCanRead ? 'PASS' : 'FAIL';
  if (v.result === 'FAIL') bad++;
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
  const c = classifyWrite(method, await call(method, path, body));
  const result = c.verdict === V.ACCEPTED ? 'FAIL' : writePasses(method, c.verdict) ? 'PASS' : 'UNVERIFIED';
  if (result === 'FAIL') bad++; if (result === 'UNVERIFIED') unverified++;
  report.writes[name] = { method, ...c, result };
}
writeFileSync(REPORT, JSON.stringify(report, null, 2), { mode: 0o600, flag: 'wx' });
const lines = [
  ...report.verdicts.map((v) => `${v.result} read ${v.expected} anonCanRead=${v.anonCanRead} ${v.id}`),
  ...Object.entries(report.writes).map(([k, w]) => `${w.result} write ${k} verdict=${w.verdict} status=${w.status}${w.code ? ` code=${w.code}` : ''}${w.why ? ` why=${w.why}` : ''}`),
  `reads: courses ${report.reads.courses.verdict}/${report.reads.courses.status} nonFixture=${report.reads.courses.nonFixtureRows}; modules ${report.reads.modules.verdict}/${report.reads.modules.status} nonFixture=${report.reads.modules.nonFixtureRows}`,
];
writeFileSync(SUMMARY, lines.join('\n') + '\n', { mode: 0o600, flag: 'wx' });
process.exit(bad ? 1 : unverified ? 3 : 0);
