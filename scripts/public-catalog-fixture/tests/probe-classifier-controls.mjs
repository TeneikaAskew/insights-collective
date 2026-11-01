#!/usr/bin/env node
// ABOUTME: Fake-response controls for probe-classify.mjs: each synthetic PostgREST response has a fixed expected verdict, and
// ABOUTME: the OLD rule (anything but a 2xx non-empty array is PASS) is run beside it to show which cases it mislabelled.
import { classifyWrite, classifyRead, writePasses, oldWritePasses, V } from '../probe-classify.mjs';

const J = 'application/json; charset=utf-8';
const rows = (n) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: `7e57ca7a-0000-4000-8000-00000000000${i}` })));
// [name, method, response, expected NEW verdict, expected NEW pass, OLD rule's pass]
const CASES = [
  ['insert denied 401/42501', 'POST', { status: 401, contentType: J, text: '{"code":"42501","message":"x"}' }, V.DENIED, true, true],
  ['insert denied 403/42501', 'POST', { status: 403, contentType: J, text: '{"code":"42501"}' }, V.DENIED, true, true],
  ['insert accepted 201 [row]', 'POST', { status: 201, contentType: J, text: rows(1) }, V.ACCEPTED, false, false],
  ['update RLS-filtered 200 []', 'PATCH', { status: 200, contentType: J, text: '[]' }, V.EMPTY, true, true],
  ['delete RLS-filtered 200 []', 'DELETE', { status: 200, contentType: J, text: '[]' }, V.EMPTY, true, true],
  ['update accepted 200 [row]', 'PATCH', { status: 200, contentType: J, text: rows(1) }, V.ACCEPTED, false, false],
  ['insert 2xx empty array', 'POST', { status: 201, contentType: J, text: '[]' }, V.UNVERIFIED, false, true],
  ['400 unknown column PGRST204', 'PATCH', { status: 400, contentType: J, text: '{"code":"PGRST204"}' }, V.UNVERIFIED, false, true],
  ['400 check violation 23514', 'POST', { status: 400, contentType: J, text: '{"code":"23514"}' }, V.UNVERIFIED, false, true],
  ['500 server error', 'DELETE', { status: 500, contentType: J, text: '{"code":"XX000"}' }, V.UNVERIFIED, false, true],
  ['502 non-JSON gateway page', 'PATCH', { status: 502, contentType: 'text/html', text: '<html>bad gateway</html>' }, V.UNVERIFIED, false, true],
  ['200 malformed JSON', 'PATCH', { status: 200, contentType: J, text: '[{' }, V.UNVERIFIED, false, true],
  ['204 no body (ambiguous)', 'DELETE', { status: 204, contentType: '', text: '' }, V.UNVERIFIED, false, true],
  ['403 with other code', 'POST', { status: 403, contentType: J, text: '{"code":"PGRST301"}' }, V.UNVERIFIED, false, true],
  ['42501 under status 400', 'POST', { status: 400, contentType: J, text: '{"code":"42501"}' }, V.UNVERIFIED, false, true],
  ['302 redirect', 'PATCH', { status: 302, contentType: 'text/plain', text: '' }, V.UNVERIFIED, false, true],
  ['network failure (status 0)', 'POST', { status: 0, contentType: '', text: '' }, V.UNVERIFIED, false, true],
];
let fail = 0; let oldMislabelled = 0;
for (const [name, method, res, want, wantPass, oldPass] of CASES) {
  const c = classifyWrite(method, res);
  const pass = writePasses(method, c.verdict);
  let parsedRows = null; try { const j = JSON.parse(res.text); parsedRows = Array.isArray(j) ? j : null; } catch { /* none */ }
  const old = oldWritePasses({ status: res.status, rows: parsedRows });
  const ok = c.verdict === want && pass === wantPass && old === oldPass;
  if (!ok) fail++;
  if (old !== wantPass) oldMislabelled++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: NEW ${c.verdict} pass=${pass}; OLD pass=${old}${old !== wantPass ? '  <- OLD mislabelled' : ''}`);
}
const reads = [
  ['read 200 array', { status: 200, contentType: J, text: rows(2) }, 'READ'],
  ['read 401', { status: 401, contentType: J, text: '{"code":"42501"}' }, V.UNVERIFIED],
  ['read 200 object', { status: 200, contentType: J, text: '{"id":"x"}' }, V.UNVERIFIED],
  ['read 200 html', { status: 200, contentType: 'text/html', text: '<p>' }, V.UNVERIFIED],
];
for (const [name, res, want] of reads) { const v = classifyRead(res).verdict; if (v !== want) fail++; console.log(`${v === want ? 'PASS' : 'FAIL'} ${name}: ${v}`); }
const noBody = CASES.every(([, m, r]) => !Object.values(classifyWrite(m, r)).some((x) => typeof x === 'string' && r.text && r.text.length > 8 && x.includes(r.text)));
if (!noBody) fail++; console.log(`${noBody ? 'PASS' : 'FAIL'} no verdict carries a response body`);
console.log(`OLD rule mislabelled ${oldMislabelled} of ${CASES.length} write cases as PASS`);
console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
