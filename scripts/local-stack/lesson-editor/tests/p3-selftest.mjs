#!/usr/bin/env node
// ABOUTME: No-network self-test for preflight P3 (p3-exposure.mjs) against an IN-PROCESS fake PostgREST/GoTrue whose OpenAPI
// ABOUTME: root follows privileges like the real one (anon sees no quiz_questions). No listener, no stack, no file written.
// Controls: the OLD P3 (exposure root read with the anon key) is rebuilt from the checked-in source by one exact
// substitution and loaded from a data: URL; it must refuse the privilege-filtered stack that the new P3 accepts.
// Usage: node scripts/local-stack/lesson-editor/tests/p3-selftest.mjs     (exit 0 only when every case meets its expectation)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANE = path.resolve(HERE, '..');
const SRC = readFileSync(path.join(LANE, 'p3-exposure.mjs'), 'utf8');
const NEW = await import(path.join(LANE, 'p3-exposure.mjs'));
const NEW_ROOT = 'export const rootHeaders = (keys) => ({ apikey: keys.service, Authorization: `Bearer ${keys.service}` });';
const OLD_ROOT = 'export const rootHeaders = (keys) => ({ apikey: keys.anon });';
if (SRC.split(NEW_ROOT).length !== 2) { console.log('control: the rootHeaders line did not match exactly once'); process.exit(2); }
const OLD = await import(`data:text/javascript,${encodeURIComponent(SRC.replace(NEW_ROOT, OLD_ROOT))}`);

let pass = 0, fail = 0;
const say = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); };
const KEYS = Object.freeze({ anon: 'FAKE-ANON-KEY', service: 'FAKE-SERVICE-KEY' });
const API = 'http://127.0.0.1:54321';

// A synthetic public schema: the fixture tables plus filler, 40 tables in all.
const BASE = [...NEW.REQUIRED, ...Array.from({ length: 33 }, (_, i) => `filler_${String(i).padStart(2, '0')}`)];
/** In-process fake: privilege-following OpenAPI root; GoTrue total and PostgREST course count from the "database". */
function fakeStack({ dbTables = BASE, served = BASE, anonHidden = ['quiz_questions'], users = 6, courses = 3 } = {}) {
  const calls = [];
  const request = async (origin, method, p, { headers = {} } = {}) => {
    calls.push({ origin, method, path: p, headers: { ...headers } });
    if (method !== 'GET') throw new Error('fake: only GET is served');
    const bearer = (headers.Authorization ?? '').replace(/^Bearer /, '');
    const role = (bearer || headers.apikey) === KEYS.service ? 'service_role' : (bearer || headers.apikey) === KEYS.anon ? 'anon' : 'none';
    const hdr = (o) => ({ get: (k) => o[k.toLowerCase()] ?? null });
    if (p.startsWith('/auth/v1/admin/users')) return role === 'service_role' ? { status: 200, json: { users: [] }, headers: hdr({ 'x-total-count': String(users) }) } : { status: 401, json: null, headers: hdr({}) };
    if (p.startsWith('/rest/v1/courses')) return { status: 200, json: [], headers: hdr({ 'content-range': `0-0/${courses}` }) };
    if (p === '/rest/v1/') {
      const visible = role === 'service_role' ? served : role === 'anon' ? served.filter((t) => !anonHidden.includes(t)) : [];
      return { status: 200, json: { definitions: Object.fromEntries(visible.map((t) => [t, {}])) }, headers: hdr({}) };
    }
    return { status: 404, json: null, headers: hdr({}) };
  };
  return { request, calls, db: { users, courses, tables: dbTables } };
}
const run = async (mod, opts) => { const s = fakeStack(opts); return { r: await mod.runP3({ request: s.request, API, keys: KEYS, db: s.db }), calls: s.calls }; };
const LACK = /^P3: 1 fixture table\(s\) not both in the database and exposed by PostgREST$/;

// The E1 run's situation: anon holds no privilege on quiz_questions (answer key hidden), service role holds all.
{
  const o = await run(OLD, {});
  say('C1 CONTROL: OLD P3 (anon root) REFUSES the privilege-filtered stack with the fixed fixture-table reason', !o.r.ok && LACK.test(o.r.reason));
  const n = await run(NEW, {});
  say('N1 NEW P3 (service root) ACCEPTS the same stack', n.r.ok === true && /40\/40 public tables exposed \(service-role view\)$/.test(n.r.line));
  const root = n.calls.find((c) => c.path === '/rest/v1/');
  say('N2 NEW P3 reads the exposure root with the service key (apikey and Bearer), never anon', root?.headers.apikey === KEYS.service && root?.headers.Authorization === `Bearer ${KEYS.service}`);
  say('N3 NEW P3 sends GET only, to the API origin only', n.calls.every((c) => c.method === 'GET' && c.origin === API) && n.calls.length === 3);
  say('N4 nothing is granted to anon: the fake still hides quiz_questions from anon in N1', !(await fakeStack({}).request(API, 'GET', '/rest/v1/', { headers: { apikey: KEYS.anon } })).json.definitions.quiz_questions);
}
// quiz_questions stays REQUIRED: a genuinely absent or unserved table is still refused by the NEW P3.
say('A1 NEW P3 refuses when quiz_questions is absent from the database and the API', LACK.test((await run(NEW, { dbTables: BASE.filter((t) => t !== 'quiz_questions'), served: BASE.filter((t) => t !== 'quiz_questions') })).r.reason ?? ''));
say('A2 NEW P3 refuses when quiz_questions is in the database but not served even to the service role', LACK.test((await run(NEW, { served: BASE.filter((t) => t !== 'quiz_questions') })).r.reason ?? ''));
say('A3 NEW P3 refuses when quiz_questions is served but not in this database', LACK.test((await run(NEW, { dbTables: BASE.filter((t) => t !== 'quiz_questions') })).r.reason ?? ''));
// The other P3 rules are unchanged.
say('U1 user total mismatch refused', /^P3: GoTrue reports 7 users, the database 6$/.test((await (async () => { const s = fakeStack({ users: 7 }); return NEW.runP3({ request: s.request, API, keys: KEYS, db: { ...s.db, users: 6 } }); })()).reason ?? ''));
say('U2 course count mismatch refused', /^P3: PostgREST reports 3 courses, the database 4$/.test((await (async () => { const s = fakeStack({}); return NEW.runP3({ request: s.request, API, keys: KEYS, db: { ...s.db, courses: 4 } }); })()).reason ?? ''));
say('U3 < 90% of public tables served refused', /^P3: PostgREST exposes 35\/40 of this database's public tables$/.test((await run(NEW, { served: BASE.slice(0, 35) })).r.reason ?? ''));
say('U4 a request error is refused with a fixed reason', (await NEW.runP3({ request: async () => { throw new Error('boom secret'); }, API, keys: KEYS, db: { users: 0, courses: 0, tables: BASE } })).reason === 'P3: request failed (detail withheld)');
// Static: preflight uses this module and no anon-only root request remains there.
const pre = readFileSync(path.join(LANE, 'preflight.mjs'), 'utf8');
say("S1 preflight.mjs runs P3 through p3-exposure.mjs runP3", /import \{ runP3 \} from '\.\/p3-exposure\.mjs'/.test(pre) && /await runP3\(\{ request, API, keys: \{ anon, service \}/.test(pre));
say("S2 preflight.mjs has no '/rest/v1/' request of its own", !/request\(API, 'GET', '\/rest\/v1\/'/.test(pre));

console.log(`le p3-selftest (IN-PROCESS FAKE PostgREST/GoTrue; no network, listener, stack or file write): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
