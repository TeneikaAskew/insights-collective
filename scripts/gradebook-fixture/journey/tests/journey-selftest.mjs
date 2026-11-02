// ABOUTME: Local fake/unit selftest for the journey proposal (no stack, no network, no browser): gate 1/2/3 checkers on temp
// ABOUTME: files, the witness comparator on fakes, pinned literals vs ids.ts, and the static contract (real PASS, mutants FAIL).
// Usage: node scripts/gradebook-fixture/journey/tests/journey-selftest.mjs   (exit 0 only if every case behaves)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { assertPrivateSessionDir, assertPrivateDir, writePrivateFile, readPrivateJson } from '../../../../e2e/gradebook-roles/journey/private-dir.mjs';
import { compareWitness, DECLARED_HASHES } from './compare-witness.mjs';
import { createRecorder, evaluate, settled, runStateFailures } from '../../../../e2e/gradebook-roles/journey/observe-core.mjs';
import { EventEmitter } from 'node:events';
import { assertPairingProof, assertLivePairing, PAIRING_PREFIX } from '../../../../e2e/gradebook-roles/journey/pairing-proof.mjs';
import { producePairing, pinFailures, stackOwnershipFailures, HELPER_PINS, gitBlobId, D1_MODULE } from '../pairing-producer.mjs';
import { checkJourney } from './static-contract.mjs';

