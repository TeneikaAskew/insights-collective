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
import { assertPairingProof } from '../../../../e2e/gradebook-roles/journey/pairing-proof.mjs';
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
  const base = { version: 1, stack_id: sid, db_read: sid, api_read: sid, produced_before_seed: true };
  const G3 = (f, o = { sessionDir: sess }) => code(() => assertPairingProof(f, o));
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
  ok('G3 API read differs refused', G3(proof({ ...base, api_read: 'b'.repeat(32) })) === 'JOURNEY_GATE3_E_API_MISMATCH');
  ok('G3 DB read differs refused', G3(proof({ ...base, db_read: 'b'.repeat(32) })) === 'JOURNEY_GATE3_E_DB_MISMATCH');
  ok('G3 produced after seed refused', G3(proof({ ...base, produced_before_seed: false })) === 'JOURNEY_GATE3_E_ORDER');
  ok('G3 short stack id refused', G3(proof({ ...base, stack_id: 'abc', db_read: 'abc', api_read: 'abc' })) === 'JOURNEY_GATE3_E_STACK_ID');
  ok('G3 wrong version refused', G3(proof({ ...base, version: 2 })) === 'JOURNEY_GATE3_E_VERSION');
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
    ['gate 3 moved after sign-in', `${J}/session-setup.ts`, (s) => s.replace('  assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF, { sessionDir: dir });\n', '').replace("    if (res.status !== 200)", '    assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF, { sessionDir: dir });\n    if (res.status !== 200)'), 'R6_GATES_AFTER_SIGNIN'],
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