const repo = process.cwd();
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`ok   ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };
const code = (fn) => { try { fn(); return 'ACCEPTED'; } catch (e) { return e && e.code ? e.code : 'UNCODED'; } };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jr-selftest-'));
try {
  // ---- Gate 1: private session dir ----
  const good = fs.mkdtempSync(path.join(tmp, 'sess-')); fs.chmodSync(good, 0o700);
  ok('G1 fresh 0700 empty dir outside repo is accepted', code(() => assertPrivateSessionDir(good, { repoRoot: repo })) === 'ACCEPTED');
  ok('G1 relative path refused', code(() => assertPrivateSessionDir('rel/dir', { repoRoot: repo })) === 'JOURNEY_GATE1_E_NOT_ABSOLUTE');
  ok('G1 unset refused', code(() => assertPrivateSessionDir(undefined, { repoRoot: repo })) === 'JOURNEY_GATE1_E_NOT_ABSOLUTE');
  ok('G1 missing refused', code(() => assertPrivateSessionDir(path.join(tmp, 'nope'), { repoRoot: repo })) === 'JOURNEY_GATE1_E_MISSING');
  const wide = fs.mkdtempSync(path.join(tmp, 'wide-')); fs.chmodSync(wide, 0o755);
  ok('G1 0755 refused', code(() => assertPrivateSessionDir(wide, { repoRoot: repo })) === 'JOURNEY_GATE1_E_MODE');
  const link = path.join(tmp, 'link'); fs.symlinkSync(good, link);
  ok('G1 symlink refused', code(() => assertPrivateSessionDir(link, { repoRoot: repo })) === 'JOURNEY_GATE1_E_SYMLINK');
  const inside = fs.mkdtempSync(path.join(tmp, 'repo-')); const insideSess = path.join(inside, 's'); fs.mkdirSync(insideSess, { mode: 0o700 }); fs.chmodSync(insideSess, 0o700);
  ok('G1 dir inside the repo refused', code(() => assertPrivateSessionDir(insideSess, { repoRoot: inside })) === 'JOURNEY_GATE1_E_INSIDE_REPO');
  ok('G1 other owner refused', code(() => assertPrivateSessionDir(good, { repoRoot: repo, uid: 999999 })) === 'JOURNEY_GATE1_E_OWNER');
  const used = fs.mkdtempSync(path.join(tmp, 'used-')); fs.chmodSync(used, 0o700); fs.writeFileSync(path.join(used, 'old.json'), '{}');
  ok('G1 non-empty (reused) dir refused', code(() => assertPrivateSessionDir(used, { repoRoot: repo })) === 'JOURNEY_GATE1_E_NOT_EMPTY');
  const p = writePrivateFile(good, 'member.json', '{}');
  ok('G1 session file is 0600', (fs.statSync(p).mode & 0o777) === 0o600);
  ok('G1 second create of same file refused (exclusive)', code(() => writePrivateFile(good, 'member.json', '{}')) === 'JOURNEY_GATE1_E_EXCLUSIVE_CREATE');
  ok('G1 path-like filename refused', code(() => writePrivateFile(good, '../x.json', '{}')) === 'JOURNEY_GATE1_E_FILENAME');
  const g1err = (() => { try { assertPrivateSessionDir(wide, { repoRoot: repo }); } catch (e) { return String(e.message); } return ''; })();
  ok('G1 error text is a fixed code with no path', g1err === 'JOURNEY_GATE1_E_MODE' && !g1err.includes(tmp));

  ok('G1 private state file reads back', JSON.stringify(readPrivateJson(good, 'member.json')) === '{}');
  ok('G1 missing state file refused', code(() => readPrivateJson(good, 'run-state-j2.json')) === 'JOURNEY_GATE1_E_STATE_MISSING');
  fs.writeFileSync(path.join(good, 'loose.json'), '{}'); fs.chmodSync(path.join(good, 'loose.json'), 0o644);
  ok('G1 0644 state file refused', code(() => readPrivateJson(good, 'loose.json')) === 'JOURNEY_GATE1_E_STATE_MODE');

  // ---- Gate 2 (diagnostics dir uses the same private-dir check under its own code prefix) ----
  ok('G2 0755 diag dir refused with its own prefix', code(() => assertPrivateDir(wide, { repoRoot: repo, gate: 'JOURNEY_GATE2' })) === 'JOURNEY_GATE2_E_MODE');

  // ---- Gate 3: pairing proof consumer (shape and placement only; NOT trust) ----
  const sid = 'a'.repeat(32);
  const proofDir = fs.mkdtempSync(path.join(tmp, 'proof-')); fs.chmodSync(proofDir, 0o700);
  const sess = fs.mkdtempSync(path.join(tmp, 'sess3-')); fs.chmodSync(sess, 0o700);
  const proof = (obj, mode = 0o600, dir = proofDir) => { const f = path.join(dir, `proof-${Math.random().toString(16).slice(2)}.json`); fs.writeFileSync(f, JSON.stringify(obj)); fs.chmodSync(f, mode); return f; };
  const CTRL = '9b6c0000-0000-4000-8000-000000000011';
  const base = { version: 2, stack_id: sid, control_course_id: CTRL, db_read: PAIRING_PREFIX + sid, api_read: PAIRING_PREFIX + sid, journey_rows_before_pairing: 0 };
  const v1 = { version: 1, stack_id: sid, db_read: sid, api_read: sid, produced_before_seed: true };
  const G3 = (f, o = { sessionDir: sess }) => code(() => assertPairingProof(f, o));
  { // Causal: the published 1673a7e consumer accepted a caller-authored v1 file whose only order evidence is a boolean.
    const oldF = path.join(tmp, 'e2e/gradebook-roles/journey/pairing-proof-1673a7e.mjs');
    fs.mkdirSync(path.dirname(oldF), { recursive: true });
    fs.writeFileSync(oldF, execFileSync('git', ['show', '1673a7e:e2e/gradebook-roles/journey/pairing-proof.mjs'], { cwd: repo, encoding: 'utf8' }).replace("from './private-dir.mjs'", `from '${path.join(repo, 'e2e/gradebook-roles/journey/private-dir.mjs')}'`));
    const old = (await import(oldF)).assertPairingProof;
    const f1 = proof(v1);
    ok('G3 causal: OLD 1673a7e consumer ACCEPTED the boolean v1 proof', code(() => old(f1, { sessionDir: sess })) === 'ACCEPTED');
    ok('G3 causal: NEW consumer refuses the same file', G3(f1) === 'JOURNEY_GATE3_E_VERSION');
  }
  ok('G3 well-shaped proof in its own 0700 dir accepted (shape only)', G3(proof(base)) === 'ACCEPTED');
  ok('G3 no session dir given refused', G3(proof(base), null) === 'JOURNEY_GATE3_E_NO_SESSION_DIR');
  ok('G3 no proof refused (the current state: producer not built)', G3(undefined) === 'JOURNEY_GATE3_E_NO_PROOF');
  ok('G3 missing file refused', G3(path.join(proofDir, 'none.json')) === 'JOURNEY_GATE3_E_NO_PROOF');
  ok('G3 proof INSIDE the session dir refused', G3(proof(base, 0o600, sess)) === 'JOURNEY_GATE3_E_IN_SESSION_DIR');
  const nested = path.join(proofDir, 'sess'); fs.mkdirSync(nested, { mode: 0o700 });
  ok('G3 session dir nested under the proof dir refused', G3(proof(base), { sessionDir: nested }) === 'JOURNEY_GATE3_E_IN_SESSION_DIR');
  const openDir = fs.mkdtempSync(path.join(tmp, 'open-')); fs.chmodSync(openDir, 0o755);
  ok('G3 proof dir 0755 refused', G3(proof(base, 0o600, openDir)) === 'JOURNEY_GATE3_E_PARENT');
  ok('G3 0644 proof refused', G3(proof(base, 0o644)) === 'JOURNEY_GATE3_E_MODE');
  ok('G3 other owner refused', G3(proof(base), { sessionDir: sess, uid: 999999 }) === 'JOURNEY_GATE3_E_OWNER');
  ok('G3 API read differs refused', G3(proof({ ...base, api_read: PAIRING_PREFIX + 'b'.repeat(32) })) === 'JOURNEY_GATE3_E_API_MISMATCH');
  ok('G3 DB read differs refused', G3(proof({ ...base, db_read: PAIRING_PREFIX + 'b'.repeat(32) })) === 'JOURNEY_GATE3_E_DB_MISMATCH');
  ok('G3 bare nonce without the carrier prefix refused', G3(proof({ ...base, db_read: sid, api_read: sid })) === 'JOURNEY_GATE3_E_DB_MISMATCH');
  ok('G3 journey rows seen before pairing refused (observed count, not a flag)', G3(proof({ ...base, journey_rows_before_pairing: 1 })) === 'JOURNEY_GATE3_E_ORDER');
  ok('G3 count given as a boolean or string refused', G3(proof({ ...base, journey_rows_before_pairing: false })) === 'JOURNEY_GATE3_E_ORDER' && G3(proof({ ...base, journey_rows_before_pairing: '0' })) === 'JOURNEY_GATE3_E_ORDER');
  ok('G3 other carrier row refused', G3(proof({ ...base, control_course_id: '9b6c0000-0000-4000-8000-000000000001' })) === 'JOURNEY_GATE3_E_CARRIER');
  ok('G3 short stack id refused', G3(proof({ ...base, stack_id: 'abc', db_read: PAIRING_PREFIX + 'abc', api_read: PAIRING_PREFIX + 'abc' })) === 'JOURNEY_GATE3_E_STACK_ID');
  ok('G3 v1 proof with the produced_before_seed boolean refused', G3(proof(v1)) === 'JOURNEY_GATE3_E_VERSION');
  ok('G3 v2 carrying the old boolean as an extra field refused', G3(proof({ ...base, produced_before_seed: true })) === 'JOURNEY_GATE3_E_SHAPE');
  ok('G3 extra field refused', G3(proof({ ...base, note: 'x' })) === 'JOURNEY_GATE3_E_SHAPE');
  const bad = path.join(proofDir, 'bad.json'); fs.writeFileSync(bad, '{not json'); fs.chmodSync(bad, 0o600);
  ok('G3 unparsable refused', G3(bad) === 'JOURNEY_GATE3_E_PARSE');

  // ---- Pinned literals in the expected post equal what ids.ts produces ----
  const lit = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '-e',
    "import('./e2e/gradebook-roles/journey/ids.ts').then((m) => process.stdout.write(JSON.stringify({ size: m.UPLOAD.body().length, stored: m.STORED_FEEDBACK })))"], { cwd: repo, encoding: 'utf8' }));
  const expPost = fs.readFileSync(path.join(repo, 'scripts/gradebook-fixture/journey/expected-journey-post.txt'), 'utf8');
  const expBody = expPost.split('\n').filter((l) => !l.startsWith('#')).join('\n');
  const md5 = createHash('md5').update(lit.stored).digest('hex');
  ok(`LIT upload size ${lit.size} pinned on ATT and OBJ`, (expBody.match(new RegExp(`^(ATT|OBJ) .* size=${lit.size} `, 'gm')) || []).length === 2);
  ok('LIT feedback md5 pinned on SUB', expBody.includes(`comments_md5=${md5} `));

  // ---- Witness comparator on fakes: a faithful fake PASSES; each defect FAILS with its own code ----
  const ids = { enrollment: 0, prog_page: 0, prog_assignment: 0, submission: 0, attachment: 0, object: 0, certificate: 0, audit_download: 0, audit_grade: 0, notif_staff: 0, notif_receipt: 0, notif_grade: 0 };
  for (const k of Object.keys(ids)) ids[k] = randomUUID();
  const table = { enrollment: 'enrollments', prog_page: 'content_item_progressions', prog_assignment: 'content_item_progressions', submission: 'assignment_submissions', attachment: 'submission_attachments', object: 'storage.objects', certificate: 'certificates', audit_download: 'submission_audit_events', audit_grade: 'submission_audit_events', notif_staff: 'notifications', notif_receipt: 'notifications', notif_grade: 'notifications' };
  const fill = (l) => l.replace(/<ID:([a-z_]+)>/g, (_, n) => ids[n]);
  // Full declared inventory (21 scopes); the histories and other optional scopes are empty here (UNPROVEN-EMPTY).
  const md5of = (x) => createHash('md5').update(x).digest('hex');
  const EMPTY_OK = new Set(['other_enrollments', 'other_progressions', 'other_submissions', 'other_attachments', 'other_objects', 'other_certificates', 'other_audit_events', 'other_notifications', 'other_assignments', 'quiz_submissions', 'quiz_submission_answers', 'grade_change_notifications', 'certificate_verification_attempts', 'grades', 'grade_history']);
  const hashes = Object.entries(DECLARED_HASHES).map(([n, kind]) => `HASH ${n} ${kind === 'single' ? md5of(n) : EMPTY_OK.has(n) ? '0 empty' : `2 ${md5of(n)}`}`);
  const journeyLines = expPost.split('\n').filter((l) => l && !l.startsWith('#') && !l.startsWith('ADDED '));
  const manifest = Object.keys(ids).map((n) => `MANIFEST ${table[n]} ${ids[n]}`);
  const preFake = ['COURSE 9b6c0000-0000-4000-8000-000000000001 published=false status=draft', ...hashes].join('\n');
  const postFake = (over = {}) => [...(over.journey ?? journeyLines.map(fill)), ...(over.manifest ?? manifest), ...(over.hashes ?? hashes)].join('\n');
  const C = (pre, post) => compareWitness(pre, post);
  const good1 = C(preFake, postFake());
  ok(`CMP faithful fake passes (protected ${good1.protectedHashes.length}, unproven-empty ${good1.unprovenEmpty.join(',')})`, good1.ok && good1.unprovenEmpty.includes('grade_history') && good1.protectedHashes.length + good1.unprovenEmpty.length === 21);
  const has = (r, c) => !r.ok && r.failures.some((f) => f.startsWith(c));
  const jl = journeyLines.map(fill);
  ok('CMP wrong row (grade 8) fails', has(C(preFake, postFake({ journey: jl.map((l) => l.replace(' grade=7 ', ' grade=8 ')) })), 'W_POST_JOURNEY_MISMATCH'));
  ok('CMP inconsistent binding (attachment names another submission) fails', has(C(preFake, postFake({ journey: jl.map((l) => l.startsWith('ATT ') ? l.replace(ids.submission, randomUUID()) : l) })), 'W_POST_JOURNEY_MISMATCH'));
  ok('CMP missing event (no grade audit) fails', has(C(preFake, postFake({ journey: jl.filter((l) => !l.startsWith('AUDIT #2')) })), 'W_POST_MISSING_LINE'));
  ok('CMP extra event (second grade notice) fails', has(C(preFake, postFake({ journey: [...jl, jl.find((l) => l.includes('type=assignment_graded'))] })), 'W_POST_EXTRA_LINE'));
  ok('CMP extra manifest row (second enrollment) fails', has(C(preFake, postFake({ manifest: [...manifest, `MANIFEST enrollments ${randomUUID()}`] })), 'W_MANIFEST_EXTRA enrollments'));
  ok('CMP bound id not in manifest fails', has(C(preFake, postFake({ manifest: manifest.map((m) => m.includes(ids.certificate) ? `MANIFEST certificates ${randomUUID()}` : m) })), 'W_BOUND_ID_NOT_ADDED certificates'));
  ok('CMP removed pre row fails', has(C(preFake + `\nMANIFEST enrollments ${randomUUID()}`, postFake()), 'W_PRE_MANIFEST_NOT_EMPTY'));
  ok('CMP changed protected hash fails', has(C(preFake, postFake({ hashes: hashes.map((h) => h.startsWith('HASH other_courses') ? `HASH other_courses 2 ${md5of('changed')}` : h) })), 'W_HASH_CHANGED other_courses'));
  const emptyReq = hashes.map((h) => h.startsWith('HASH other_items') ? 'HASH other_items 0 empty' : h);
  ok('CMP empty required protected scope fails', has(C(['COURSE 9b6c0000-0000-4000-8000-000000000001 published=false status=draft', ...emptyReq].join('\n'), postFake({ hashes: emptyReq })), 'W_REQUIRED_SCOPE_EMPTY other_items'));
  ok('CMP pre not pristine (already published) fails', has(C(preFake.replace('published=false status=draft', 'published=true status=published'), postFake()), 'W_PRE_JOURNEY_MISMATCH'));
  ok('CMP unknown line fails', has(C(preFake, postFake() + '\nERROR: relation does not exist'), 'W_POST_UNKNOWN_LINE'));

  // Hash inventory and grammar (review r3 item 1). Causal: the bc65540 comparator ACCEPTED a both-side omission.
  const without = (names) => hashes.filter((h) => !names.includes(h.split(' ')[1]));
  const preWith = (hs) => ['COURSE 9b6c0000-0000-4000-8000-000000000001 published=false status=draft', ...hs].join('\n');
  const omit = without(['grade_history', 'other_submissions']);
  const oldSrc = execFileSync('git', ['show', 'bc65540:scripts/gradebook-fixture/journey/tests/compare-witness.mjs'], { cwd: repo, encoding: 'utf8' });
  const oldF = path.join(tmp, 'compare-witness-bc65540.mjs'); fs.writeFileSync(oldF, oldSrc);
  const oldCmp = (await import(oldF)).compareWitness;
  const expBoth = { expectedPre: fs.readFileSync(path.join(repo, 'scripts/gradebook-fixture/journey/expected-journey-pre.txt'), 'utf8'), expectedPost: expPost };
  ok('CMP causal: OLD comparator (bc65540) accepted both-side omission of grade_history + other_submissions', oldCmp(preWith(omit), postFake({ hashes: omit }), expBoth).ok === true);
  const extraHs = [...hashes, 'HASH bonus 0 empty'];
  ok('CMP causal: OLD comparator accepted an undeclared extra scope on both sides', oldCmp(preWith(extraHs), postFake({ hashes: extraHs }), expBoth).ok === true);
  const shortHs = hashes.map((h) => h.split(' ')[1] === 'other_courses' ? 'HASH other_courses 2 0f0f' : h);
  ok('CMP causal: OLD comparator accepted a malformed (4-hex) hash equal on both sides', oldCmp(preWith(shortHs), postFake({ hashes: shortHs }), expBoth).ok === true);
  const om = C(preWith(omit), postFake({ hashes: omit }));
  ok('CMP both-side omission now fails on BOTH sides for both scopes', ['W_HASH_MISSING_PRE grade_history', 'W_HASH_MISSING_POST grade_history', 'W_HASH_MISSING_PRE other_submissions', 'W_HASH_MISSING_POST other_submissions'].every((c) => om.failures.includes(c)));
  ok('CMP post-only omission fails', has(C(preFake, postFake({ hashes: without(['grades']) })), 'W_HASH_MISSING_POST grades'));
  ok('CMP undeclared extra scope fails', has(C(preWith([...hashes, 'HASH bonus 0 empty']), postFake({ hashes: [...hashes, 'HASH bonus 0 empty'] })), 'W_HASH_UNDECLARED_PRE bonus'));
  ok('CMP duplicate scope line fails', has(C(preFake, postFake({ hashes: [...hashes, hashes[0]] })), 'W_HASH_DUPLICATE_POST other_courses'));
  const mal = (name, v) => { const hs = hashes.map((h) => h.split(' ')[1] === name ? `HASH ${name} ${v}` : h); return C(preWith(hs), postFake({ hashes: hs })); };
  ok('CMP short md5 (4 hex) fails even when equal on both sides', has(mal('other_courses', '2 0f0f'), 'W_HASH_MALFORMED_PRE other_courses'));
  ok('CMP uppercase / 33-char md5 fails', has(mal('other_courses', `2 ${md5of('x').toUpperCase()}`), 'W_HASH_MALFORMED') && has(mal('other_courses', `2 ${md5of('x')}a`), 'W_HASH_MALFORMED'));
  ok('CMP count without md5 / "0 <md5>" / "3 empty" fail', has(mal('grades', '3'), 'W_HASH_MALFORMED') && has(mal('grades', `0 ${md5of('x')}`), 'W_HASH_MALFORMED') && has(mal('grades', '3 empty'), 'W_HASH_MALFORMED'));
  ok('CMP leading-zero count fails', has(mal('grades', `02 ${md5of('x')}`), 'W_HASH_MALFORMED'));
  ok('CMP single-row hash with a count fails', has(mal('journey_course_rest', `1 ${md5of('x')}`), 'W_HASH_MALFORMED') && has(mal('journey_course_rest', '0 empty'), 'W_HASH_MALFORMED'));
  ok('CMP ABSENT allowed only on the guarded scope, and still FAILS there', has(mal('certificate_verification_attempts', 'ABSENT'), 'W_HASH_ABSENT certificate_verification_attempts') && has(mal('grades', 'ABSENT'), 'W_HASH_MALFORMED_PRE grades'));
  ok('CMP empty optional history stays UNPROVEN-EMPTY (not a failure)', good1.unprovenEmpty.includes('grade_history') && !good1.failures.length);
  ok('CMP non-empty history is protected', (() => { const hs = hashes.map((h) => h.split(' ')[1] === 'grade_history' ? `HASH grade_history 4 ${md5of('gh')}` : h); const r = C(preWith(hs), postFake({ hashes: hs })); return r.ok && r.protectedHashes.includes('grade_history'); })());
  const witSql = fs.readFileSync(path.join(repo, 'scripts/gradebook-fixture/journey/witness-journey.sql'), 'utf8');
  const sqlNames = [...new Set([...witSql.matchAll(/^select 'HASH ([a-z_]+) /gm)].map((m) => m[1]))].sort();
  ok(`CMP declared inventory equals the witness SQL (${sqlNames.length} scopes)`, sqlNames.length === 21 && JSON.stringify(sqlNames) === JSON.stringify(Object.keys(DECLARED_HASHES).sort()));

  // ---- Observer core on a fake emitter (helper behaviour only; NOT journey executions) ----
  const O = 'http://127.0.0.1:54321';
  const fakeTarget = () => new EventEmitter();
  const tick = () => new Promise((r) => setImmediate(r));
  const start = (t, method, url) => { const req = { url: () => url, method: () => method, _s: null, response: async () => (req._s === null ? null : { status: () => req._s }) }; t.emit('request', req); return req; };
  const finish = async (t, req, status) => { req._s = status; t.emit('requestfinished', req); await tick(); };
  const fail = (t, req) => t.emit('requestfailed', req);
  const SPEC = { spec: { method: 'POST', path: '/rest/v1/enrollments' }, count: 1, status: [201] };
  const obs = async (script, want = [SPEC], o = {}) => { const t = fakeTarget(); const rec = createRecorder(t); await script(t); rec.stop(); return evaluate(rec.calls, want, { origin: O, ...o }).failures; };
  const OBS = (name, fails, expectCode) => ok(`OBS ${name}`, expectCode === null ? fails.length === 0 : fails.some((f) => f.startsWith(expectCode)));
  OBS('one start, finished 201: pass', await obs(async (t) => { await finish(t, start(t, 'POST', `${O}/rest/v1/enrollments?select=*`), 201); }), null);
  OBS('no request started: OBS_COUNT', await obs(async () => {}), 'OBS_COUNT');
  OBS('duplicate start: OBS_COUNT', await obs(async (t) => { for (let i = 0; i < 2; i++) await finish(t, start(t, 'POST', `${O}/rest/v1/enrollments`), 201); }), 'OBS_COUNT');
  OBS('started but never terminal: OBS_PENDING', await obs(async (t) => { start(t, 'POST', `${O}/rest/v1/enrollments`); }), 'OBS_PENDING');
  OBS('requestfailed: OBS_FAILED', await obs(async (t) => { fail(t, start(t, 'POST', `${O}/rest/v1/enrollments`)); }), 'OBS_FAILED');
  OBS('terminal 403: OBS_STATUS', await obs(async (t) => { await finish(t, start(t, 'POST', `${O}/rest/v1/enrollments`), 403); }), 'OBS_STATUS');
  OBS('unexpected query key: OBS_NEAR_MISS', await obs(async (t) => { await finish(t, start(t, 'POST', `${O}/rest/v1/enrollments?on_conflict=user_id`), 201); }), 'OBS_NEAR_MISS');
  const Q = { spec: { method: 'PATCH', path: '/rest/v1/assignment_submissions', query: { id: 'eq.a' } }, count: 1, status: [200] };
  OBS('wrong query value: OBS_NEAR_MISS', await obs(async (t) => { await finish(t, start(t, 'PATCH', `${O}/rest/v1/assignment_submissions?id=eq.b`), 200); }, [Q]), 'OBS_NEAR_MISS');
  OBS('repeated query key: OBS_NEAR_MISS', await obs(async (t) => { await finish(t, start(t, 'PATCH', `${O}/rest/v1/assignment_submissions?id=eq.a&id=eq.b`), 200); }, [Q]), 'OBS_NEAR_MISS');
  OBS('exact query plus passthrough select: pass', await obs(async (t) => { await finish(t, start(t, 'PATCH', `${O}/rest/v1/assignment_submissions?id=eq.a&select=id,grade`), 200); }, [Q]), null);
  OBS('same path on a foreign origin is not counted: OBS_COUNT', await obs(async (t) => { await finish(t, start(t, 'POST', 'http://127.0.0.1:9999/rest/v1/enrollments'), 201); }), 'OBS_COUNT');
  OBS('other method on the path is not counted: OBS_COUNT', await obs(async (t) => { await finish(t, start(t, 'GET', `${O}/rest/v1/enrollments`), 200); }), 'OBS_COUNT');
  const A = { spec: { method: 'POST', path: '/storage/v1/object/b/p/' }, count: 1 }, B = { spec: { method: 'POST', path: '/rest/v1/x' }, count: 1 };
  OBS('ordered: declared order: pass', await obs(async (t) => { await finish(t, start(t, 'POST', `${O}/storage/v1/object/b/p/1.pdf`), 200); await finish(t, start(t, 'POST', `${O}/rest/v1/x`), 201); }, [A, B], { ordered: true }), null);
  OBS('ordered: reversed starts: OBS_ORDER', await obs(async (t) => { await finish(t, start(t, 'POST', `${O}/rest/v1/x`), 201); await finish(t, start(t, 'POST', `${O}/storage/v1/object/b/p/1.pdf`), 200); }, [A, B], { ordered: true }), 'OBS_ORDER');
  OBS('prefix spec does not match a sibling prefix: OBS_COUNT', await obs(async (t) => { await finish(t, start(t, 'POST', `${O}/storage/v1/object/b/px/1.pdf`), 200); }, [A]), 'OBS_COUNT');
  OBS('start is what counts: a start finished later still counts once', await obs(async (t) => { const r = start(t, 'POST', `${O}/rest/v1/enrollments`); await tick(); await finish(t, r, 201); }), null);
  { const t = fakeTarget(); const rec = createRecorder(t); rec.stop(); await finish(t, start(t, 'POST', `${O}/rest/v1/enrollments`), 201); ok('OBS requests after stop() are not recorded', rec.calls.length === 0); }
  { const t = fakeTarget(); const rec = createRecorder(t); const r = start(t, 'POST', `${O}/rest/v1/enrollments`); const before = settled(rec.calls, [SPEC], O); await finish(t, r, 201); ok('OBS settled() waits for the terminal event', before === false && settled(rec.calls, [SPEC], O) === true); }

  // ---- Inherited-key controls (review r4 P2): OLD fcc606f accepted, NEW refuses ----
  const fccObsF = path.join(tmp, 'observe-core-fcc606f.mjs');
  fs.writeFileSync(fccObsF, execFileSync('git', ['show', 'fcc606f:e2e/gradebook-roles/journey/observe-core.mjs'], { cwd: repo, encoding: 'utf8' }));
  const fccObs = await import(fccObsF);
  const fccCmpF = path.join(tmp, 'compare-witness-fcc606f.mjs');
  fs.writeFileSync(fccCmpF, execFileSync('git', ['show', 'fcc606f:scripts/gradebook-fixture/journey/tests/compare-witness.mjs'], { cwd: repo, encoding: 'utf8' }));
  const fccCmp = (await import(fccCmpF)).compareWitness;
  for (const k of ['toString', 'constructor', '__proto__']) {
    const hs = [...hashes, `HASH ${k} 0 empty`];
    const pre = preWith(hs), post = postFake({ hashes: hs });
    ok(`PROTO CMP OLD fcc606f accepted inherited scope name ${k}`, fccCmp(pre, post, expBoth).ok === true);
    ok(`PROTO CMP NEW refuses inherited scope name ${k} on both sides`, has(C(pre, post), `W_HASH_UNDECLARED_PRE ${k}`) && C(pre, post).failures.includes(`W_HASH_UNDECLARED_POST ${k}`));
    const url = `${O}/rest/v1/assignment_submissions?id=eq.a&${k}=x`;
    const drive = async (core) => { const t = fakeTarget(); const rec = core.createRecorder(t); const r = start(t, 'PATCH', url); r._s = 200; t.emit('requestfinished', r); await tick(); rec.stop(); return core.evaluate(rec.calls, [Q], { origin: O }).failures; };
    ok(`PROTO OBS OLD fcc606f matched an unexpected ${k} query key`, (await drive(fccObs)).length === 0);
    ok(`PROTO OBS NEW reports ${k} query key as OBS_NEAR_MISS`, (await drive({ createRecorder, evaluate })).some((f) => f.startsWith('OBS_NEAR_MISS')));
  }
  ok('PROTO CMP full 21-scope positive still passes', C(preFake, postFake()).ok);
  OBS('PROTO allowed passthrough (select, order) still passes', await obs(async (t) => { await finish(t, start(t, 'PATCH', `${O}/rest/v1/assignment_submissions?id=eq.a&select=id&order=id.asc`), 200); }, [Q]), null);
  ok('PROTO DECLARED_HASHES has a null prototype and is frozen', Object.getPrototypeOf(DECLARED_HASHES) === null && Object.isFrozen(DECLARED_HASHES));

  // ---- Run-state validation before persistence (review r3 item 2) ----
  const PFX = 'submissions/9b6c0000-0000-4000-8000-000000000001/e2e00000-0000-4000-8000-000000000003/';
  const rs = { submissionId: randomUUID(), attachmentId: randomUUID(), attachmentKey: `${PFX}1730500000000-abc123.pdf`, certificate: { id: randomUUID(), code: 'A1B2C3D4E5F6', issuedAt: '2026-11-01T22:00:00.123456+00:00' } };
  const RS = (name, s, code) => ok(`RS ${name}`, code === null ? runStateFailures(s, PFX).length === 0 : runStateFailures(s, PFX).includes(code));
  RS('faithful run state accepted', rs, null);
  RS('String(undefined) submission id refused', { ...rs, submissionId: String(undefined) }, 'RS_SUBMISSION_ID');
  RS('missing attachment id refused', { ...rs, attachmentId: undefined }, 'RS_ATTACHMENT_ID');
  RS('numeric certificate id refused', { ...rs, certificate: { ...rs.certificate, id: 42 } }, 'RS_CERTIFICATE_ID');
  RS('lowercase / short code refused', { ...rs, certificate: { ...rs.certificate, code: 'a1b2c3' } }, 'RS_CERTIFICATE_CODE');
  RS('"undefined" issued_at refused', { ...rs, certificate: { ...rs.certificate, issuedAt: 'undefined' } }, 'RS_CERTIFICATE_ISSUED_AT');
  RS('date-only issued_at refused', { ...rs, certificate: { ...rs.certificate, issuedAt: '2026-11-01' } }, 'RS_CERTIFICATE_ISSUED_AT');
  RS('key outside the learner prefix refused', { ...rs, attachmentKey: 'submissions/other/1-a.pdf' }, 'RS_ATTACHMENT_KEY');
  RS('same id for submission and attachment refused', { ...rs, attachmentId: rs.submissionId }, 'RS_IDS_NOT_DISTINCT');
  RS('extra key refused', { ...rs, note: 'x' }, 'RS_KEYS');

  // ---- Gate 3 live recheck on a fake API (helper behaviour only; NOT a stack) ----
  const API = 'http://127.0.0.1:54321';
  const RID = '11111111-2222-4333-8444-555555555555';
  /** fake fetch: serves `rows` for the carrier id and `other` for any other id; records every call */
  const fakeApi = ({ rows, other = [], status = 200, throws = false, bodyText = null } = {}) => {
    const calls = [];
    const f = async (url, init) => {
      calls.push({ url, init });
      if (throws) throw new Error('ECONNREFUSED secret-ish');
      const id = new URL(url).searchParams.get('id');
      const body = id === `eq.${CTRL}` ? rows : other;
      return { status, json: async () => { if (bodyText !== null) throw new Error('bad json'); return body; } };
    };
    f.calls = calls; return f;
  };
  const carrierRow = (v = PAIRING_PREFIX + sid) => [{ id: CTRL, description: v }];
  const LIVE = async (f, rid = RID) => { try { await assertLivePairing({ stack_id: sid, control_course_id: CTRL }, { apiOrigin: API, anonKey: 'anon', fetchImpl: f, randomId: rid }); return 'ACCEPTED'; } catch (e) { return e && e.code ? e.code : 'UNCODED'; } };
  { const f = fakeApi({ rows: carrierRow() });
    ok('LIVE carrier served with this nonce and filter honoured: accepted', await LIVE(f) === 'ACCEPTED');
    ok('LIVE two GETs, exact carrier query then the random-id control', f.calls.length === 2 && f.calls[0].url === `${API}/rest/v1/courses?id=eq.${CTRL}&select=id,description` && f.calls[1].url === `${API}/rest/v1/courses?id=eq.${RID}&select=id,description`);
    ok('LIVE anon key only: no Authorization header, GET, no redirects', f.calls.every((c) => c.init.method === 'GET' && c.init.redirect === 'error' && !Object.keys(c.init.headers).some((h) => h.toLowerCase() === 'authorization') && c.init.headers.apikey === 'anon')); }
  ok('LIVE other nonce served: JOURNEY_GATE3_E_LIVE_MISMATCH', await LIVE(fakeApi({ rows: carrierRow(PAIRING_PREFIX + 'c'.repeat(32)) })) === 'JOURNEY_GATE3_E_LIVE_MISMATCH');
  ok('LIVE carrier missing: JOURNEY_GATE3_E_LIVE_COUNT', await LIVE(fakeApi({ rows: [] })) === 'JOURNEY_GATE3_E_LIVE_COUNT');
  ok('LIVE two rows: JOURNEY_GATE3_E_LIVE_COUNT', await LIVE(fakeApi({ rows: [...carrierRow(), ...carrierRow()] })) === 'JOURNEY_GATE3_E_LIVE_COUNT');
  ok('LIVE extra column or other id: JOURNEY_GATE3_E_LIVE_SHAPE', await LIVE(fakeApi({ rows: [{ ...carrierRow()[0], title: 'x' }] })) === 'JOURNEY_GATE3_E_LIVE_SHAPE' && await LIVE(fakeApi({ rows: [{ id: RID, description: PAIRING_PREFIX + sid }] })) === 'JOURNEY_GATE3_E_LIVE_SHAPE');
  ok('LIVE API ignores the filter: JOURNEY_GATE3_E_LIVE_NOT_FILTERING', await LIVE(fakeApi({ rows: carrierRow(), other: carrierRow() })) === 'JOURNEY_GATE3_E_LIVE_NOT_FILTERING');
  ok('LIVE non-200: JOURNEY_GATE3_E_LIVE_STATUS', await LIVE(fakeApi({ rows: carrierRow(), status: 401 })) === 'JOURNEY_GATE3_E_LIVE_STATUS');
  ok('LIVE transport error: fixed code, raw text dropped', await LIVE(fakeApi({ throws: true })) === 'JOURNEY_GATE3_E_LIVE_TRANSPORT');
  ok('LIVE unparsable body: JOURNEY_GATE3_E_LIVE_PARSE', await LIVE(fakeApi({ rows: carrierRow(), bodyText: 'x' })) === 'JOURNEY_GATE3_E_LIVE_PARSE');
  ok('LIVE control id equal to the carrier or malformed refused', await LIVE(fakeApi({ rows: carrierRow() }), CTRL) === 'JOURNEY_GATE3_E_LIVE_CONTROL_ID' && await LIVE(fakeApi({ rows: carrierRow() }), 'x') === 'JOURNEY_GATE3_E_LIVE_CONTROL_ID');

  // ---- Pairing producer on a fake DSN + fake API (helper behaviour only; NOT a stack) ----
  const fakeDb = ({ count = 0, inserted = 1, readBack = null } = {}) => {
    const st = { order: [], stored: null };
    return { st, db: {
      async journeyRowCount() { st.order.push('precheck'); return count; },
      async insertCarrier(v) { st.order.push('insert'); st.stored = v; return inserted; },
      async readCarrier() { st.order.push('dbread'); return readBack ?? (st.stored === null ? [] : [st.stored]); },
    } };
  };
  const PAIR = async (dbo, api, nonce = sid) => { const trace = []; try { const p = await producePairing({ db: dbo.db, fetchImpl: api, apiOrigin: API, anonKey: 'anon', nonce, randomId: RID, trace }); return { code: 'ACCEPTED', p, trace }; } catch (e) { return { code: e && e.code ? e.code : 'UNCODED', trace }; } };
  { const d = fakeDb(); const r = await PAIR(d, fakeApi({ rows: carrierRow() }));
    ok('PAIR happy path gives proof v2 built from the observed reads', r.code === 'ACCEPTED' && JSON.stringify(r.p) === JSON.stringify(base));
    ok('PAIR order is precheck, insert, DSN readback, API readback', JSON.stringify(r.trace) === '["precheck","insert","dbread","apiread"]' && JSON.stringify(d.st.order) === '["precheck","insert","dbread"]');
    ok('PAIR carrier written is the prefixed nonce', d.st.stored === PAIRING_PREFIX + sid);
    const pf = path.join(fs.mkdtempSync(path.join(tmp, 'pp-')), 'pairing-proof.json'); fs.chmodSync(path.dirname(pf), 0o700);
    writePrivateFile(path.dirname(pf), 'pairing-proof.json', JSON.stringify(r.p));
    ok('PAIR produced proof is accepted by the v2 consumer', G3(pf) === 'ACCEPTED'); }
  { const d = fakeDb({ count: 3 }); const r = await PAIR(d, fakeApi({ rows: carrierRow() }));
    ok('PAIR used stack (journey rows before pairing): PAIR_E_USED_STACK, nothing inserted', r.code === 'PAIR_E_USED_STACK' && JSON.stringify(d.st.order) === '["precheck"]'); }
  ok('PAIR precheck not a count: PAIR_E_PRECHECK', (await PAIR(fakeDb({ count: '0' }), fakeApi({ rows: carrierRow() }))).code === 'PAIR_E_PRECHECK');
  { const d = fakeDb({ inserted: 0 }); const r = await PAIR(d, fakeApi({ rows: carrierRow() }));
    ok('PAIR insert conflict (0 rows): PAIR_E_INSERT, no readback', r.code === 'PAIR_E_INSERT' && JSON.stringify(d.st.order) === '["precheck","insert"]'); }
  ok('PAIR DSN readback differs: PAIR_E_DB_MISMATCH, API never called', await (async () => { const a = fakeApi({ rows: carrierRow() }); const r = await PAIR(fakeDb({ readBack: [PAIRING_PREFIX + 'd'.repeat(32)] }), a); return r.code === 'PAIR_E_DB_MISMATCH' && a.calls.length === 0; })());
  ok('PAIR DSN readback two rows: PAIR_E_DB_MISMATCH', (await PAIR(fakeDb({ readBack: [PAIRING_PREFIX + sid, PAIRING_PREFIX + sid] }), fakeApi({ rows: carrierRow() }))).code === 'PAIR_E_DB_MISMATCH');
  ok('PAIR API serves another value: PAIR_E_API_MISMATCH', (await PAIR(fakeDb(), fakeApi({ rows: carrierRow(PAIRING_PREFIX + 'e'.repeat(32)) }))).code === 'PAIR_E_API_MISMATCH');
  ok('PAIR API row missing: PAIR_E_API_COUNT', (await PAIR(fakeDb(), fakeApi({ rows: [] }))).code === 'PAIR_E_API_COUNT');
  ok('PAIR API not filtering: PAIR_E_API_NOT_FILTERING', (await PAIR(fakeDb(), fakeApi({ rows: carrierRow(), other: carrierRow() }))).code === 'PAIR_E_API_NOT_FILTERING');
  ok('PAIR API 500: PAIR_E_API_STATUS', (await PAIR(fakeDb(), fakeApi({ rows: carrierRow(), status: 500 }))).code === 'PAIR_E_API_STATUS');
  ok('PAIR weak nonce refused before any DB call', await (async () => { const d = fakeDb(); const r = await PAIR(d, fakeApi({ rows: carrierRow() }), 'abc'); return r.code === 'PAIR_E_NONCE' && d.st.order.length === 0; })());
  { const a = fakeApi({ rows: carrierRow() }); await PAIR(fakeDb(), a);
    ok('PAIR API reads carry no Authorization header (anon only)', a.calls.length === 2 && a.calls.every((c) => !Object.keys(c.init.headers).some((h) => h.toLowerCase() === 'authorization'))); }

  // ---- Shared helper pins and the D1 gate ----
  const D1_PATHS = ['scripts/e2e/stack-ownership.mjs', 'scripts/e2e/fixtures/stack-ownership.fake.json'];
  const d1Present = fs.existsSync(path.join(repo, D1_MODULE));
  if (d1Present) ok('PIN real tree: all 5 shared files equal their agreed blobs (D1 module present)', pinFailures(repo).length === 0);
  else ok('PIN real tree: the 3 helpers pass and ONLY the 2 absent D1 files refuse (BLOCKED until 637bae9 is in the base)', JSON.stringify(pinFailures(repo)) === JSON.stringify(D1_PATHS.map((x) => `RUN_E_PIN ${x}`)));
  ok('PIN gitBlobId equals git hash-object', gitBlobId(fs.readFileSync(path.join(repo, 'scripts/e2e/assert-safe-target.mjs'))) === execFileSync('git', ['hash-object', 'scripts/e2e/assert-safe-target.mjs'], { cwd: repo, encoding: 'utf8' }).trim());
  { const root = fs.mkdtempSync(path.join(tmp, 'pins-'));
    for (const rel of Object.keys(HELPER_PINS)) { if (!fs.existsSync(path.join(repo, rel))) continue; fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.copyFileSync(path.join(repo, rel), path.join(root, rel)); }
    ok('PIN unmodified copies of the present files pass them', pinFailures(root).every((x) => D1_PATHS.some((d) => x === `RUN_E_PIN ${d}`)) && pinFailures(root).length === (d1Present ? 0 : 2));
    fs.appendFileSync(path.join(root, 'scripts/local-db/assert-local-dsn.mjs'), '\n');
    ok('PIN one changed byte in a shared helper refused', JSON.stringify(pinFailures(root).filter((x) => !D1_PATHS.some((d) => x === `RUN_E_PIN ${d}`))) === '["RUN_E_PIN scripts/local-db/assert-local-dsn.mjs"]');
    fs.rmSync(path.join(root, 'e2e/support/chromium-executable.ts'));
    ok('PIN missing helper refused', pinFailures(root).includes('RUN_E_PIN e2e/support/chromium-executable.ts')); }
  // ---- D1 consumer on a fake verifyRecord (the shared module's contract), plus this lane's stricter checks ----
  const recDir = fs.mkdtempSync(path.join(tmp, 'so-')); fs.chmodSync(recDir, 0o700);
  const REC = { schema: 1, run_id: '1000000001', run_attempt: '1', pg_system_identifier: '7400000000000000001', api_origin: API, app_origin: 'http://127.0.0.1:4173', created_at: '2026-11-02T00:00:00.000Z', disposable: true, bootstrap_sha256: '0'.repeat(64) };
  const recFile = (obj = REC, mode = 0o600) => { const f = path.join(recDir, `rec-${Math.random().toString(16).slice(2)}.json`); fs.writeFileSync(f, JSON.stringify(obj)); fs.chmodSync(f, mode); return f; };
  const fakeVerify = (res) => { const calls = []; const f = (file, a) => { calls.push({ file, a }); return typeof res === 'function' ? res(file, a) : res; }; f.calls = calls; return f; };
  const D1o = (over = {}) => ({ verifyRecord: fakeVerify({ ok: true, code: 'SO_OK', record: REC }), file: recFile(), runId: '1000000001', runAttempt: '1', liveSystemIdentifier: '7400000000000000001', apiOrigin: API, appOrigin: 'http://127.0.0.1:4173', ...over });
  const D1 = (over) => JSON.stringify(stackOwnershipFailures(D1o(over)));
  { const o = D1o(); const r = stackOwnershipFailures(o);
    ok('D1 verified record for this run, cluster and origins: accepted', r.length === 0);
    ok('D1 run id, attempt and the LIVE identifier are passed to the shared verifier', o.verifyRecord.calls.length === 1 && JSON.stringify(o.verifyRecord.calls[0].a) === JSON.stringify({ runId: '1000000001', runAttempt: '1', liveSystemIdentifier: '7400000000000000001' })); }
  ok('D1 every shared refusal maps to its own fixed code', ['SO_ABSENT', 'SO_MODE', 'SO_SIZE', 'SO_PARSE', 'SO_SCHEMA', 'SO_RUN_MISMATCH', 'SO_SYSID_MISMATCH', 'SO_INPUT'].every((c) => D1({ verifyRecord: fakeVerify({ ok: false, code: c, reason: 'x' }) }) === `["RUN_E_D1_${c}"]`));
  ok('D1 ok:true with a non-OK code, or an odd code, refused', D1({ verifyRecord: fakeVerify({ ok: true, code: 'SO_MODE', record: REC }) }) === '["RUN_E_D1_SO_MODE"]' && D1({ verifyRecord: fakeVerify({ ok: false, code: 'weird text' }) }) === '["RUN_E_D1_MODULE"]');
  ok('D1 record for another API origin refused', D1({ verifyRecord: fakeVerify({ ok: true, code: 'SO_OK', record: { ...REC, api_origin: 'http://127.0.0.1:55555' } }) }) === '["RUN_E_D1_API_ORIGIN"]');
  ok('D1 record for another app origin refused', D1({ verifyRecord: fakeVerify({ ok: true, code: 'SO_OK', record: { ...REC, app_origin: 'http://127.0.0.1:5173' } }) }) === '["RUN_E_D1_APP_ORIGIN"]');
  ok('D1 no run attempt refused before the verifier is called', (() => { const o = D1o({ runAttempt: '' }); return JSON.stringify(stackOwnershipFailures(o)) === '["RUN_E_D1_NO_ATTEMPT"]' && o.verifyRecord.calls.length === 0; })());
  ok('D1 record file 0400 or 0640 refused (exact 0600 here; the shared check allows 0400)', D1({ file: recFile(REC, 0o400) }) === '["RUN_E_D1_MODE_EXACT"]' && D1({ file: recFile(REC, 0o640) }) === '["RUN_E_D1_MODE_EXACT"]');
  ok('D1 record owned by another uid refused', D1({ uid: 999999 }) === '["RUN_E_D1_MODE_EXACT"]');
  ok('D1 missing or throwing verifier refused', D1({ verifyRecord: undefined }) === '["RUN_E_D1_MODULE"]' && D1({ verifyRecord: () => { throw new Error('x'); } }) === '["RUN_E_D1_MODULE"]');
  ok('D1 "disposable: true" alone is not accepted: a refused verify with disposable set still refuses', D1({ verifyRecord: fakeVerify({ ok: false, code: 'SO_SYSID_MISMATCH', record: REC }) }) === '["RUN_E_D1_SO_SYSID_MISMATCH"]');
  // With the REAL shared module (only when its pinned blob is in this tree): its codes reach this lane's consumer unchanged.
  if (d1Present && pinFailures(repo).length === 0) {
    const { verifyRecord } = await import(path.join(repo, D1_MODULE));
    const fake = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/e2e/fixtures/stack-ownership.fake.json'), 'utf8'));
    const R = (over, recOver = {}, mode = 0o600) => JSON.stringify(stackOwnershipFailures({ verifyRecord, file: recFile({ ...fake, ...recOver }, mode), runId: fake.run_id, runAttempt: fake.run_attempt, liveSystemIdentifier: fake.pg_system_identifier, apiOrigin: fake.api_origin, appOrigin: fake.app_origin, ...over }));
    ok('D1REAL shared fake record verifies for its run and cluster', R({}) === '[]');
    ok('D1REAL other live identifier: RUN_E_D1_SO_SYSID_MISMATCH', R({ liveSystemIdentifier: '7400000000000000002' }) === '["RUN_E_D1_SO_SYSID_MISMATCH"]');
    ok('D1REAL other run id or attempt: RUN_E_D1_SO_RUN_MISMATCH', R({ runId: '1000000002' }) === '["RUN_E_D1_SO_RUN_MISMATCH"]' && R({ runAttempt: '2' }) === '["RUN_E_D1_SO_RUN_MISMATCH"]');
    ok('D1REAL empty live read: RUN_E_D1_SO_INPUT, never a pass', R({ liveSystemIdentifier: '' }) === '["RUN_E_D1_SO_INPUT"]');
    ok('D1REAL disposable:false: RUN_E_D1_SO_SCHEMA', R({}, { disposable: false }) === '["RUN_E_D1_SO_SCHEMA"]');
    ok('D1REAL extra key: RUN_E_D1_SO_SCHEMA', R({}, { note: 'x' }) === '["RUN_E_D1_SO_SCHEMA"]');
    const lnk = path.join(recDir, 'link.json'); fs.symlinkSync(recFile(fake), lnk);
    ok('D1REAL symlinked record: RUN_E_D1_SO_ABSENT', JSON.stringify(stackOwnershipFailures({ verifyRecord, file: lnk, runId: fake.run_id, runAttempt: fake.run_attempt, liveSystemIdentifier: fake.pg_system_identifier, apiOrigin: fake.api_origin, appOrigin: fake.app_origin })) === '["RUN_E_D1_SO_ABSENT"]');
    ok('D1REAL absent record: RUN_E_D1_SO_ABSENT', JSON.stringify(stackOwnershipFailures({ verifyRecord, file: path.join(recDir, 'none.json'), runId: fake.run_id, runAttempt: fake.run_attempt, liveSystemIdentifier: fake.pg_system_identifier, apiOrigin: fake.api_origin, appOrigin: fake.app_origin })) === '["RUN_E_D1_SO_ABSENT"]');
  } else console.log('skip D1REAL (shared module 637bae9 not in this tree; not counted)');

  // ---- Runner adapter refusals that need no stack (helper behaviour; the full run is UNEXECUTED) ----
  { const sandbox = fs.mkdtempSync(path.join(tmp, 'runner-')); fs.chmodSync(sandbox, 0o700);
    const runSh = path.join(repo, 'scripts/gradebook-fixture/journey/run-journey.sh');
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: sandbox, RUNNER_TEMP: sandbox };
    const run = (args, extra = {}) => { try { execFileSync('bash', [runSh, ...args], { env: { ...env, ...extra }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); return { rc: 0, err: '' }; } catch (e) { return { rc: e.status, err: String(e.stderr), out: String(e.stdout) }; } };
    const r0 = run([]);
    ok('RUN no evidence dir: RUN_E_USAGE, exit 2', r0.rc === 2 && r0.err.trim() === 'run-journey refused: RUN_E_USAGE');
    const r1 = run([path.join(sandbox, 'out')]);
    const want = d1Present ? /^run-journey refused: RUN_E_(TARGET|BINDING|DSN)$/ : /^run-journey refused: RUN_E_PIN$/;
    ok(`RUN no stack env: refused at ${d1Present ? 'the target guard' : 'step 0 pins (D1 module absent)'} (code only), nothing written`, r1.rc === 3 && want.test(r1.err.trim()) && fs.readdirSync(sandbox).length === 0);
    const r2 = run([sandbox]);
    ok('RUN existing evidence dir refused', r2.rc === 2 && r2.err.trim() === 'run-journey refused: RUN_E_OUT_EXISTS'); }

  // ---- Static contract: real tree PASS, each mutation FAILS its own rule ----
  const real = checkJourney(repo);
  ok(`SC real tree passes (${real.length ? real.join('; ') : 'no violations'})`, real.length === 0);
  const copyTree = () => {
    const root = fs.mkdtempSync(path.join(tmp, 'tree-'));
    for (const d of ['e2e/gradebook-roles/journey', 'scripts/gradebook-fixture/journey', 'scripts/gradebook-fixture/journey/tests']) {
      fs.mkdirSync(path.join(root, d), { recursive: true });
      for (const f of fs.readdirSync(path.join(repo, d))) {
        const s = path.join(repo, d, f);
        if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(root, d, f));
      }
    }
    return root;
  };
  const mutate = (rel, fn) => { const root = copyTree(); const f = path.join(root, rel); fs.writeFileSync(f, fn(fs.readFileSync(f, 'utf8'))); return checkJourney(root); };
  const J = 'e2e/gradebook-roles/journey', S = 'scripts/gradebook-fixture/journey';
  const cases = [
    ['seed deletes a row', `${S}/seed-journey.sql`, (s) => s.replace('commit;', "delete from public.enrollments where course_id = '9b6c0000-0000-4000-8000-000000000001';\ncommit;"), 'R1_SEED_NON_INSERT_WRITE'],
    ['seed creates a permissive policy', `${S}/seed-journey.sql`, (s) => s.replace('commit;', 'create policy p on public.enrollments for insert with check (true);\ncommit;'), 'R1_SEED_DDL'],
    ['seed inserts the enrollment itself (shortcut)', `${S}/seed-journey.sql`, (s) => s.replace('commit;', "insert into public.enrollments (user_id, course_id) values ('e2e00000-0000-4000-8000-000000000003','9b6c0000-0000-4000-8000-000000000001');\ncommit;"), 'R1_SEED_TABLE_public.enrollments'],
    ['seed pre-publishes the course', `${S}/seed-journey.sql`, (s) => s.replace("false, 'draft', 'e2e00000", "true, 'published', 'e2e00000"), 'R1_SEED_COURSE_NOT_DRAFT'],
    ['seed uses service_role claims', `${S}/seed-journey.sql`, (s) => s.replace('begin;', "begin;\nselect set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);"), 'R1_SEED_CLAIMS'],
    ['seed loses its pristine refusal', `${S}/seed-journey.sql`, (s) => s.replaceAll('JOURNEY SEED REFUSED', 'journey note'), 'R1_SEED_NO_PRISTINE_REFUSAL'],
    ['witness writes', `${S}/witness-journey.sql`, (s) => s + "\nupdate public.courses set published = true where id = '9b6c0000-0000-4000-8000-000000000001';\n", 'R2_WITNESS_WRITES'],
    ['spec PATCHes the grade through the API', `${J}/j3-instructor-grade.spec.ts`, (s) => s.replace("() => page.getByRole('button', { name: /^Save$/ }).click()", "() => page.request.patch('http://127.0.0.1:54321/rest/v1/assignment_submissions', { data: { grade: 7 } })"), 'R3_OWN_REQUEST'],
    ['spec mocks the API', `${J}/j2-learner-enroll-submit.spec.ts`, (s) => s.replace("test.describe.configure({ mode: 'serial' });", "test.describe.configure({ mode: 'serial' });\ntest.beforeEach(async ({ page }) => { await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 201, body: '[]' })); });"), 'R3_MOCKED_API'],
    ['spec writes through the supabase client', `${J}/j2-learner-enroll-submit.spec.ts`, (s) => s.replace("test.describe.configure({ mode: 'serial' });", "test.describe.configure({ mode: 'serial' });\nconst x = () => supabase.from('enrollments');"), 'R3_CLIENT_SHORTCUT'],
    ['spec reads the service key', `${J}/j1-instructor-publish.spec.ts`, (s) => s.replace("test.describe.configure({ mode: 'serial' });", "test.describe.configure({ mode: 'serial' });\nconst k = process.env.SUPABASE_SERVICE_ROLE_KEY;"), 'R3_SERVICE_KEY'],
    ['spec logs a URL', `${J}/j4-learner-readback-certificate.spec.ts`, (s) => s.replace('expect(resp.status()).toBe(200);', 'console.log(resp.url());\n  expect(resp.status()).toBe(200);'), 'R3_URL_OR_LOG'],
    ['spec evaluates in page', `${J}/j2-learner-enroll-submit.spec.ts`, (s) => s.replace("test.describe.configure({ mode: 'serial' });", "test.describe.configure({ mode: 'serial' });\nconst e = (page: any) => page.evaluate(() => 1);"), 'R3_EVALUATE'],
    ['a pass threshold is invented', `${J}/ids.ts`, (s) => s + '\nexport const PASSING_SCORE = 7;\n', 'R4_GRADE_THRESHOLD'],
    ['ts id drifts from the seed', `${J}/ids.ts`, (s) => s.replace("assignment: '9b6c0000-0000-4000-8000-000000000202'", "assignment: '9b6c0000-0000-4000-8000-000000000299'"), 'R5_TS_ID_NOT_SEEDED_299'],
    ['grading fixture id leaks into the journey', `${J}/j3-instructor-grade.spec.ts`, (s) => s + "\nconst g = '9b6b0000-0000-4000-8000-000000000302';\n", 'R5_GRADING_FIXTURE_ID'],
    ['hosted project ref appears', `${J}/ids.ts`, (s) => s + "\nexport const H = 'https://siuqvhscuiycvdrtiqsh.supabase.co';\n", 'R5_HOSTED_REF'],
    ['gate 3 moved after sign-in', `${J}/session-setup.ts`, (s) => s.replace('  const proof = assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF, { sessionDir: dir });\n', '').replace("    if (res.status !== 200)", '    const proof = assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF, { sessionDir: dir });\n    if (res.status !== 200)'), 'R6_GATES_AFTER_SIGNIN'],
    ['live pairing recheck moved after sign-in', `${J}/session-setup.ts`, (s) => s.replace("  await assertLivePairing(proof, { apiOrigin: api.origin, anonKey, randomId: randomUUID() });\n", '').replace("    if (res.status !== 200)", "    await assertLivePairing(proof, { apiOrigin: api.origin, anonKey, randomId: randomUUID() });\n    if (res.status !== 200)"), 'R6_LIVE_PAIRING_NOT_BEFORE_SIGNIN'],
    ['live pairing recheck removed', `${J}/session-setup.ts`, (s) => s.replace("  await assertLivePairing(proof, { apiOrigin: api.origin, anonKey, randomId: randomUUID() });\n", ''), 'R6_LIVE_PAIRING_NOT_BEFORE_SIGNIN'],
    ['consumer goes back to the boolean', `${J}/pairing-proof.mjs`, (s) => s.replace("if (p.journey_rows_before_pairing !== 0)", "if (p.produced_before_seed !== true)"), 'R6_PROOF_NOT_V2'],
    ['live recheck sends a persona token', `${J}/pairing-proof.mjs`, (s) => s.replace("headers: { apikey: opts.anonKey,", "headers: { apikey: opts.anonKey, Authorization: 'Bearer x',"), 'R6_LIVE_PAIRING_PERSONA'],
    ['seed inserts the carrier again', `${S}/seed-journey.sql`, (s) => s.replace('begin;', "begin;\ninsert into public.courses (id, title, description, category, level, published, status, instructor_id) values ('9b6c0000-0000-4000-8000-000000000011', 'Journey Control Course', 'x', 'data-science', 'beginner', true, 'published', 'e2e00000-0000-4000-8000-000000000002') on conflict (id) do nothing;"), 'R1_SEED_INSERTS_CARRIER'],
    ['seed no longer bound to the pairing value', `${S}/seed-journey.sql`, (s) => s.replace("description = :'pairing' and ", ''), 'R1_SEED_NOT_BOUND_TO_PAIRING'],
    ['pairing seed updates instead of inserting', `${S}/pairing-seed.sql`, (s) => s + "\nupdate public.courses set description = :'pairing' where id = '9b6c0000-0000-4000-8000-000000000011';\n", 'R1_PAIRING_NON_INSERT'],
    ['pairing seed inserts a second row', `${S}/pairing-seed.sql`, (s) => s + "\ninsert into public.modules (id, course_id, title, week, position, published) values ('9b6c0000-0000-4000-8000-000000000012', '9b6c0000-0000-4000-8000-000000000011', 'm', 1, 1, true);\n", 'R1_PAIRING_NOT_CARRIER_ONLY'],
    ['pairing seed overwrites on conflict', `${S}/pairing-seed.sql`, (s) => s.replace('on conflict (id) do nothing', "on conflict (id) do update set description = excluded.description"), 'R1_PAIRING_NON_INSERT'],
    ['runner seeds before pairing', `${S}/run-journey.sh`, (s) => { const a = s.split('\n'); const i = a.findIndex((l) => l.includes('pairing-producer.mjs" pair')); const j = a.findIndex((l) => l.includes('pairing-producer.mjs" seed')); [a[i], a[j]] = [a[j], a[i]]; return a.join('\n'); }, 'R11_RUNNER_ORDER'],
    ['runner checks D1 after composition', `${S}/run-journey.sh`, (s) => { const a = s.split('\n'); const i = a.findIndex((l) => l.includes('pairing-producer.mjs" ownership')); const [x] = a.splice(i, 1); const j = a.findIndex((l) => l.includes('refuse RUN_E_COMPOSITION')); a.splice(j + 1, 0, x); return a.join('\n'); }, 'R11_RUNNER_ORDER'],
    ['runner drops the D1 gate', `${S}/run-journey.sh`, (s) => s.split('\n').filter((l) => !l.includes('pairing-producer.mjs" ownership')).join('\n'), 'R11_RUNNER_ORDER'],
    ['runner traces commands', `${S}/run-journey.sh`, (s) => s.replace('set -euo pipefail', 'set -euxo pipefail\nset -x'), 'R11_RUNNER_NONCE_OR_TRACE'],
    ['runner deletes outside its parent', `${S}/run-journey.sh`, (s) => s.replace('trap cleanup EXIT', 'trap cleanup EXIT\nrm -rf -- "$TMPROOT"'), 'R11_RUNNER_CLEANUP'],
    ['producer reads the API before the DSN', `${S}/pairing-producer.mjs`, (s) => s.replace("  const rows = await o.db.readCarrier();\n", '').replace("  return { version: 2,", "  const rows = await o.db.readCarrier();\n  return { version: 2,"), 'R11_PRODUCER_ORDER'],
    ['producer logs the carrier', `${S}/pairing-producer.mjs`, (s) => s.replace("  trace.push('insert');", "  console.log(carrier);\n  trace.push('insert');"), 'R11_PRODUCER_LOGS_NONCE'],
    ['producer D1 drops the API origin check', `${S}/pairing-producer.mjs`, (s) => s.replace("if (!record || record.api_origin !== o.apiOrigin) return ['RUN_E_D1_API_ORIGIN'];", ''), 'R11_PRODUCER_D1_WEAK'],
    ['producer D1 trusts disposable', `${S}/pairing-producer.mjs`, (s) => s.replace("  const record = r.record;", "  const record = r.record;\n  if (record && record.disposable === true) return [];"), 'R11_PRODUCER_D1_WEAK'],
    ['producer D1 accepts ok without SO_OK', `${S}/pairing-producer.mjs`, (s) => s.replace("r.ok !== true || r.code !== 'SO_OK'", "r.ok !== true"), 'R11_PRODUCER_D1_WEAK'],
    ['producer D1 module unpinned', `${S}/pairing-producer.mjs`, (s) => s.replace("'scripts/e2e/stack-ownership.mjs': '2bddca9886090520f883dcf32907f6c250664e55',", ''), 'R11_D1_NOT_PINNED'],
    ['runner hides the D1 refusal code', `${S}/run-journey.sh`, (s) => s.replace('ownership >&2 || refuse RUN_E_D1 5', 'ownership >/dev/null || true'), 'R11_RUNNER_NO_D1'],
    ['session saved non-exclusively', `${J}/session-setup.ts`, (s) => s.replace('() => context.storageState())', "() => context.storageState({ path: 'x.json' }))"), 'R6_NON_EXCLUSIVE_SESSION_WRITE'],
    ['error leaks the response body', `${J}/session-setup.ts`, (s) => s.replace('`JOURNEY_SETUP_E_SIGNIN_HTTP_${res.status}_${R}`', '`JOURNEY_SETUP_E_SIGNIN_HTTP ${await res.text()}`'), 'R6_UNSANITIZED_ERROR'],
    ['composition check moved after sign-in', `${J}/session-setup.ts`, (s) => s.replace("  if (process.env.GB_COMPOSITION !== 'composed-r5') throw new JourneyGateError('JOURNEY_SETUP_E_COMPOSITION_NOT_R5');\n", '').replace("    if (res.status !== 200)", "    if (process.env.GB_COMPOSITION !== 'composed-r5') throw new JourneyGateError('JOURNEY_SETUP_E_COMPOSITION_NOT_R5');\n    if (res.status !== 200)"), 'R6_COMPOSITION_AFTER_SIGNIN'],
    ['proof checked without the session dir', `${J}/session-setup.ts`, (s) => s.replace('assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF, { sessionDir: dir })', 'assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF, {} as any)'), 'R6_PROOF_NOT_SEPARATED'],
    ['J4 made serial again', `${J}/j4-learner-readback-certificate.spec.ts`, (s) => s.replace("import { expectProgress } from './progress-oracle';", "import { expectProgress } from './progress-oracle';\ntest.describe.configure({ mode: 'serial' });"), 'R7_J4_SERIAL'],
    ['verify route navigated in the no-Edge journey', `${J}/j4-learner-readback-certificate.spec.ts`, (s) => s.replace("await shot(page, info, 'J4d-certificate');", "await shot(page, info, 'J4d-certificate');\n  await page.goto(`/verify-certificate/${s.certificate.code}`);"), 'R8_VERIFY_NOT_DEFERRED'],
    ['expected post goes back to OBSERVED', `${S}/expected-journey-post.txt`, (s) => s.replace('completion_status=0', 'completion_status=<OBSERVED>'), 'R9_EXPECTED_UNPINNED'],
    ['expected post loses a notification', `${S}/expected-journey-post.txt`, (s) => s.replace(/^NOTIF user=e2e00000-0000-4000-8000-000000000002 .*\n/m, ''), 'R9_EXPECTED_EVENTS'],
    ['progress oracle sends its own request', `${J}/progress-oracle.ts`, (s) => s.replace('await page.goto(route.progress);', "await page.goto(route.progress);\n  await page.request.post('http://127.0.0.1:54321/rest/v1/content_item_progressions');"), 'R3_OWN_REQUEST'],
    ['witness gains an undeclared hash scope', `${S}/witness-journey.sql`, (s) => s + "\nselect 'HASH surprise ' || count(*) || ' ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.profiles t;\n", 'R10_HASH_INVENTORY'],
    ['comparator drops grade_history from its inventory', `${S}/tests/compare-witness.mjs`, (s) => s.replace("grade_history: 'counted', ", ''), 'R10_HASH_INVENTORY'],
    ['observer core sends its own request', `${J}/observe-core.mjs`, (s) => s + "\nexport const leak = () => fetch('http://127.0.0.1:54321/rest/v1/x');\n", 'R3_OWN_REQUEST'],
  ];
  ok('SC unmutated copy of the tree passes (mutants fail only by their own change)', mutate(`${S}/seed-journey.sql`, (x) => x).length === 0);
  for (const [name, rel, fn, rule] of cases) {
    const v = mutate(rel, fn);
    ok(`SC causal: ${name} -> ${rule}`, v.some((x) => x.startsWith(rule)));
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${fail === 0 ? 'PASS' : 'FAIL'} journey selftest: ${pass} ok, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
