// ABOUTME: Local fake/unit selftest for the journey proposal (no stack, no network, no browser): gate 1/2/3 checkers on temp
// ABOUTME: files, the witness comparator on fakes, pinned literals vs ids.ts, and the static contract (real PASS, mutants FAIL).
// Usage: node scripts/gradebook-fixture/journey/tests/journey-selftest.mjs   (exit 0 only if every case behaves)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync as execFileSyncRaw } from 'node:child_process';
// Every child's stderr is CAPTURED (piped onto the error object), never mirrored to this process's output; a call that
// sets its own stdio keeps it. The abort line below never prints captured output either.
const ABSENT12 = ['J0a', 'J0b', 'J1', 'J2a', 'J2b', 'J2c', 'J3a', 'J3b', 'J4a', 'J4b', 'J4c', 'J4d'].map((i) => `CASE ${i} status=ABSENT stage=NONE where=NONE line=0 cat=NONE obs=NONE errors=0 all=NONE attempts=0`).concat(['CASES known=0 unknown=0']).join('\n');
const execFileSync = (cmd, args, opts = {}) => execFileSyncRaw(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
import { assertPrivateSessionDir, assertPrivateDir, writePrivateFile, readPrivateJson } from '../../../../e2e/gradebook-roles/journey/private-dir.mjs';
import { compareWitness, DECLARED_HASHES } from './compare-witness.mjs';
import { createRecorder, evaluate, settled, runStateFailures, storageCategory, STORAGE_ERR_NAMES, STORAGE_MSG_NAMES } from '../../../../e2e/gradebook-roles/journey/observe-core.mjs';
import { EventEmitter } from 'node:events';
import { assertPairingProof, assertLivePairing, PAIRING_PREFIX } from '../../../../e2e/gradebook-roles/journey/pairing-proof.mjs';
import { producePairing, pinFailures, stackOwnershipFailures, servedAppFailures, HELPER_PINS, gitBlobId, D1_MODULE, EXPECTED_BOOTSTRAP_SHA256, SERVED_APP_VERIFIER, SEED_PASS, bootstrapFileSha256 } from '../pairing-producer.mjs';
import { planPsql, runPsql, includeScript } from '../private-psql.mjs';
import { playwrightSummary, compareSummary, shotsSummary, readRaw, GLOBAL_CODES, globalCode, FIXTURE_RANGES } from '../run-summary.mjs';
import { blockedCode, kindOf, classOf, entryClass, BLOCKED_CODE_RE, BLOCKED_PREFIX, KINDS, CLASSES, ROLES as B_ROLES, PHASES as B_PHASES } from '../../../../e2e/gradebook-roles/journey/blocked-class.mjs';
import { SHOT_NAMES, SHOT_PLAN, SHOT_GUARD, WITHHELD_REASONS, captureShot, decideShot, scanPage, shotSecrets, writeShot, mutationDiag, diagSuffix, DIAG_SUFFIX_RE } from '../../../../e2e/gradebook-roles/journey/shot-core.mjs';
import { exportShots, sanitizePng, crc32, readHandle as shotReadHandle } from '../shot-export.mjs';
import zlib from 'node:zlib';
import { checkJourney } from './static-contract.mjs';

const repo = process.cwd();
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`ok   ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };
const code = (fn) => { try { fn(); return 'ACCEPTED'; } catch (e) { return e && e.code ? e.code : 'UNCODED'; } };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jr-selftest-'));
// Fixed, safe failure-stage diagnostics: an uncaught error is reported as the section label (a literal from this file),
// the error's name and code mapped onto FIXED lists (anything else prints OTHER), and a bounded numeric exit status.
// Never its message, stack, stdout or stderr, and never a free-form name or code.
const ABORT_NAMES = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'AssertionError']);
const ABORT_CODES = new Set(['ENOENT', 'EACCES', 'EPERM', 'EEXIST', 'ENOTDIR', 'EISDIR', 'ELOOP', 'ENOTEMPTY', 'EAGAIN',
  'ETIMEDOUT', 'ENOBUFS', 'ERR_MODULE_NOT_FOUND', 'ERR_INVALID_ARG_TYPE', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER']);
let stage, aborted = null; // stage is set by the first statement inside try
try {
  // ---- Gate 1: private session dir ----
  stage = "Gate 1: private session dir";
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
  // CodeQL js/file-system-race (c18dd51 private-dir.mjs:63, run-summary.mjs:77): check and read now share ONE descriptor.
  { const real = fs.fstatSync, realL = fs.lstatSync;
    // Fixture files are created 0600 on one handle (exclusive, no follow); the swap is a rename over the checked path.
    const put600 = (file, body) => { const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      try { fs.fchmodSync(fd, 0o600); fs.writeSync(fd, body); } finally { fs.closeSync(fd); } };
    const swapAfter = (file, key, body) => { fs[key] = function (...a) { const r = (key === 'fstatSync' ? real : realL).apply(fs, a); fs[key] = key === 'fstatSync' ? real : realL;
      const t = `${file}.swap`; put600(t, body); fs.renameSync(t, file); return r; }; };
    const sp = path.join(good, 'swap.json'); put600(sp, '{"checked":true}');
    swapAfter(sp, 'fstatSync', '{"swapped":true}');
    let got; try { got = JSON.stringify(readPrivateJson(good, 'swap.json')); } finally { fs.fstatSync = real; }
    ok('RACE readPrivateJson: the file is replaced right after the check; the bytes returned are the checked file', got === '{"checked":true}');
    // Causal reference: the exact c18dd51 private-dir.mjs bytes (git blob 9aee287e), loaded from the object store into a
    // private temp dir, return the replacement under the same swap. No copy of the racy shape lives in this tree; without
    // the blob (a shallow clone) the reference is skipped and not counted.
    let oldMod = null;
    try { const src = execFileSync('git', ['cat-file', 'blob', '9aee287e0cac194a8872da1fc6c93feb9943082a'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const od = fs.mkdtempSync(path.join(tmp, 'c18-')); put600(path.join(od, 'private-dir.mjs'), src); oldMod = await import(path.join(od, 'private-dir.mjs')); } catch { oldMod = null; }
    if (oldMod) { fs.rmSync(sp); put600(sp, '{"checked":true}'); swapAfter(sp, 'lstatSync', '{"swapped":true}');
      let old; try { old = JSON.stringify(oldMod.readPrivateJson(good, 'swap.json')); } finally { fs.lstatSync = realL; }
      ok('RACE causal: the c18dd51 readPrivateJson bytes return the swapped file under the same swap', old === '{"swapped":true}'); }
    else console.log('skip RACE causal (c18dd51 blob 9aee287e not in this clone; not counted)');
    fs.symlinkSync(sp, path.join(good, 'link.json'));
    ok('RACE readPrivateJson: a symlink to a valid 0600 file is refused (O_NOFOLLOW)', code(() => readPrivateJson(good, 'link.json')) === 'JOURNEY_GATE1_E_STATE_MODE');
    execFileSync('mkfifo', [path.join(good, 'fifo.json')]); fs.chmodSync(path.join(good, 'fifo.json'), 0o600);
    ok('RACE readPrivateJson: a FIFO is refused without blocking', code(() => readPrivateJson(good, 'fifo.json')) === 'JOURNEY_GATE1_E_STATE_MODE');
    fs.mkdirSync(path.join(good, 'dir.json'), { mode: 0o700 });
    ok('RACE readPrivateJson: a directory is refused', code(() => readPrivateJson(good, 'dir.json')) === 'JOURNEY_GATE1_E_STATE_MODE');
    const rp = path.join(good, 'raw.txt'); put600(rp, 'checked raw\n');
    swapAfter(rp, 'fstatSync', 'swapped raw\n');
    let raw; try { raw = readRaw(rp); } finally { fs.fstatSync = real; }
    ok('RACE readRaw: the file is replaced right after the check; the text returned is the checked file', raw === 'checked raw\n');
    const RC = (f) => { try { readRaw(f); return 'ACCEPTED'; } catch (e) { return e.code; } };
    fs.symlinkSync(rp, path.join(good, 'raw-link.txt'));
    ok('RACE readRaw: symlink, FIFO, directory and missing file each refuse SUMMARY_E_RAW', [path.join(good, 'raw-link.txt'), path.join(good, 'fifo.json'), path.join(good, 'dir.json'), path.join(good, 'nope.txt')].every((f) => RC(f) === 'SUMMARY_E_RAW') && RC(rp) === 'ACCEPTED'); }

  // ---- Gate 2 (diagnostics dir uses the same private-dir check under its own code prefix) ----
  stage = "Gate 2 (diagnostics dir uses the same private-dir check under its own code prefix)";
  ok('G2 0755 diag dir refused with its own prefix', code(() => assertPrivateDir(wide, { repoRoot: repo, gate: 'JOURNEY_GATE2' })) === 'JOURNEY_GATE2_E_MODE');

  // ---- Gate 3: pairing proof consumer (shape and placement only; NOT trust) ----
  stage = "Gate 3: pairing proof consumer (shape and placement only; NOT trust)";
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
  stage = "Pinned literals in the expected post equal what ids.ts produces";
  // ids.ts is TypeScript. The job runs Node 20, which has no --experimental-strip-types (Node >= 22.6 only; run
  // 41458822962 aborted here with "bad option"), so it is loaded through the repo's pinned tsx loader on every Node.
  const lit = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--no-warnings', '-e',
    "import('./e2e/gradebook-roles/journey/ids.ts').then((m) => process.stdout.write(JSON.stringify({ size: m.UPLOAD.body().length, stored: m.STORED_FEEDBACK })))"], { cwd: repo, encoding: 'utf8' }));
  const expPost = fs.readFileSync(path.join(repo, 'scripts/gradebook-fixture/journey/expected-journey-post.txt'), 'utf8');
  const expBody = expPost.split('\n').filter((l) => !l.startsWith('#')).join('\n');
  const md5 = createHash('md5').update(lit.stored).digest('hex');
  ok(`LIT upload size ${lit.size} pinned on ATT and OBJ`, (expBody.match(new RegExp(`^(ATT|OBJ) .* size=${lit.size} `, 'gm')) || []).length === 2);
  ok('LIT feedback md5 pinned on SUB', expBody.includes(`comments_md5=${md5} `));

  // ---- Witness comparator on fakes: a faithful fake PASSES; each defect FAILS with its own code ----
  stage = "Witness comparator on fakes: a faithful fake PASSES; each defect FAILS with its own code";
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
  stage = "Observer core on a fake emitter (helper behaviour only; NOT journey executions)";
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

  // ---- Storage error category (run 41493619385 J2c: OBS_STATUS POST storage 400). DIAGNOSTIC ONLY, fixed names. ----
  stage = 'Storage error category (fixed names; body never echoed)';
  { const NONCE = 'n0nce'.repeat(6) + 'zz'; const SC = (b) => JSON.stringify(storageCategory(typeof b === 'string' ? b : JSON.stringify(b)));
    const RLSMSG = 'new row violates row-level security policy';
    ok('STCAT legacy RLS body (HTTP 400, body statusCode "403", error Unauthorized): UNAUTHORIZED / ABSENT / RLS / 403',
      SC({ statusCode: '403', error: 'Unauthorized', message: RLSMSG }) === '{"err":"UNAUTHORIZED","code":"ABSENT","msg":"RLS","status":"403"}');
    ok('STCAT newer body with code AccessDenied and a numeric statusCode', SC({ statusCode: 403, code: 'AccessDenied', error: 'Unauthorized', message: RLSMSG }) === '{"err":"UNAUTHORIZED","code":"ACCESS_DENIED","msg":"RLS","status":"403"}');
    ok('STCAT bucket missing, duplicate, MIME, size, JWT expired, invalid key each map to their fixed name',
      SC({ statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' }) === '{"err":"BUCKET_NOT_FOUND","code":"ABSENT","msg":"BUCKET_NOT_FOUND","status":"404"}'
      && SC({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }) === '{"err":"DUPLICATE","code":"ABSENT","msg":"DUPLICATE","status":"409"}'
      && SC({ statusCode: '415', error: 'invalid_mime_type', message: 'mime type not supported' }) === '{"err":"MIME_TYPE","code":"ABSENT","msg":"MIME_TYPE","status":"415"}'
      && SC({ statusCode: '413', error: 'Payload too large' }).includes('"err":"TOO_LARGE"') && SC({ statusCode: '400', error: 'InvalidJWT', message: 'jwt expired' }) === '{"err":"INVALID_JWT","code":"ABSENT","msg":"JWT_EXPIRED","status":"400"}'
      && SC({ error: 'InvalidKey', message: 'Invalid key' }) === '{"err":"INVALID_KEY","code":"ABSENT","msg":"INVALID_KEY","status":"NA"}');
    const hostile = [
      [{ statusCode: '403', error: `MARKER ${NONCE}`, message: `${RLSMSG} ${NONCE}` }, '{"err":"OTHER","code":"ABSENT","msg":"OTHER","status":"403"}'],
      [{ error: { toString: 'Unauthorized' }, message: ['new row violates row-level security policy'], statusCode: '4031' }, '{"err":"OTHER","code":"ABSENT","msg":"OTHER","status":"NA"}'],
      [JSON.parse('{"__proto__":{"error":"Unauthorized"},"constructor":"x"}'), '{"err":"ABSENT","code":"ABSENT","msg":"ABSENT","status":"NA"}'],
      [{ statusCode: '  403', error: 'unauthorized', message: 'New row violates row-level security policy' }, '{"err":"OTHER","code":"ABSENT","msg":"OTHER","status":"NA"}'],
      [`<html>${NONCE}</html>`, '{"err":"UNPARSEABLE","code":"NA","msg":"NA","status":"NA"}'],
      [JSON.stringify([{ error: 'Unauthorized' }]), '{"err":"SHAPE","code":"NA","msg":"NA","status":"NA"}'],
      ['null', '{"err":"SHAPE","code":"NA","msg":"NA","status":"NA"}'],
      [JSON.stringify({ error: 'Unauthorized', pad: 'x'.repeat(5000) }), '{"err":"OVERSIZE","code":"NA","msg":"NA","status":"NA"}'],
    ];
    ok('STCAT hostile bodies: near-miss strings, non-string values, inherited keys, bad statusCode, HTML, arrays, oversize all reduce to fixed names; no input text survives',
      hostile.every(([b, want]) => SC(b) === want) && !hostile.map(([b]) => SC(b)).join().includes(NONCE) && JSON.stringify(storageCategory(undefined)) === '{"err":"UNREADABLE","code":"NA","msg":"NA","status":"NA"}');
    ok('STCAT every name the category can produce is in the exported fixed lists (summary allowlists)',
      ['UNAUTHORIZED', 'ACCESS_DENIED', 'BUCKET_NOT_FOUND', 'NOT_FOUND', 'DUPLICATE', 'MIME_TYPE', 'TOO_LARGE', 'INVALID_KEY', 'INVALID_JWT', 'INVALID_REQUEST', 'DATABASE_ERROR', 'INTERNAL', 'GENERIC_ERROR', 'ABSENT', 'OTHER', 'NA', 'UNPARSEABLE', 'SHAPE', 'OVERSIZE', 'UNREADABLE'].every((n) => STORAGE_ERR_NAMES.includes(n))
      && ['RLS', 'JWT_EXPIRED', 'JWT_SIGNATURE', 'JWT_MALFORMED', 'BUCKET_NOT_FOUND', 'DUPLICATE', 'INVALID_KEY', 'MIME_TYPE', 'ABSENT', 'OTHER', 'NA'].every((n) => STORAGE_MSG_NAMES.includes(n)));
    // Recorder: only a Storage response with status >= 400 has its body read (once), and only the category is kept.
    const startB = (t, method, url, body) => { let reads = 0; const req = { url: () => url, method: () => method, _s: null, reads: () => reads,
      response: async () => (req._s === null ? null : { status: () => req._s, text: async () => { reads += 1; if (body instanceof Error) throw body; return body; } }) }; t.emit('request', req); return req; };
    const SUP = `${O}/storage/v1/object/course-documents/submissions/c/u/1-a.pdf`;
    const RLSBODY = JSON.stringify({ statusCode: '403', error: 'Unauthorized', message: RLSMSG });
    const STW = [{ spec: { method: 'POST', path: '/storage/v1/object/course-documents/submissions/' }, count: 1, status: [200] }];
    { const t = fakeTarget(); const rec = createRecorder(t); const r = startB(t, 'POST', SUP, RLSBODY); await finish(t, r, 400); rec.stop();
      const f = evaluate(rec.calls, STW, { origin: O }).failures;
      ok('STREC a Storage 400: OBS_STATUS then OBS_STORAGE with the fixed category; body read once; the raw body is not on the call',
        JSON.stringify(f) === JSON.stringify(['OBS_STATUS POST /storage/v1/object/course-documents/submissions/ 400', 'OBS_STORAGE UNAUTHORIZED ABSENT RLS 403']) && r.reads() === 1
        && !JSON.stringify(Object.fromEntries(Object.entries(rec.calls[0]).filter(([k]) => k !== 'req'))).includes(RLSMSG)); }
    { const t = fakeTarget(); const rec = createRecorder(t); const r = startB(t, 'POST', SUP, new Error('MARKER')); await finish(t, r, 400); rec.stop();
      ok('STREC a body that cannot be read: UNREADABLE, the call is still terminal with its status', rec.calls[0].done && rec.calls[0].status === 400 && JSON.stringify(evaluate(rec.calls, STW, { origin: O }).failures) === JSON.stringify(['OBS_STATUS POST /storage/v1/object/course-documents/submissions/ 400', 'OBS_STORAGE UNREADABLE NA NA NA'])); }
    { const t = fakeTarget(); const rec = createRecorder(t); const a = startB(t, 'POST', SUP, RLSBODY); await finish(t, a, 200); const b = startB(t, 'POST', `${O}/rest/v1/enrollments`, RLSBODY); await finish(t, b, 403); rec.stop();
      ok('STREC a 2xx Storage response and a non-Storage 4xx are never read; no OBS_STORAGE when the status is allowed', a.reads() === 0 && b.reads() === 0 && !rec.calls.some((c) => c.storage)
        && evaluate(rec.calls, STW, { origin: O }).failures.length === 0); }
    { const t = fakeTarget(); const rec = createRecorder(t); const r = startB(t, 'POST', SUP, RLSBODY); const pre = settled(rec.calls, STW, O); await finish(t, r, 400); rec.stop();
      ok('STREC the category is set before the call becomes terminal (settled waits for it)', pre === false && rec.calls[0].done && rec.calls[0].storage && rec.calls[0].storage.msg === 'RLS'); }
    // Bounded diagnostic settlement (review hold 18:15Z): the body read is raced against a fixed deadline.
    const defer = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
    const waitFor = async (fn, ms = 2000) => { const end = Date.now() + ms; while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 5)); return fn(); };
    const ERRS = ['OBS_STATUS POST /storage/v1/object/course-documents/submissions/ 400'];
    { const t = fakeTarget(); const rec = createRecorder(t, { storageReadMs: 40 }); const r = startB(t, 'POST', SUP, new Promise(() => {})); t.emit('requestfinished', (r._s = 400, r));
      const done = await waitFor(() => rec.calls[0].done); rec.stop();
      ok('STREC a 400 whose body never arrives: terminal after the fixed deadline with status 400 kept and category TIMEOUT; OBS_STATUS 400, never OBS_PENDING',
        done && rec.calls[0].status === 400 && JSON.stringify(evaluate(rec.calls, STW, { origin: O }).failures) === JSON.stringify([...ERRS, 'OBS_STORAGE TIMEOUT NA NA NA'])); }
    { const t = fakeTarget(); const rec = createRecorder(t, { storageReadMs: 40 }); const d = defer(); const r = startB(t, 'POST', SUP, d.p); t.emit('requestfinished', (r._s = 400, r));
      await waitFor(() => rec.calls[0].done); const frozen = JSON.stringify({ ...rec.calls[0], req: null }); d.res(RLSBODY); await new Promise((x) => setTimeout(x, 30));
      const after = JSON.stringify({ ...rec.calls[0], req: null }); rec.stop();
      ok('STREC a body that arrives AFTER the deadline changes nothing: category stays TIMEOUT, the call is byte-identical', frozen === after && rec.calls[0].storage.err === 'TIMEOUT'); }
    { const t = fakeTarget(); const rec = createRecorder(t, { storageReadMs: 40 }); const d = defer(); const r = startB(t, 'POST', SUP, d.p); t.emit('requestfinished', (r._s = 400, r));
      await waitFor(() => rec.calls[0].done); d.rej(new Error('MARKER')); await new Promise((x) => setTimeout(x, 30)); rec.stop();
      ok('STREC a read rejected after the deadline is also ignored (TIMEOUT kept)', rec.calls[0].storage.err === 'TIMEOUT'); }
    { const t = fakeTarget(); const rec = createRecorder(t, { storageReadMs: 1000 }); const d = defer(); const r = startB(t, 'POST', SUP, d.p); t.emit('requestfinished', (r._s = 400, r));
      await new Promise((x) => setTimeout(x, 10)); d.rej(new Error('MARKER')); await waitFor(() => rec.calls[0].done); rec.stop();
      ok('STREC a read rejected before the deadline: UNREADABLE, status 400 kept, terminal', rec.calls[0].done && rec.calls[0].status === 400 && rec.calls[0].storage.err === 'UNREADABLE'); }
    { const t = fakeTarget(); const rec = createRecorder(t, { storageReadMs: 60 }); const d = defer(); const r = startB(t, 'POST', SUP, d.p); t.emit('requestfinished', (r._s = 400, r));
      await new Promise((x) => setTimeout(x, 5)); rec.stop(); const frozen = JSON.stringify({ ...rec.calls[0], req: null }); d.res(RLSBODY); await new Promise((x) => setTimeout(x, 120));
      ok('STREC stop() while the read is pending: neither a late body nor the deadline mutates the recorded call afterwards', JSON.stringify({ ...rec.calls[0], req: null }) === frozen && rec.calls[0].storage === undefined); }
    { const euro = '€';
      const big = JSON.stringify({ statusCode: '403', error: 'Unauthorized', message: euro.repeat(2000) });   // 2000 UTF-16 units of text, about 6 KB of UTF-8
      const small = JSON.stringify({ statusCode: '403', error: 'Unauthorized', message: euro.repeat(1300) }); // under 4096 UTF-8 bytes
      ok('STCAT the 4096 bound is UTF-8 bytes after the read: multibyte text under 4096 UTF-16 units but over 4096 bytes is OVERSIZE; under the byte bound it parses',
        big.length < 4096 && new TextEncoder().encode(big).length > 4096 && JSON.stringify(storageCategory(big)) === '{"err":"OVERSIZE","code":"NA","msg":"NA","status":"NA"}'
        && new TextEncoder().encode(small).length <= 4096 && JSON.stringify(storageCategory(small)) === '{"err":"UNAUTHORIZED","code":"ABSENT","msg":"OTHER","status":"403"}'); }
    { const mk = (url) => { const t = fakeTarget(); const rec = createRecorder(t, { storageReadMs: 40 }); const resp = defer(); let reads = 0;
        const req = { url: () => url, method: () => 'POST', response: () => resp.p }; t.emit('request', req); t.emit('requestfinished', req); return { t, rec, resp, req, reads: () => reads, body: { status: () => 400, text: async () => { reads += 1; return RLSBODY; } } }; };
      const a = mk(SUP); await new Promise((x) => setTimeout(x, 5)); a.rec.stop(); const snapA = JSON.stringify({ ...a.rec.calls[0], req: null });
      a.resp.res(a.body); await new Promise((x) => setTimeout(x, 80));
      const b = mk(SUP); await new Promise((x) => setTimeout(x, 5)); b.rec.stop(); const snapB = JSON.stringify({ ...b.rec.calls[0], req: null });
      b.resp.rej(new Error('MARKER')); await new Promise((x) => setTimeout(x, 30));
      const c2 = mk(`${O}/rest/v1/enrollments`); await new Promise((x) => setTimeout(x, 5)); c2.rec.stop(); const snapC = JSON.stringify({ ...c2.rec.calls[0], req: null });
      c2.resp.res({ status: () => 201 }); await new Promise((x) => setTimeout(x, 30));
      ok('STREC delayed response then stop(): the late Storage 400 writes no status, starts no body read (0 reads) and leaves the pending snapshot unchanged',
        a.reads() === 0 && JSON.stringify({ ...a.rec.calls[0], req: null }) === snapA && a.rec.calls[0].status === null && a.rec.calls[0].done === false);
      ok('STREC delayed response that REJECTS after stop(): the catch path writes nothing either (snapshot unchanged)', JSON.stringify({ ...b.rec.calls[0], req: null }) === snapB);
      ok('STREC delayed non-Storage response after stop(): no status write, still pending', JSON.stringify({ ...c2.rec.calls[0], req: null }) === snapC && c2.rec.calls[0].done === false); }
    ok('STCAT TIMEOUT is in the exported fixed list', STORAGE_ERR_NAMES.includes('TIMEOUT')); }

  // ---- J0b course-read oracle (run 41486270908): OLD 69e5f4b one-reader oracle vs NEW three-reader + declared sibling ----
  stage = "J0b course-read oracle (run 41486270908): OLD 69e5f4b vs NEW";
  {
    const oldObsF = path.join(tmp, 'observe-core-69e5f4b.mjs');
    fs.writeFileSync(oldObsF, execFileSync('git', ['show', '69e5f4b64329d405661c2d95ec19b9c6f310ec0e:e2e/gradebook-roles/journey/observe-core.mjs'], { cwd: repo, encoding: 'utf8' }));
    const oldObs = await import(oldObsF);
    const DRAFT = '11111111-1111-4111-8111-111111111111', CTRL = '22222222-2222-4222-8222-222222222222';
    const SEL = 'select=*%2Cinstructor%3Aprofiles%21instructor_id%28id%2Cfirst_name%2Clast_name%2Cavatar_url%29';
    const draftUrl = `${O}/rest/v1/courses?${SEL}&id=eq.${DRAFT}`;
    const pubUrl = `${O}/rest/v1/courses?select=id%2Ctitle%2Cdescription&published=eq.true&order=created_at.desc`;
    const OLD_WANT = [{ spec: { method: 'GET', path: '/rest/v1/courses', query: { id: `eq.${DRAFT}` } }, count: 1, status: [406] }];
    const NEW_WANT = [{ spec: { method: 'GET', path: '/rest/v1/courses', query: { id: `eq.${DRAFT}` } }, count: 3, status: [406] },
      { spec: { method: 'GET', path: '/rest/v1/courses', query: { published: 'eq.true' } }, count: 1, status: [200] }];
    // The source-traced detail-route traffic: CourseDetail, CourseSidebar, ProfileMenu (3 identical draft reads, 406 each) and
    // SiteSearch's published list (200). Order interleaved as mounts would.
    const traffic = (o = {}) => async (t) => {
      const rs = [];
      const n = o.draftReads ?? 3;
      for (let i = 0; i < n; i++) rs.push([start(t, 'GET', o.draftUrl ?? draftUrl), (o.draftStatus ?? [])[i] ?? 406]);
      if (o.pub !== false) rs.push([start(t, 'GET', o.pubUrl ?? pubUrl), o.pubStatus ?? 200]);
      for (const u of o.extra ?? []) rs.push([start(t, 'GET', u), 200]);
      for (const [r, st] of rs) await finish(t, r, st);
    };
    const run = async (core, want, o) => { const t = fakeTarget(); const rec = core.createRecorder(t); await traffic(o)(t); rec.stop(); return core.evaluate(rec.calls, want, { origin: O }).failures; };
    const oldF = await run(oldObs, OLD_WANT, {});
    ok('J0B OLD 69e5f4b oracle on the traced traffic reproduces the run receipt exactly: NEAR_MISS GET courses + COUNT 3, no STATUS',
      JSON.stringify(oldF) === JSON.stringify(['OBS_NEAR_MISS GET /rest/v1/courses', 'OBS_COUNT GET /rest/v1/courses 3']));
    ok('J0B NEW core with the OLD one-reader spec still fails the same way (the core change alone fixes nothing)',
      JSON.stringify(await run({ createRecorder, evaluate }, OLD_WANT, {})) === JSON.stringify(oldF));
    ok('J0B OLD core with the NEW spec: the declared published read is still a near miss of the draft read (core change is needed)',
      JSON.stringify(await run(oldObs, NEW_WANT, {})) === JSON.stringify(['OBS_NEAR_MISS GET /rest/v1/courses', 'OBS_NEAR_MISS GET /rest/v1/courses']));
    const NEW = (o) => run({ createRecorder, evaluate }, NEW_WANT, o);
    ok('J0B NEW core + NEW spec on the traced traffic: pass', (await NEW({})).length === 0);
    const neg = async (name, o, want) => { const f = await NEW(o); ok(`J0B NEW negative: ${name}`, JSON.stringify(f) === JSON.stringify(want)); };
    await neg('2 draft reads (a reader missing) is OBS_COUNT 2', { draftReads: 2 }, ['OBS_COUNT GET /rest/v1/courses 2']);
    await neg('4 draft reads (an extra reader or a retry) is OBS_COUNT 4', { draftReads: 4 }, ['OBS_COUNT GET /rest/v1/courses 4']);
    await neg('one draft read answered 200 (draft visible) is OBS_STATUS 200', { draftStatus: [406, 200, 406] }, ['OBS_STATUS GET /rest/v1/courses 200']);
    await neg('published list absent is OBS_COUNT 0 on the sibling', { pub: false }, ['OBS_COUNT GET /rest/v1/courses 0']);
    await neg('published list answered 500 is OBS_STATUS on the sibling', { pubStatus: 500 }, ['OBS_STATUS GET /rest/v1/courses 500']);
    await neg('an undeclared courses read (control id) is still OBS_NEAR_MISS on BOTH expectations', { extra: [`${O}/rest/v1/courses?${SEL}&id=eq.${CTRL}`] }, ['OBS_NEAR_MISS GET /rest/v1/courses', 'OBS_NEAR_MISS GET /rest/v1/courses']);
    await neg('a published read with an extra filter key is a near miss of both, and the sibling count drops to 0',
      { pubUrl: `${O}/rest/v1/courses?select=id&published=eq.true&id=eq.${DRAFT}` }, ['OBS_NEAR_MISS GET /rest/v1/courses', 'OBS_NEAR_MISS GET /rest/v1/courses', 'OBS_COUNT GET /rest/v1/courses 0']);
    await neg('draft reads with an extra filter key (e.g. published=eq.false) are near misses, count 0',
      { draftUrl: `${O}/rest/v1/courses?${SEL}&id=eq.${DRAFT}&published=eq.false` }, ['OBS_NEAR_MISS GET /rest/v1/courses', 'OBS_COUNT GET /rest/v1/courses 0', 'OBS_NEAR_MISS GET /rest/v1/courses']);
    await neg('a draft read on a foreign origin is not counted (OBS_COUNT 2)', { extra: [`http://127.0.0.1:9999/rest/v1/courses?${SEL}&id=eq.${DRAFT}`], draftReads: 2 }, ['OBS_COUNT GET /rest/v1/courses 2']);
    // The traced contract, pinned to the checked-out app source: the course readers on /courses/:id and the published list.
    {
      const src = (f) => fs.readFileSync(path.join(repo, f), 'utf8');
      const cd = src('src/pages/CourseDetail.tsx'), ucd = src('src/hooks/useCourseData.ts'), sb = src('src/components/course/CourseSidebar.tsx');
      const pm = src('src/components/layout/ProfileMenu.tsx'), nav = src('src/components/layout/Navbar.tsx'), lay = src('src/components/course/CourseLayout.tsx');
      const ss = src('src/components/search/SiteSearch.tsx'), upc = src('src/hooks/usePublishedCourses.ts');
      const courseReads = (t) => (t.match(/\.from\('courses'\)/g) || []).length;
      ok('J0B source pins: CourseDetail reads the course once (.eq id, .single); useCourseData reads it once (.eq id, .single); CourseSidebar and ProfileMenu each call useCourseData once; CourseLayout renders Navbar and CourseSidebar once; Navbar renders ProfileMenu and SiteSearch once; SiteSearch reads only usePublishedCourses (published=eq.true)',
        courseReads(cd) === 1 && /from\('courses'\)[\s\S]{0,400}?\.eq\('id', courseId\)\s*\.single\(\)/.test(cd)
        && courseReads(ucd) === 1 && /from\('courses'\)[\s\S]{0,300}?\.eq\('id', courseId\)\s*\.single\(\)/.test(ucd)
        && (sb.match(/useCourseData\(/g) || []).length === 1 && courseReads(sb) === 0 && (pm.match(/useCourseData\(/g) || []).length === 1 && courseReads(pm) === 0
        && (lay.match(/<CourseSidebar \/>/g) || []).length === 1 && (lay.match(/<Navbar \/>/g) || []).length === 1
        && (nav.match(/<ProfileMenu \/>/g) || []).length === 1 && (nav.match(/<SiteSearch \/>/g) || []).length === 1
        && courseReads(ss) === 0 && (ss.match(/usePublishedCourses\(\)/g) || []).length === 1
        && courseReads(upc) === 1 && /\.eq\('published', true\)/.test(upc));
    }
    // A sibling declared in the set exempts ONLY its exact matches; a single-expectation set exempts nothing (unchanged).
    const t = fakeTarget(); const rec = createRecorder(t); await traffic({})(t); rec.stop();
    ok('J0B NEW core: with only the published expectation, the draft reads are near misses (no blanket exemption)',
      JSON.stringify(evaluate(rec.calls, [NEW_WANT[1]], { origin: O }).failures) === JSON.stringify(['OBS_NEAR_MISS GET /rest/v1/courses']));
  }

  // ---- J0b error-state locator (run 41490340024: J0b BODY SPEC getByText('Failed to load course') EXPECT_TO_BE_VISIBLE) ----
  // MODEL controls in jsdom (no browser): Playwright's getByText(substring) resolves to the smallest elements whose normalized
  // text contains the string (case-insensitive); toBeVisible is strict, so >1 element fails. This models that rule only; it is
  // not a Playwright execution and does not recover the run's actual DOM.
  stage = "J0b error-state locator (run 41490340024), jsdom model";
  {
    const { JSDOM } = await import('jsdom');
    const norm = (t) => t.replace(/\s+/g, ' ').trim();
    const byTextModel = (doc, text) => { const want = text.toLowerCase(); const hit = (el) => norm(el.textContent).toLowerCase().includes(want);
      return [...doc.body.querySelectorAll('*')].filter((el) => hit(el) && ![...el.children].some(hit)); };
    const roleOf = (el) => el.getAttribute('role') || (/^H[1-6]$/.test(el.tagName) ? 'heading' : '');
    const newModel = (doc) => [...doc.body.querySelectorAll('*')].filter((el) => roleOf(el) === 'alert'
      && [...el.querySelectorAll('*')].some((h) => roleOf(h) === 'heading' && norm(h.textContent) === 'Failed to load course'));
    const ALERT = '<div role="alert"><svg></svg><h5>Failed to load course</h5><div><span>JSON object requested, multiple (or no) rows returned</span><button>Retry</button></div></div>';
    const TOAST = (title, desc) => `<ol><li role="status"><div><div>${title}</div><div>${desc}</div></div><button>x</button></li></ol>`;
    const ANNOUNCE = (title, desc) => `<span role="status" style="position:absolute;width:1px;height:1px;clip:rect(0,0,0,0)">Notification ${title} ${desc}</span>`;
    const page = (body) => new JSDOM(`<!doctype html><body><nav>Courses</nav><main>${body}</main></body>`).window.document;
    const V = {
      detailToastLast: page(ALERT + TOAST('Failed to load course', 'JSON object requested') + ANNOUNCE('Failed to load course', 'JSON object requested')),
      detailToastAfterAnnounce: page(ALERT + TOAST('Failed to load course', 'JSON object requested')),
      sidebarToastLast: page(ALERT + TOAST('Error', 'There was a problem loading the course') + ANNOUNCE('Error', 'There was a problem loading the course')),
      noToast: page(ALERT),
    };
    ok('J0B-LOC OLD getByText model: ambiguous (strict-mode failure) when CourseDetail\'s toast is the one kept (3 with announce, 2 after it), unique when a sidebar/profile "Error" toast is kept or none',
      byTextModel(V.detailToastLast, 'Failed to load course').length === 3 && byTextModel(V.detailToastAfterAnnounce, 'Failed to load course').length === 2
      && byTextModel(V.sidebarToastLast, 'Failed to load course').length === 1 && byTextModel(V.noToast, 'Failed to load course').length === 1);
    ok('J0B-LOC NEW alert+heading model: exactly the error state in every toast order', Object.values(V).every((d) => newModel(d).length === 1 && newModel(d)[0].tagName === 'DIV'));
    ok('J0B-LOC NEW negative: toast present but the page error state NOT rendered -> 0 (fails)', newModel(page(TOAST('Failed to load course', 'x') + ANNOUNCE('Failed to load course', 'x'))).length === 0);
    ok('J0B-LOC NEW negative: error state with other copy ("Something went wrong") -> 0 (fails)', newModel(page(ALERT.replace('Failed to load course', 'Something went wrong'))).length === 0);
    ok('J0B-LOC NEW negative: heading text only partially equal ("Failed to load course details") -> 0 (exact)', newModel(page(ALERT.replace('Failed to load course<', 'Failed to load course details<'))).length === 0);
    ok('J0B-LOC NEW negative: the error state rendered twice -> 2 (strict fails)', newModel(page(ALERT + ALERT)).length === 2);
    // Source pins for the traced contract (app source as checked out).
    const src = (f) => fs.readFileSync(path.join(repo, f), 'utf8');
    const cd = src('src/pages/CourseDetail.tsx'), ucd = src('src/hooks/useCourseData.ts'), ut = src('src/hooks/use-toast.tsx');
    const ces = src('src/components/course/CourseErrorState.tsx'), al = src('src/components/ui/alert.tsx');
    const rt = fs.readFileSync(path.join(repo, 'node_modules/@radix-ui/react-toast/dist/index.mjs'), 'utf8');
    ok('J0B-LOC source pins: CourseDetail catch toasts "Failed to load course" AND its error branch renders CourseErrorState with that title; useCourseData toasts "Error"; TOAST_LIMIT 1; CourseErrorState is role=alert with AlertTitle; AlertTitle is h5; Radix toast role=status, 5s duration, 1s announce copy',
      /toast\(\{\s*title: "Failed to load course"/.test(cd) && /<CourseErrorState\s+title="Failed to load course"/.test(cd)
      && /toast\(\{\s*title: 'Error',\s*description: 'There was a problem loading the course'/.test(ucd)
      && /^const TOAST_LIMIT = 1$/m.test(ut) && /role="alert"/.test(ces) && /<AlertTitle>\{title\}<\/AlertTitle>/.test(ces)
      && /const AlertTitle[\s\S]{0,200}<h5/.test(al) && /role: "status"/.test(rt) && /duration = 5e3/.test(rt) && /setIsAnnounced\(true\), 1e3/.test(rt));
    const spec = src('e2e/gradebook-roles/journey/j0-learner-before-publish.spec.ts');
    ok('J0B-LOC spec: the error-state assertion is the alert+heading locator; no page-wide getByText(\'Failed to load course\') remains',
      spec.includes("page.getByRole('alert').filter({ has: page.getByRole('heading', { name: 'Failed to load course', exact: true }) })") && !spec.includes("getByText('Failed to load course')"));
  }

  // ---- Inherited-key controls (review r4 P2): OLD fcc606f accepted, NEW refuses ----
  stage = "Inherited-key controls (review r4 P2): OLD fcc606f accepted, NEW refuses";
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
  stage = "Run-state validation before persistence (review r3 item 2)";
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
  stage = "Gate 3 live recheck on a fake API (helper behaviour only; NOT a stack)";
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
  stage = "Pairing producer on a fake DSN + fake API (helper behaviour only; NOT a stack)";
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
  stage = "Shared helper pins and the D1 gate";
  // Shared files delivered outside this branch's base (D1 module + fake, served-app verifier + its import).
  const NOT_IN_BASE = ['scripts/e2e/stack-ownership.mjs', 'scripts/e2e/fixtures/stack-ownership.fake.json', 'scripts/served-app/served-app-check.mjs', 'scripts/served-app/hermetic-dist.mjs'];
  const D1_PATHS = NOT_IN_BASE.filter((x) => !fs.existsSync(path.join(repo, x)));
  const d1Present = fs.existsSync(path.join(repo, D1_MODULE));
  const absent = D1_PATHS.length;
  if (!absent) ok(`PIN real tree: all ${Object.keys(HELPER_PINS).length} shared files equal their agreed blobs`, pinFailures(repo).length === 0);
  else ok(`PIN real tree: present helpers pass and ONLY the ${absent} absent shared files refuse (BLOCKED until they are in the base)`, JSON.stringify(pinFailures(repo)) === JSON.stringify(D1_PATHS.map((x) => `RUN_E_PIN ${x}`)));
  ok('PIN gitBlobId equals git hash-object', gitBlobId(fs.readFileSync(path.join(repo, 'scripts/e2e/assert-safe-target.mjs'))) === execFileSync('git', ['hash-object', 'scripts/e2e/assert-safe-target.mjs'], { cwd: repo, encoding: 'utf8' }).trim());
  { const root = fs.mkdtempSync(path.join(tmp, 'pins-'));
    for (const rel of Object.keys(HELPER_PINS)) { if (!fs.existsSync(path.join(repo, rel))) continue; fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.copyFileSync(path.join(repo, rel), path.join(root, rel)); }
    ok('PIN unmodified copies of the present files pass them', pinFailures(root).every((x) => D1_PATHS.some((d) => x === `RUN_E_PIN ${d}`)) && pinFailures(root).length === absent);
    fs.appendFileSync(path.join(root, 'scripts/local-db/assert-local-dsn.mjs'), '\n');
    ok('PIN one changed byte in a shared helper refused', JSON.stringify(pinFailures(root).filter((x) => !D1_PATHS.some((d) => x === `RUN_E_PIN ${d}`))) === '["RUN_E_PIN scripts/local-db/assert-local-dsn.mjs"]');
    fs.rmSync(path.join(root, 'e2e/support/chromium-executable.ts'));
    ok('PIN missing helper refused', pinFailures(root).includes('RUN_E_PIN e2e/support/chromium-executable.ts')); }
  // ---- D1 consumer on a fake verifyRecord (the shared module's contract), plus this lane's handle checks ----
  stage = "D1 consumer on a fake verifyRecord (the shared module's contract), plus this lane's handle checks";
  const recDir = fs.mkdtempSync(path.join(tmp, 'so-')); fs.chmodSync(recDir, 0o700);
  const BOOT = '0'.repeat(64);
  const REC = { schema: 1, run_id: '1000000001', run_attempt: '1', pg_system_identifier: '7400000000000000001', api_origin: API, app_origin: 'http://127.0.0.1:4173', created_at: '2026-11-02T00:00:00.000Z', disposable: true, bootstrap_sha256: BOOT };
  const recFile = (obj = REC, mode = 0o600) => { const f = path.join(recDir, `rec-${Math.random().toString(16).slice(2)}.json`); fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj)); fs.chmodSync(f, mode); return f; };
  const fakeVerify = (res) => { const calls = []; const f = (file, a) => { calls.push({ file, a }); return typeof res === 'function' ? res(file, a) : res; }; f.calls = calls; return f; };
  const D1o = (over = {}) => ({ verifyRecord: fakeVerify({ ok: true, code: 'SO_OK', record: REC }), file: recFile(), runId: '1000000001', runAttempt: '1', liveSystemIdentifier: '7400000000000000001', apiOrigin: API, appOrigin: 'http://127.0.0.1:4173', expectedBootstrapSha256: BOOT, ...over });
  const D1 = (over) => JSON.stringify(stackOwnershipFailures(D1o(over)));
  { const o = D1o(); const r = stackOwnershipFailures(o);
    ok('D1 verified record for this run, cluster, origins and pinned bootstrap: accepted', r.length === 0);
    ok('D1 run id, attempt, LIVE identifier, bound origins and pinned bootstrap are passed to the shared verifier', o.verifyRecord.calls.length === 1 && JSON.stringify(o.verifyRecord.calls[0].a) === JSON.stringify({ runId: '1000000001', runAttempt: '1', liveSystemIdentifier: '7400000000000000001', apiOrigin: API, appOrigin: 'http://127.0.0.1:4173', expectedBootstrapSha256: BOOT })); }
  ok('D1 every shared refusal maps to its own fixed code', ['SO_ABSENT', 'SO_MODE', 'SO_SIZE', 'SO_PARSE', 'SO_SCHEMA', 'SO_RUN_MISMATCH', 'SO_ORIGIN_MISMATCH', 'SO_BOOTSTRAP_MISMATCH', 'SO_SYSID_MISMATCH', 'SO_INPUT'].every((c) => D1({ verifyRecord: fakeVerify({ ok: false, code: c, reason: 'x' }) }) === `["RUN_E_D1_${c}"]`));
  ok('D1 ok:true with a non-OK code, or an odd code, refused', D1({ verifyRecord: fakeVerify({ ok: true, code: 'SO_MODE', record: REC }) }) === '["RUN_E_D1_SO_MODE"]' && D1({ verifyRecord: fakeVerify({ ok: false, code: 'weird text' }) }) === '["RUN_E_D1_MODULE"]');
  ok('D1 record for another API or app origin refused (lane copy of the check)', D1({ file: recFile({ ...REC, api_origin: 'http://127.0.0.1:55555' }), verifyRecord: fakeVerify({ ok: true, code: 'SO_OK', record: { ...REC, api_origin: 'http://127.0.0.1:55555' } }) }) === '["RUN_E_D1_API_ORIGIN"]' && D1({ file: recFile({ ...REC, app_origin: 'http://127.0.0.1:5173' }), verifyRecord: fakeVerify({ ok: true, code: 'SO_OK', record: { ...REC, app_origin: 'http://127.0.0.1:5173' } }) }) === '["RUN_E_D1_APP_ORIGIN"]');
  ok('D1 no run attempt refused before any read', (() => { const o = D1o({ runAttempt: '' }); return JSON.stringify(stackOwnershipFailures(o)) === '["RUN_E_D1_NO_ATTEMPT"]' && o.verifyRecord.calls.length === 0; })());
  ok('D1 bootstrap identity not pinned (null): RUN_E_D1_BOOTSTRAP_UNPINNED before any read', (() => { const o = D1o({ expectedBootstrapSha256: null }); return JSON.stringify(stackOwnershipFailures(o)) === '["RUN_E_D1_BOOTSTRAP_UNPINNED"]' && o.verifyRecord.calls.length === 0; })());
  ok('D1 well-formed but different bootstrap digest refused even if the verifier says OK', D1({ expectedBootstrapSha256: 'a'.repeat(64) }) === '["RUN_E_D1_BOOTSTRAP_MISMATCH"]');
  ok('D1 the shared verifier returning a record other than the bytes read on the handle: RUN_E_D1_HANDLE_CHANGED', D1({ verifyRecord: fakeVerify({ ok: true, code: 'SO_OK', record: { ...REC, run_attempt: '2' } }) }) === '["RUN_E_D1_HANDLE_CHANGED"]');
  ok('D1 record file 0400 or 0640 refused on the handle', D1({ file: recFile(REC, 0o400) }) === '["RUN_E_D1_MODE_EXACT"]' && D1({ file: recFile(REC, 0o640) }) === '["RUN_E_D1_MODE_EXACT"]');
  ok('D1 record owned by another uid refused on the handle', D1({ uid: 999999 }) === '["RUN_E_D1_MODE_EXACT"]');
  ok('D1 missing or throwing verifier refused', D1({ verifyRecord: undefined }) === '["RUN_E_D1_MODULE"]' && D1({ verifyRecord: () => { throw new Error('x'); } }) === '["RUN_E_D1_MODULE"]');
  ok('D1 "disposable: true" alone is not accepted: a refused verify with disposable set still refuses', D1({ verifyRecord: fakeVerify({ ok: false, code: 'SO_SYSID_MISMATCH', record: REC }) }) === '["RUN_E_D1_SO_SYSID_MISMATCH"]');
  // Handle: real special files, then injected io for growth / read / close / stat errors.
  { const fifo = path.join(recDir, 'fifo'); execFileSync('mkfifo', ['-m', '600', fifo]);
    const t0 = Date.now(); const r = D1({ file: fifo });
    ok('HANDLE FIFO refused at once (non-blocking open, type on the handle), verifier never called', r === '["RUN_E_D1_HANDLE_TYPE"]' && Date.now() - t0 < 2000); }
  { const d = path.join(recDir, 'adir'); fs.mkdirSync(d, { mode: 0o700 }); ok('HANDLE directory refused', D1({ file: d }) === '["RUN_E_D1_HANDLE_TYPE"]'); }
  { const l = path.join(recDir, 'alink.json'); fs.symlinkSync(recFile(), l); ok('HANDLE symlink refused (no-follow open)', D1({ file: l }) === '["RUN_E_D1_HANDLE_OPEN"]'); }
  ok('HANDLE missing or relative path refused', D1({ file: path.join(recDir, 'none.json') }) === '["RUN_E_D1_HANDLE_OPEN"]' && D1({ file: 'rel.json' }) === '["RUN_E_D1_HANDLE_OPEN"]');
  ok('HANDLE oversize (5000 bytes) refused', D1({ file: recFile(JSON.stringify({ ...REC, pad: 'x'.repeat(5000) })) }) === '["RUN_E_D1_HANDLE_SIZE"]');
  ok('HANDLE unparsable bytes refused before the verifier', (() => { const o = D1o({ file: recFile('{not json') }); return JSON.stringify(stackOwnershipFailures(o)) === '["RUN_E_D1_HANDLE_PARSE"]' && o.verifyRecord.calls.length === 0; })());
  { const real = recFile();
    const io = (over) => ({ openSync: fs.openSync, fstatSync: fs.fstatSync, readSync: fs.readSync, closeSync: fs.closeSync, ...over });
    let closed = 0;
    const counting = (over) => io({ closeSync: (fd) => { closed++; fs.closeSync(fd); }, ...over });
    ok('HANDLE growth after fstat (more bytes than the stat size) refused, handle closed', (() => { closed = 0; const r = D1({ file: real, io: counting({ fstatSync: (fd) => { const s = fs.fstatSync(fd); return Object.assign(Object.create(Object.getPrototypeOf(s)), s, { size: s.size - 5 }); } }) }); return r === '["RUN_E_D1_HANDLE_GROWTH"]' && closed === 1; })());
    ok('HANDLE shrink (fewer bytes than the stat size) refused', D1({ file: real, io: counting({ fstatSync: (fd) => { const s = fs.fstatSync(fd); return Object.assign(Object.create(Object.getPrototypeOf(s)), s, { size: s.size + 5 }); } }) }) === '["RUN_E_D1_HANDLE_GROWTH"]');
    ok('HANDLE read error refused, handle closed', (() => { closed = 0; const r = D1({ file: real, io: counting({ readSync: () => { throw new Error('EIO MARKER'); } }) }); return r === '["RUN_E_D1_HANDLE_READ"]' && closed === 1; })());
    ok('HANDLE stat error refused, handle closed', (() => { closed = 0; const r = D1({ file: real, io: counting({ fstatSync: () => { throw new Error('x'); } }) }); return r === '["RUN_E_D1_HANDLE_STAT"]' && closed === 1; })());
    ok('HANDLE close error after a good read refused', D1({ file: real, io: io({ closeSync: (fd) => { fs.closeSync(fd); throw new Error('x'); } }) }) === '["RUN_E_D1_HANDLE_CLOSE"]');
    ok('HANDLE read loop is bounded (a never-ending reader stops at 4097 bytes)', (() => { const r = D1({ file: real, io: io({ fstatSync: (fd) => { const s = fs.fstatSync(fd); return Object.assign(Object.create(Object.getPrototypeOf(s)), s, { size: 4000 }); }, readSync: (_fd, buf, off, len) => { buf.fill(0x20, off, off + len); return len; } }) }); return r === '["RUN_E_D1_HANDLE_SIZE"]'; })()); }
  // With the REAL shared module (only when its pinned blob is in this tree).
  if (d1Present && pinFailures(repo).length === 0) {
    const { verifyRecord } = await import(path.join(repo, D1_MODULE));
    const fake = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/e2e/fixtures/stack-ownership.fake.json'), 'utf8'));
    const base = { verifyRecord, runId: fake.run_id, runAttempt: fake.run_attempt, liveSystemIdentifier: fake.pg_system_identifier, apiOrigin: fake.api_origin, appOrigin: fake.app_origin, expectedBootstrapSha256: fake.bootstrap_sha256 };
    const R = (over, recOver = {}, mode = 0o600) => JSON.stringify(stackOwnershipFailures({ ...base, file: recFile({ ...fake, ...recOver }, mode), ...over }));
    ok('D1REAL shared fake record verifies for its run, cluster and pinned bootstrap', R({}) === '[]');
    ok('D1REAL other live identifier: RUN_E_D1_SO_SYSID_MISMATCH', R({ liveSystemIdentifier: '7400000000000000002' }) === '["RUN_E_D1_SO_SYSID_MISMATCH"]');
    ok('D1REAL other run id or attempt: RUN_E_D1_SO_RUN_MISMATCH', R({ runId: '1000000002' }) === '["RUN_E_D1_SO_RUN_MISMATCH"]' && R({ runAttempt: '2' }) === '["RUN_E_D1_SO_RUN_MISMATCH"]');
    ok('D1REAL empty live read: RUN_E_D1_SO_INPUT, never a pass', R({ liveSystemIdentifier: '' }) === '["RUN_E_D1_SO_INPUT"]');
    ok('D1REAL record for other origins: RUN_E_D1_SO_ORIGIN_MISMATCH from the shared module', R({}, { api_origin: 'http://127.0.0.1:55555' }) === '["RUN_E_D1_SO_ORIGIN_MISMATCH"]' && R({}, { app_origin: 'http://127.0.0.1:5173' }) === '["RUN_E_D1_SO_ORIGIN_MISMATCH"]');
    ok('D1REAL other well-formed bootstrap digest: RUN_E_D1_SO_BOOTSTRAP_MISMATCH from the shared module', R({ expectedBootstrapSha256: 'b'.repeat(64) }) === '["RUN_E_D1_SO_BOOTSTRAP_MISMATCH"]');
    ok('D1REAL shared module itself refuses 0400, a missing attempt and a FIFO', verifyRecord(recFile(fake, 0o400), base).code === 'SO_MODE' && verifyRecord(recFile(fake), { ...base, runAttempt: '' }).code === 'SO_INPUT' && verifyRecord(path.join(recDir, 'fifo'), base).ok === false);
    ok('D1REAL disposable:false: RUN_E_D1_SO_SCHEMA', R({}, { disposable: false }) === '["RUN_E_D1_SO_SCHEMA"]');
    ok('D1REAL extra key: RUN_E_D1_SO_SCHEMA', R({}, { note: 'x' }) === '["RUN_E_D1_SO_SCHEMA"]');
    ok('D1REAL symlinked or absent record: refused on the lane handle', R({ file: path.join(recDir, 'alink.json') }) === '["RUN_E_D1_HANDLE_OPEN"]' && R({ file: path.join(recDir, 'none.json') }) === '["RUN_E_D1_HANDLE_OPEN"]');
  } else console.log('skip D1REAL (shared #154 module not in this tree; not counted)');

  // ---- Served-app gate (before the first write) ----
  stage = "Served-app gate (before the first write)";
  { const root = fs.mkdtempSync(path.join(tmp, 'app-')); fs.mkdirSync(path.join(root, 'v'), { recursive: true });
    const src = "export async function verifyServedApp({ appOrigin }) { return appOrigin === 'http://127.0.0.1:4173' ? { ok: true } : { ok: false }; }\n";
    fs.writeFileSync(path.join(root, 'v/app.mjs'), src);
    const blob = gitBlobId(Buffer.from(src));
    const A = (verifier, appOrigin = 'http://127.0.0.1:4173', importImpl) => servedAppFailures({ verifier, root, appOrigin, importImpl }).then((x) => JSON.stringify(x));
    ok('APP no verifier (null): RUN_E_APP_UNVERIFIED', await A(null) === '["RUN_E_APP_UNVERIFIED"]');
    ok('APP the real tree pins the shared verifier by blob; absent here, so RUN_E_APP_VERIFIER_PIN (never a pass)', SERVED_APP_VERIFIER.path === 'scripts/served-app/served-app-check.mjs' && Object.isFrozen(SERVED_APP_VERIFIER) && (fs.existsSync(path.join(repo, SERVED_APP_VERIFIER.path)) || await servedAppFailures({ verifier: SERVED_APP_VERIFIER, root: repo, appOrigin: 'http://127.0.0.1:4173' }).then((x) => JSON.stringify(x)) === '["RUN_E_APP_VERIFIER_PIN"]'));
    ok('APP pinned verifier says ok for this origin: accepted', await A({ path: 'v/app.mjs', blob }) === '[]');
    ok('APP pinned verifier says no: RUN_E_APP_UNVERIFIED', await A({ path: 'v/app.mjs', blob }, 'http://127.0.0.1:9999') === '["RUN_E_APP_UNVERIFIED"]');
    ok('APP verifier bytes differ from the pin: RUN_E_APP_VERIFIER_PIN', await A({ path: 'v/app.mjs', blob: 'f'.repeat(40) }) === '["RUN_E_APP_VERIFIER_PIN"]');
    ok('APP verifier throws or answers more than ok: refused', await A({ path: 'v/app.mjs', blob }, undefined, async () => ({ verifyServedApp: async () => { throw new Error('x'); } })) === '["RUN_E_APP_VERIFIER"]' && await A({ path: 'v/app.mjs', blob }, undefined, async () => ({ verifyServedApp: async () => ({ ok: true, why: 'x' }) })) === '["RUN_E_APP_UNVERIFIED"]');
    ok('GATES bootstrap digest is the reviewed constant and equals sha256 of the pinned bootstrap.sh in this tree; served-app verifier pinned in both places, with its import', EXPECTED_BOOTSTRAP_SHA256 === 'b41a9ed8d7b3207cb2ad4faf71ec8b7fd703a816d02ec0eb92c99a18af452715' && bootstrapFileSha256(repo) === EXPECTED_BOOTSTRAP_SHA256 && HELPER_PINS['scripts/local-stack/bootstrap.sh'] === gitBlobId(fs.readFileSync(path.join(repo, 'scripts/local-stack/bootstrap.sh'))) && HELPER_PINS[SERVED_APP_VERIFIER.path] === SERVED_APP_VERIFIER.blob && typeof HELPER_PINS['scripts/served-app/hermetic-dist.mjs'] === 'string'); }

  // ---- Password-free psql (planning on fakes; a fake psql binary; no database) ----
  stage = "Password-free psql (planning on fakes; a fake psql binary; no database)";
  const PW = 's3cr3t:PW\\x';
  const DSN = `postgresql://postgres:${encodeURIComponent(PW)}@127.0.0.1:54322/postgres`;
  const plan = planPsql(DSN, { SUPABASE_DB_URL: DSN, PGPASSWORD: 'zzz', PATH: '/bin' });
  ok('PSQL argv is -w with plain -h/-p/-U/-d and SQL on stdin', JSON.stringify(plan.argv) === JSON.stringify(['-X', '-q', '-At', '-w', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'postgres', '-f', '-']));
  ok('PSQL argv carries no password, no URI and no conninfo', !plan.argv.some((a) => a.includes('s3cr3t') || a.includes('postgresql') || a.includes('=') && a !== 'ON_ERROR_STOP=1'));
  ok('PSQL passfile line escapes ":" and "\\" exactly as libpq reads them', plan.passLine === '127.0.0.1:54322:postgres:postgres:s3cr3t\\:PW\\\\x\n');
  ok('PSQL child env drops SUPABASE_DB_URL and PGPASSWORD', !('SUPABASE_DB_URL' in plan.env) && !('PGPASSWORD' in plan.env) && plan.env.PATH === '/bin');
  ok('PSQL keyword DSN plans the same way', JSON.stringify(planPsql('host=127.0.0.1 port=54322 dbname=postgres user=postgres password=pw', {}).argv) === JSON.stringify(plan.argv));
  const PC = (d, env = {}) => { try { planPsql(d, env); return 'ACCEPTED'; } catch (e) { return e.code; } };
  ok('PSQL remote, multihost, hostaddr, socket-dir and PGHOST-overridden DSNs refused', PC(['postgresql://u', ':p@', 'db.example.com:5432/postgres'].join('')) === 'PSQL_E_DSN' && PC(['postgresql://u', ':p@', '127.0.0.1,remote:5432/postgres'].join('')) === 'PSQL_E_DSN' && PC('host=127.0.0.1 hostaddr=203.0.113.9 dbname=postgres') === 'PSQL_E_DSN' && PC('host=/tmp dbname=postgres user=postgres') === 'PSQL_E_DSN_SHAPE' && PC(DSN, { PGHOST: 'remote' }) === 'PSQL_E_DSN');
  ok('PSQL a database name psql would expand as conninfo is refused', PC(['postgresql://u', ':p@', '127.0.0.1:5432/a=b'].join('')) !== 'ACCEPTED');
  { const fb = fs.mkdtempSync(path.join(tmp, 'fpsql-')); const log = path.join(fb, 'log.jsonl');
    const bin = path.join(fb, 'psql');
    fs.writeFileSync(bin, `#!/usr/bin/env node\nconst fs=require('fs'),crypto=require('crypto');const i=fs.readFileSync(0,'utf8');const pf=process.env.PGPASSFILE;const st=pf?fs.lstatSync(pf):null;fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({argv:process.argv.slice(2),mode:st?(st.mode&0o777).toString(8):null,b64:pf?fs.readFileSync(pf).toString('base64'):null,pf,dsn:'SUPABASE_DB_URL' in process.env,input:i})+'\\n');process.stderr.write('MARKER-psql-STDERR\\n');process.stdout.write('ROW 1\\n');process.exit(i.includes('FAILME')?3:0);\n`);
    fs.chmodSync(bin, 0o755);
    const priv = fs.mkdtempSync(path.join(tmp, 'ppriv-')); fs.chmodSync(priv, 0o700);
    const lines = await runPsql({ script: 'select 1;\n', privDir: priv, env: { SUPABASE_DB_URL: DSN, PATH: process.env.PATH }, psqlBin: bin });
    const call = JSON.parse(fs.readFileSync(log, 'utf8').trim().split('\n')[0]);
    ok('PSQL runPsql returns stdout lines only', JSON.stringify(lines) === '["ROW 1"]');
    ok('PSQL passfile existed as 0600 in the private dir during the call, with exactly the planned line', call.mode === '600' && path.dirname(call.pf) === fs.realpathSync(priv) && typeof call.b64 === 'string' && Buffer.from(call.b64, 'base64').equals(Buffer.from(plan.passLine)));
    ok('PSQL passfile removed after the call; SQL went on stdin; no DSN in the child env', !fs.existsSync(call.pf) && call.input === 'select 1;\n' && call.dsn === false);
    ok('PSQL raw stderr lands only in the private 0600 log', fs.readFileSync(path.join(priv, 'psql-stderr.log'), 'utf8').includes('MARKER-psql-STDERR') && (fs.statSync(path.join(priv, 'psql-stderr.log')).mode & 0o777) === 0o600);
    let ec = 'ACCEPTED'; try { await runPsql({ script: 'FAILME', privDir: priv, env: { SUPABASE_DB_URL: DSN, PATH: process.env.PATH }, psqlBin: bin }); } catch (e) { ec = e.code; }
    ok('PSQL non-zero exit is a fixed code, passfile still removed', ec === 'PSQL_E_EXIT' && fs.readdirSync(priv).every((f) => !f.startsWith('pgpass-')));
    const open = fs.mkdtempSync(path.join(tmp, 'popen-')); fs.chmodSync(open, 0o755);
    let ec2 = 'ACCEPTED'; try { await runPsql({ script: 'x', privDir: open, env: { SUPABASE_DB_URL: DSN, PATH: process.env.PATH }, psqlBin: bin }); } catch (e) { ec2 = e.code; }
    ok('PSQL non-private dir refused before any spawn', ec2 === 'PSQL_E_PRIVATE_DIR');
    // Ambient credentials: libpq reads $PGPASSFILE when set, otherwise $HOME/.pgpass. This fake psql models exactly that
    // selection and records which file it would read, so a missing explicit passfile is visible.
    { const home = fs.mkdtempSync(path.join(tmp, 'home-')); fs.writeFileSync(path.join(home, '.pgpass'), '*:*:*:*:MARKER-AMBIENT-PGPASS\n', { mode: 0o600 });
      const slog = path.join(fb, 'select.jsonl');
      const sbin = path.join(fb, 'psql-select');
      fs.writeFileSync(sbin, `#!/usr/bin/env node\nconst fs=require('fs'),path=require('path');fs.readFileSync(0);const pf=process.env.PGPASSFILE||(process.env.HOME?path.join(process.env.HOME,'.pgpass'):null);let body=null;try{body=fs.readFileSync(pf,'utf8');}catch{}fs.appendFileSync(${JSON.stringify(slog)},JSON.stringify({pf,explicit:'PGPASSFILE' in process.env,body,home:process.env.HOME})+'\\n');process.exit(process.env.FAIL_SELECT==='1'?3:0);\n`);
      fs.chmodSync(sbin, 0o755);
      const NOPW = 'postgresql://postgres@127.0.0.1:54322/postgres';
      ok('PSQL passwordless DSN plans an EMPTY passfile line (not null)', planPsql(NOPW, {}).passLine === '');
      const sel = async (dsn, extra = {}) => { const d = fs.mkdtempSync(path.join(tmp, 'psel-')); fs.chmodSync(d, 0o700); fs.rmSync(slog, { force: true });
        let code = 'OK'; try { await runPsql({ script: 'select 1;\n', privDir: d, env: { SUPABASE_DB_URL: dsn, PATH: process.env.PATH, HOME: home, ...extra }, psqlBin: sbin }); } catch (e) { code = e.code; }
        return { code, call: JSON.parse(fs.readFileSync(slog, 'utf8').trim()), left: fs.readdirSync(d).filter((f) => f.startsWith('pgpass-')), d: fs.realpathSync(d) }; };
      for (const [label, dsn] of [['passwordless', NOPW], ['password-bearing', DSN]]) {
        const ok1 = await sel(dsn);
        ok(`PSQL ${label} DSN with HOME/.pgpass present: an explicit private passfile is selected, ~/.pgpass never chosen or read`, ok1.code === 'OK' && ok1.call.explicit && path.dirname(ok1.call.pf) === ok1.d && ok1.call.pf !== path.join(home, '.pgpass') && !String(ok1.call.body).includes('MARKER-AMBIENT') && ok1.call.body === (label === 'passwordless' ? '' : plan.passLine));
        ok(`PSQL ${label} DSN: private passfile removed after success`, ok1.left.length === 0);
        const bad = await sel(dsn, { FAIL_SELECT: '1' });
        ok(`PSQL ${label} DSN: on psql failure, fixed code, ~/.pgpass still never chosen, passfile removed`, bad.code === 'PSQL_E_EXIT' && bad.call.explicit && !String(bad.call.body).includes('MARKER-AMBIENT') && bad.left.length === 0);
        const ov = await sel(dsn, { PGPASSFILE: path.join(home, '.pgpass') });
        ok(`PSQL ${label} DSN: an ambient PGPASSFILE pointing at ~/.pgpass is overridden by the private one`, ov.code === 'OK' && path.dirname(ov.call.pf) === ov.d && !String(ov.call.body).includes('MARKER-AMBIENT')); }
      // Causal: the qualified 20fa2b4 bytes of this module, run the same way, DO select ~/.pgpass for a passwordless DSN.
      const old = fs.mkdtempSync(path.join(tmp, 'old20fa-'));
      fs.mkdirSync(path.join(old, 'scripts/gradebook-fixture/journey'), { recursive: true }); fs.mkdirSync(path.join(old, 'scripts/local-db'), { recursive: true });
      fs.copyFileSync(path.join(repo, 'scripts/local-db/assert-local-dsn.mjs'), path.join(old, 'scripts/local-db/assert-local-dsn.mjs'));
      fs.writeFileSync(path.join(old, 'scripts/gradebook-fixture/journey/private-psql.mjs'), execFileSync('git', ['show', '20fa2b447c883c6f6fae4374c461d8cb5c01f5c3:scripts/gradebook-fixture/journey/private-psql.mjs'], { cwd: repo }));
      const oldMod = await import(path.join(old, 'scripts/gradebook-fixture/journey/private-psql.mjs'));
      const od = fs.mkdtempSync(path.join(tmp, 'oldp-')); fs.chmodSync(od, 0o700); fs.rmSync(slog, { force: true });
      await oldMod.runPsql({ script: 'select 1;\n', privDir: od, env: { SUPABASE_DB_URL: NOPW, PATH: process.env.PATH, HOME: home }, psqlBin: sbin });
      const oc = JSON.parse(fs.readFileSync(slog, 'utf8').trim());
      ok('PSQL causal: the 20fa2b4 module with a passwordless DSN leaves PGPASSFILE unset, so ~/.pgpass (MARKER) is selected; this tree does not', !oc.explicit && oc.pf === path.join(home, '.pgpass') && String(oc.body).includes('MARKER-AMBIENT')); }
    ok('PSQL include script refuses a quoted or spaced path and a non-plain value', (() => { try { includeScript("/a b.sql"); return false; } catch { /* expected */ } try { includeScript('/a.sql', { pairing: "x' \\! id" }); return false; } catch { return true; } })()); }

  // ---- Fixed summaries ----
  stage = "Fixed summaries";
  const SUMC = (fn) => { try { fn(); return 'ACCEPTED'; } catch (e) { return e.code; } };
  ok('SUM playwright JSON becomes one count line; raw text never echoed', playwrightSummary(JSON.stringify({ stats: { expected: 11, unexpected: 1, flaky: 0, skipped: 0 }, errors: [{ message: 'MARKER secret http://x' }] }), '1') === `PLAYWRIGHT exit=1 expected=11 unexpected=1 flaky=0 skipped=0 global_errors=1\nGLOBAL first=OTHER where=NONE diag=NONE diag_class=NONE diags=0\n${ABSENT12}`);
  {
    // CASE r1: per-case fixed lines from a synthetic JSON report (the run 41479414128 shape plus hostile markers).
    const R0c = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
    const PROJ = { J0a: 'jr-0-learner-draft', J0b: 'jr-0-learner-draft', J1: 'jr-1-instructor-publish', J2a: 'jr-2-learner-submit', J2b: 'jr-2-learner-submit', J2c: 'jr-2-learner-submit', J3a: 'jr-3-instructor-grade', J3b: 'jr-3-instructor-grade', J4a: 'jr-4-learner-readback', J4b: 'jr-4-learner-readback', J4c: 'jr-4-learner-readback', J4d: 'jr-4-learner-readback' };
    const T = (id, status, errors = [], extra = {}) => ({ title: `${id} MARKER-title http://marker.invalid/x`, tests: [{ projectName: extra.project ?? PROJ[id], results: [{ status, errors }] }] });
    const loc = (f, line) => ({ file: `${R0c}/${f}`, line, column: 3 });
    const sum = (specs) => playwrightSummary(JSON.stringify({ stats: { expected: 1, unexpected: 1, flaky: 0, skipped: 10 }, errors: [], suites: [{ title: 'j0', specs: specs.slice(0, 2), suites: [{ title: 'inner', specs: specs.slice(2) }] }] }), '1', '', R0c).split('\n').slice(2);
    const ids = Object.keys(PROJ);
    const vis = { message: "Error: expect(locator).toBeVisible() failed\n\nLocator: getByRole('heading', { name: 'MARKER control' })\nExpected: visible\nTimeout: 5000ms", location: loc('e2e/gradebook-roles/journey/j0-learner-before-publish.spec.ts', 24) };
    const run1 = sum(ids.map((id) => (id === 'J0a' ? T(id, 'passed') : id === 'J0b' ? T(id, 'failed', [vis]) : T(id, 'skipped'))));
    ok('CASE the 41479414128 shape: J0a passed, J0b failed at its spec line with a fixed matcher class, 10 skipped; nothing echoed',
      run1[0] === 'CASE J0a status=PASSED stage=NONE where=NONE line=0 cat=NONE obs=NONE errors=0 all=NONE attempts=1' && run1[1] === 'CASE J0b status=FAILED stage=BODY where=SPEC line=24 cat=EXPECT_TO_BE_VISIBLE obs=NONE errors=1 all=BODY.SPEC.24.EXPECT_TO_BE_VISIBLE attempts=1'
      && run1.slice(2, 12).every((l, i) => l === `CASE ${ids[i + 2]} status=SKIPPED stage=NONE where=NONE line=0 cat=NONE obs=NONE errors=0 all=NONE attempts=1`) && run1[12] === 'CASES known=12 unknown=0' && run1.length === 13 && !run1.join('\n').includes('MARKER'));
    const obsErr = { message: 'Error: request-level expectations (fixed codes)\n\nexpect(received).toEqual(expected) // deep equality\n\n- Expected  - 0\n+ Received  + 4\n\n- Array []\n+ Array [\n+   "OBS_STATUS GET /rest/v1/courses 200",\n+   "OBS_COUNT POST /storage/v1/object/course-documents/MARKER-uid/1-x.pdf 0",\n+   "OBS_NEAR_MISS GET /rest/v1/MARKER_table",\n+   "OBS_MARKER GET /rest/v1/courses",\n+ ]', location: loc('e2e/gradebook-roles/journey/observe.ts', 46) };
    const run2 = sum([T('J0a', 'passed'), T('J0b', 'failed', [obsErr])]);
    ok('CASE an observe failure (custom message first): matcher found, OBS tokens as code:method:fixed path name:number; unknown path/code OTHER; nothing echoed',
      run2[1] === 'CASE J0b status=FAILED stage=BODY where=OBSERVE line=46 cat=EXPECT_TO_EQUAL obs=OBS_STATUS:GET:COURSES:200,OBS_COUNT:POST:STORAGE_COURSE_DOCUMENTS:0,OBS_NEAR_MISS:GET:OTHER,OTHER errors=1 all=BODY.OBSERVE.46.EXPECT_TO_EQUAL attempts=1' && !run2.join('\n').includes('MARKER'));
    // The J2c shape of run 41493619385 plus the new fixed Storage category line; hostile category fields reduce to OTHER.
    const stErr = { message: 'Error: request-level expectations (fixed codes)\n\nexpect(received).toEqual(expected) // deep equality\n\n+ Array [\n+   "OBS_STATUS POST /storage/v1/object/course-documents/submissions/MARKER/ 400",\n+   "OBS_STORAGE UNAUTHORIZED ABSENT RLS 403",\n+   "OBS_COUNT POST /rest/v1/assignment_submissions 0",\n+   "OBS_COUNT POST /rest/v1/submission_attachments 0",\n+   "OBS_COUNT POST /rest/v1/content_item_progressions 0",\n+ ]', location: loc('e2e/gradebook-roles/journey/observe.ts', 46) };
    const stHostile = { message: 'Error: request-level expectations (fixed codes)\n\nexpect(received).toEqual(expected) // deep equality\n\n+   "OBS_STORAGE MARKER_X UNAUTHORIZED RLS_NOPE 403",\n+   "OBS_STORAGE UNAUTHORIZED ABSENT RLS 4031",\n+   "OBS_STORAGE unauthorized ABSENT RLS 403",\n+ ]', location: loc('e2e/gradebook-roles/journey/observe.ts', 46) };
    const run3s = sum([T('J0a', 'passed'), T('J0b', 'failed', [stErr])]), run3h = sum([T('J0a', 'passed'), T('J0b', 'failed', [stHostile])]);
    ok('CASE storage: OBS_STORAGE:<err>:<code>:<msg>:<bodyStatus> follows the OBS_STATUS token, from fixed lists only; nothing echoed',
      run3s[1] === 'CASE J0b status=FAILED stage=BODY where=OBSERVE line=46 cat=EXPECT_TO_EQUAL obs=OBS_STATUS:POST:STORAGE_COURSE_DOCUMENTS:400,OBS_STORAGE:UNAUTHORIZED:ABSENT:RLS:403,OBS_COUNT:POST:ASSIGNMENT_SUBMISSIONS:0,OBS_COUNT:POST:SUBMISSION_ATTACHMENTS:0,OBS_COUNT:POST:CONTENT_ITEM_PROGRESSIONS:0 errors=1 all=BODY.OBSERVE.46.EXPECT_TO_EQUAL attempts=1' && !run3s.join('\n').includes('MARKER'));
    ok('CASE storage hostile: unknown names become OTHER; a non-grammar field (4-digit status, lower case) is not a token at all',
      run3h[1].includes('obs=OBS_STORAGE:OTHER:UNAUTHORIZED:OTHER:403 ') && !run3h.join('\n').includes('MARKER') && !run3h[1].includes('4031') && !run3h[1].includes('unauthorized'));
    const guardErr = { message: 'Error: requests to non-approved origins (each was blocked before it was sent)\n\nexpect(received).toEqual(expected) // deep equality\n\n+   Object {\n+     "kind": "image",\n+     "origin": "https://MARKER.example",', location: loc('e2e/gradebook-roles/guarded-test.ts', 11) };
    const conErr = { message: 'Error: Test "J0b MARKER" produced 2 console error(s):\n  • MARKER one\n  • expect(MARKER).toBe(\n\nexpect(received).toHaveLength(expected)\n\nExpected length: 0', location: loc('e2e/fixtures/console-errors.fixture.ts', 508) };
    const run3 = sum([T('J0a', 'failed', [guardErr, conErr]), T('J0b', 'failed', [conErr])]);
    ok('CASE fixture failures are named by fixture and source line (origin guard, console), first error classified, count kept; nothing echoed',
      run3[0] === 'CASE J0a status=FAILED stage=TEARDOWN where=FIXTURE_ORIGIN line=11 cat=EXPECT_TO_EQUAL obs=NONE errors=2 all=TEARDOWN.FIXTURE_ORIGIN.11.EXPECT_TO_EQUAL,TEARDOWN.FIXTURE_CONSOLE.508.EXPECT_TO_HAVE_LENGTH attempts=1' && run3[1] === 'CASE J0b status=FAILED stage=TEARDOWN where=FIXTURE_CONSOLE line=508 cat=EXPECT_TO_HAVE_LENGTH obs=NONE errors=1 all=TEARDOWN.FIXTURE_CONSOLE.508.EXPECT_TO_HAVE_LENGTH attempts=1' && !run3.join('\n').includes('MARKER'));
    const run4 = sum([T('J0a', 'timedOut', [{ message: 'Test timeout of 60000ms exceeded.' }]), T('J0b', 'failed', [{ message: 'Error: page.goto: net::ERR_CONNECTION_REFUSED at http://MARKER/', location: { file: '/elsewhere/MARKER.ts', line: 7 } }]),
      T('J1', 'failed', [{ message: 'MARKER free text', location: loc('e2e/gradebook-roles/journey/j1-instructor-publish.spec.ts', 'MARKER') }]), T('J2a', 'interrupted'), T('J2b', 'MARKER-status'),
      T('J3a', 'passed'), T('J3a', 'passed'), T('J9z', 'passed'), T('J4a', 'passed', [], { project: 'MARKER-project' }), { title: 'J4b x', tests: [{ projectName: PROJ.J4b }] }]);
    ok('CASE timeout, navigation, unknown file (line 0), non-integer line, interrupted, unknown status, duplicate, absent, unknown title/project counted; nothing echoed',
      run4[0] === 'CASE J0a status=TIMEDOUT stage=TIMEOUT where=NONE line=0 cat=TEST_TIMEOUT obs=NONE errors=1 all=TIMEOUT.NONE.0.TEST_TIMEOUT attempts=1' && run4[1] === 'CASE J0b status=FAILED stage=UNKNOWN where=OTHER line=0 cat=NAVIGATION obs=NONE errors=1 all=UNKNOWN.OTHER.0.NAVIGATION attempts=1'
      && run4[2] === 'CASE J1 status=FAILED stage=UNKNOWN where=SPEC line=0 cat=OTHER obs=NONE errors=1 all=UNKNOWN.SPEC.0.OTHER attempts=1' && run4[3] === 'CASE J2a status=INTERRUPTED stage=NONE where=NONE line=0 cat=NONE obs=NONE errors=0 all=NONE attempts=1'
      && run4[4] === 'CASE J2b status=OTHER stage=NONE where=NONE line=0 cat=NONE obs=NONE errors=0 all=NONE attempts=1' && run4[5] === 'CASE J2c status=ABSENT stage=NONE where=NONE line=0 cat=NONE obs=NONE errors=0 all=NONE attempts=0'
      && run4[6] === 'CASE J3a status=DUPLICATE stage=NONE where=NONE line=0 cat=NONE obs=NONE errors=0 all=NONE attempts=0' && run4[8] === 'CASE J4a status=ABSENT stage=NONE where=NONE line=0 cat=NONE obs=NONE errors=0 all=NONE attempts=0'
      && run4[9] === 'CASE J4b status=NORESULT stage=NONE where=NONE line=0 cat=NONE obs=NONE errors=0 all=NONE attempts=0' && run4[12] === 'CASES known=8 unknown=2' && !run4.join('\n').includes('MARKER'));
    ok('CASE a journey code is staged only when it is a listed code; a code-shaped unlisted value stages JOURNEY_CODE',
      sum([T('J0a', 'failed', [{ message: 'JourneyGateError: JOURNEY_SETUP_E_BINDING' }]), T('J0b', 'failed', [{ message: 'Error: JOURNEY_E_MARKER_SECRET' }])]).slice(0, 2).join('|') === 'CASE J0a status=FAILED stage=UNKNOWN where=NONE line=0 cat=JOURNEY_SETUP_E_BINDING obs=NONE errors=1 all=UNKNOWN.NONE.0.JOURNEY_SETUP_E_BINDING attempts=1|CASE J0b status=FAILED stage=UNKNOWN where=NONE line=0 cat=JOURNEY_CODE obs=NONE errors=1 all=UNKNOWN.NONE.0.JOURNEY_CODE attempts=1');
    // CAPTURE and body-then-teardown against the REAL J0 spec (root = this checkout): J0B_SHOT is J0b's shot() call, line 24 a body assertion.
    const RR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
    const sumR = (specs) => playwrightSummary(JSON.stringify({ stats: { expected: 0, unexpected: 2, flaky: 0, skipped: 10 }, errors: [], suites: [{ title: 'j0', specs }] }), '1', '', RR).split('\n').slice(2);
    const at = (f, line) => ({ file: path.join(RR, f), line, column: 3 });
    const J0S = 'e2e/gradebook-roles/journey/j0-learner-before-publish.spec.ts';
    // J0b's shot() call line, read from the checked-out spec (it moves when the spec body above it changes).
    const J0B_SHOT = fs.readFileSync(path.join(RR, J0S), 'utf8').split('\n').findIndex((l) => /await shot\(page, info, 'J0b-/.test(l)) + 1;
    const run5 = sumR([T('J0a', 'failed', [{ message: 'Error: SHOT_E_MARKER', location: at('e2e/gradebook-roles/journey/shot-core.mjs', 40) }]),
      T('J0b', 'failed', [{ message: 'Error: page.screenshot: Timeout 5000ms exceeded. MARKER', location: at(J0S, J0B_SHOT) }, { message: 'Error: x\n\nexpect(received).toEqual(expected) // MARKER', location: at('e2e/gradebook-roles/guarded-test.ts', 11) }]),
      T('J1', 'failed', [vis, vis, vis, vis, vis].map((e) => ({ ...e, location: at(J0S, 24) })))]);
    ok('CASE capture is named whether the error points at shot-core or at the spec line that calls shot(); a later teardown error is listed too; >4 errors marked MORE; nothing echoed',
      run5[0] === 'CASE J0a status=FAILED stage=CAPTURE where=SHOT line=40 cat=JOURNEY_CODE obs=NONE errors=1 all=CAPTURE.SHOT.40.JOURNEY_CODE attempts=1'
      && run5[1] === `CASE J0b status=FAILED stage=CAPTURE where=SPEC line=${J0B_SHOT} cat=ACTION_TIMEOUT obs=NONE errors=2 all=CAPTURE.SPEC.${J0B_SHOT}.ACTION_TIMEOUT,TEARDOWN.FIXTURE_ORIGIN.11.EXPECT_TO_EQUAL attempts=1`
      && run5[2] === `CASE J1 status=FAILED stage=BODY where=SPEC line=24 cat=EXPECT_TO_BE_VISIBLE obs=NONE errors=5 all=${Array(4).fill('BODY.SPEC.24.EXPECT_TO_BE_VISIBLE').join(',')},MORE attempts=1`
      && !run5.join('\n').includes('MARKER'));
    const run7 = sumR([T('J0a', 'failed', [{ message: 'Error: page.screenshot: Timeout 9ms exceeded.', location: at('e2e/gradebook-roles/journey/observe.ts', 120) }]),
      T('J0b', 'failed', [{ message: 'Error: x\n\nexpect(received).toEqual(expected)', location: at('e2e/gradebook-roles/journey/observe.ts', 46) }])]);
    ok('CASE observe.ts: a line inside the shot() wrapper is CAPTURE, a call-expectation line is BODY',
      run7[0] === 'CASE J0a status=FAILED stage=CAPTURE where=OBSERVE line=120 cat=ACTION_TIMEOUT obs=NONE errors=1 all=CAPTURE.OBSERVE.120.ACTION_TIMEOUT attempts=1'
      && run7[1] === 'CASE J0b status=FAILED stage=BODY where=OBSERVE line=46 cat=EXPECT_TO_EQUAL obs=NONE errors=1 all=BODY.OBSERVE.46.EXPECT_TO_EQUAL attempts=1');
    const run6 = sumR([T('J0b', 'failed', [{ message: 'Error: x', location: at(J0S, 9999) }])]);
    ok('CASE a spec line past the end of the file is stage UNKNOWN, never guessed', run6[1] === 'CASE J0b status=FAILED stage=UNKNOWN where=SPEC line=9999 cat=OTHER obs=NONE errors=1 all=UNKNOWN.SPEC.9999.OTHER attempts=1');
    // r2 (T 16:39): (1) explicit matcher allowlist, (2) own-key status lookup, (3) fixture stage only inside declared ranges.
    const m1 = (msg) => ({ message: msg, location: at(J0S, 24) });
    const run8 = sumR([T('J0a', 'failed', [m1('Error: x\n\nexpect(received).toSecretMarker(expected)'), m1('expect(locator).not.toSecretMarkerTwo(x)'), m1('expect(received).toString()')]),
      T('J0b', 'failed', [m1('expect(locator).not.toBeVisible()'), m1('expect(received).toHaveURL(x)')])]);
    ok('CASE r2 a matcher-shaped name outside the allowlist is OTHER in cat and all= (no name echoed); listed matchers keep their fixed category',
      run8[0] === 'CASE J0a status=FAILED stage=BODY where=SPEC line=24 cat=OTHER obs=NONE errors=3 all=BODY.SPEC.24.OTHER,BODY.SPEC.24.OTHER,BODY.SPEC.24.OTHER attempts=1'
      && run8[1] === 'CASE J0b status=FAILED stage=BODY where=SPEC line=24 cat=EXPECT_NOT_TO_BE_VISIBLE obs=NONE errors=2 all=BODY.SPEC.24.EXPECT_NOT_TO_BE_VISIBLE,BODY.SPEC.24.EXPECT_TO_HAVE_URL attempts=1'
      && !/SECRET|MARKER|STRING/.test(run8.join('\n')));
    const ST = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'PASSED'];
    const run9 = sumR(ST.map((st, i) => ({ title: `${['J0a', 'J0b', 'J1', 'J2a', 'J2b', 'J2c'][i]} x`, tests: [{ projectName: PROJ[['J0a', 'J0b', 'J1', 'J2a', 'J2b', 'J2c'][i]], results: [{ status: st, errors: [] }] }] }))
      .concat([{ title: 'J3a x', tests: [{ projectName: PROJ.J3a, results: [{ status: { toString: () => 'passed' }, errors: [] }] }] }]));
    ok('CASE r2 inherited names (constructor, __proto__, toString, hasOwnProperty, valueOf), a non-reporter value and a non-string status are OTHER',
      run9.slice(0, 7).every((l) => / status=OTHER stage=NONE /.test(l)) && run9.length === 13);
    const fx = (where, f, line) => sumR([T('J0a', 'failed', [{ message: 'expect(received).toEqual(expected)', location: line === undefined ? { file: path.join(RR, f) } : at(f, line) }])])[0].split(' ')[3];
    const GT = 'e2e/gradebook-roles/guarded-test.ts', CF = 'e2e/fixtures/console-errors.fixture.ts';
    ok('CASE r2 origin guard: line 9 (install, before use) SETUP, 10 (use) UNKNOWN, 11 (post-use assertion) TEARDOWN, 12/past EOF/missing UNKNOWN',
      [9, 10, 11, 12, 99999, undefined].map((n) => fx('FIXTURE_ORIGIN', GT, n)).join(',') === 'stage=SETUP,stage=UNKNOWN,stage=TEARDOWN,stage=UNKNOWN,stage=UNKNOWN,stage=UNKNOWN');
    ok('CASE r2 console fixture: pre-use SETUP, use() line UNKNOWN, each post-use assertion statement TEARDOWN, other post-use lines and missing UNKNOWN',
      [381, 440, 461, 462, 463, 466, 470, 476, 480, 493, 500, 508, 511, 513, 380, undefined].map((n) => fx('FIXTURE_CONSOLE', CF, n)).join(',')
        === 'stage=SETUP,stage=SETUP,stage=SETUP,stage=UNKNOWN,stage=UNKNOWN,stage=UNKNOWN,stage=TEARDOWN,stage=TEARDOWN,stage=UNKNOWN,stage=TEARDOWN,stage=TEARDOWN,stage=TEARDOWN,stage=TEARDOWN,stage=UNKNOWN,stage=UNKNOWN,stage=UNKNOWN');
    {
      const src = (f) => fs.readFileSync(path.join(RR, f), 'utf8').split('\n');
      const g = src(GT), c = src(CF);
      const R = FIXTURE_RANGES;
      ok('CASE r2 declared fixture ranges are pinned to the checked-out source (install 9, use 10, assert 11; console start, use, each expect( ... ).toHaveLength(0); statement)',
        /installOriginGuard\(/.test(g[8]) && /^\s*await use\(blocked\);$/.test(g[9]) && /^\s*expect\(blocked,/.test(g[10]) && R.FIXTURE_ORIGIN.SETUP[0][0] === 8 && /originGuard: \[async/.test(g[7])
        && /async \(\{ page \}, use, testInfo\) => \{$/.test(c[R.FIXTURE_CONSOLE.SETUP[0][0] - 1]) && /^\s*await use\(errors\);$/.test(c[R.FIXTURE_CONSOLE.SETUP[0][1]])
        && c.filter((l) => /\buse\(/.test(l)).length === 1
        && R.FIXTURE_CONSOLE.TEARDOWN.every(([a, b]) => c[a - 1].trim() === 'expect(' && c[b - 1].trim() === ').toHaveLength(0);')
        && R.FIXTURE_CONSOLE.TEARDOWN.length === c.filter((l) => l.trim() === ').toHaveLength(0);').length);
    }
    const run10 = sumR([{ title: 'J0a x', tests: [{ projectName: PROJ.J0a, results: [{ status: 'failed', errors: [vis] }, { status: 'passed', errors: [] }] }] }]);
    ok('CASE r2 the LAST attempt is labelled (never an aggregate); attempts counts results', run10[0] === 'CASE J0a status=PASSED stage=NONE where=NONE line=0 cat=NONE obs=NONE errors=0 all=NONE attempts=2');
    const all = [run1, run2, run3, run4, run5, run6, run7, run8, run9, run10].flat();
    ok('CASE every staged line matches the fixed grammar', all.every((l) => /^(?:CASE J[0-4][a-d]? status=[A-Z]+ stage=(?:NONE|BODY|CAPTURE|TEARDOWN|TIMEOUT|UNKNOWN) where=[A-Z_]+ line=\d{1,4} cat=[A-Z_]+ obs=(?:NONE|(?:[A-Z_]+(?::[A-Z_0-9]+)*)(?:,[A-Z_]+(?::[A-Z_0-9]+)*)*) errors=\d{1,2} all=(?:NONE|[A-Z]+\.[A-Z_]+\.\d{1,4}\.[A-Z_]+(?:,[A-Z]+\.[A-Z_]+\.\d{1,4}\.[A-Z_]+){0,3}(?:,MORE)?) attempts=\d|CASES known=\d+ unknown=\d+)$/.test(l)));
  }
  { // Global-error classification: fixed code/place/class lists only; message, stack, path and diag message never echoed.
    const R0 = '/r00t';
    const rep = (errors, diag = '') => playwrightSummary(JSON.stringify({ stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 }, errors }), '1', diag, R0).split('\n')[1];
    const setupLoc = { file: `${R0}/e2e/gradebook-roles/journey/session-setup.ts`, line: 1, column: 1 };
    ok('SUMG a setup gate code at session-setup.ts is staged as that code, place SETUP', rep([{ message: 'JourneyGateError: JOURNEY_SETUP_E_SIGNIN_HTTP_400_INSTRUCTOR\nMARKER-stack', stack: 'MARKER', location: setupLoc }]) === 'GLOBAL first=JOURNEY_SETUP_E_SIGNIN_HTTP_400_INSTRUCTOR where=SETUP diag=NONE diag_class=NONE diags=0');
    ok('SUMG a gate code thrown in private-dir.mjs or pairing-proof.mjs is place SETUP', rep([{ message: 'JourneyGateError: JOURNEY_GATE1_E_NOT_EMPTY', location: { file: `${R0}/e2e/gradebook-roles/journey/private-dir.mjs` } }]) === 'GLOBAL first=JOURNEY_GATE1_E_NOT_EMPTY where=SETUP diag=NONE diag_class=NONE diags=0' && rep([{ message: 'JourneyGateError: JOURNEY_GATE3_E_LIVE_STATUS', location: { file: `${R0}/e2e/gradebook-roles/journey/pairing-proof.mjs` } }]).startsWith('GLOBAL first=JOURNEY_GATE3_E_LIVE_STATUS where=SETUP '));
    ok('SUMG a spec load error is place SPEC, code OTHER (its message is not staged)', rep([{ message: "Error: Cannot find module 'MARKER'", location: { file: `${R0}/e2e/gradebook-roles/journey/j2-learner-enroll-submit.spec.ts` } }]) === 'GLOBAL first=OTHER where=SPEC diag=NONE diag_class=NONE diags=0');
    ok('SUMG config place, no location, foreign path', rep([{ message: 'x', location: { file: `${R0}/playwright.gradebook-roles.config.ts` } }]).includes(' where=CONFIG ') && rep([{ message: 'x' }]).includes(' where=NONE ') && rep([{ message: 'x', location: { file: '/tmp/MARKER/session-setup.ts' } }]).includes(' where=OTHER '));
    ok('SUMG a code-shaped but unlisted value, a marker after the code, a lower-case or non-gate name all stage OTHER', ['JourneyGateError: JOURNEY_SETUP_E_MARKER', 'JourneyGateError: JOURNEY_SETUP_E_BINDING MARKER', 'JourneyGateError: journey_setup_e_binding', 'Error: JOURNEY_SETUP_E_BINDING', 'JourneyGateError: JOURNEY_SETUP_E_SIGNIN_HTTP_999_INSTRUCTOR', 'JourneyGateError: JOURNEY_SETUP_E_GOTO_ADMIN'].every((m) => rep([{ message: m, location: setupLoc }]) === 'GLOBAL first=OTHER where=SETUP diag=NONE diag_class=NONE diags=0'));
    ok('SUMG no errors is NONE/NONE; only the FIRST error is classified', rep([]) === 'GLOBAL first=NONE where=NONE diag=NONE diag_class=NONE diags=0' && rep([{ message: 'JourneyGateError: JOURNEY_SETUP_E_BINDING', location: setupLoc }, { message: 'JourneyGateError: JOURNEY_GATE1_E_MODE' }]).startsWith('GLOBAL first=JOURNEY_SETUP_E_BINDING '));
    const dd = fs.mkdtempSync(path.join(tmp, 'diag-')); fs.chmodSync(dd, 0o700);
    fs.writeFileSync(path.join(dd, 'diag-001.json'), JSON.stringify({ code: 'JOURNEY_SETUP_E_GOTO_MEMBER', name: 'TimeoutError', message: 'MARKER-diag http://x' }), { mode: 0o600 });
    fs.writeFileSync(path.join(dd, 'diag-002.json'), JSON.stringify({ code: 'JOURNEY_SETUP_E_BROWSER_CLOSE_MEMBER', name: 'Error', message: 'MARKER' }), { mode: 0o600 });
    const withDiag = rep([{ message: 'JourneyGateError: JOURNEY_SETUP_E_GOTO_MEMBER', location: setupLoc }], dd);
    ok('SUMG first diag record: its fixed stage code and class only, message never read out; count of records', withDiag === 'GLOBAL first=JOURNEY_SETUP_E_GOTO_MEMBER where=SETUP diag=JOURNEY_SETUP_E_GOTO_MEMBER diag_class=TimeoutError diags=2' && !withDiag.includes('MARKER'));
    fs.writeFileSync(path.join(dd, 'diag-001.json'), JSON.stringify({ code: 'JOURNEY_SETUP_E_MARKER', name: 'MARKER Error', message: 'x' }));
    ok('SUMG a diag record with an unlisted code or class stages OTHER for each', rep([], dd) === 'GLOBAL first=NONE where=NONE diag=OTHER diag_class=OTHER diags=2');
    fs.writeFileSync(path.join(dd, 'MARKER.txt'), 'x');
    ok('SUMG a stray name in the diag dir, or an unreadable dir, stages OTHER (never a name)', rep([], dd) === 'GLOBAL first=NONE where=NONE diag=OTHER diag_class=OTHER diags=3' && rep([], path.join(dd, 'none')) === 'GLOBAL first=NONE where=NONE diag=OTHER diag_class=OTHER diags=0');
    // Completeness: every code the setup chain can throw or record is in the fixed list (templates expanded).
    const src = ['e2e/gradebook-roles/journey/session-setup.ts', 'e2e/gradebook-roles/journey/private-dir.mjs', 'e2e/gradebook-roles/journey/pairing-proof.mjs'].map((f) => fs.readFileSync(path.join(repo, f), 'utf8')).join('\n');
    const thrown = new Set();
    for (const m of src.matchAll(/['`](JOURNEY_(?:SETUP|GATE[0-9])_E_[A-Z0-9_]*(?:\$\{[^}]+\}[A-Z0-9_]*)*)['`]/g)) {
      for (const r of ['INSTRUCTOR', 'MEMBER']) thrown.add(m[1].replace(/\$\{R\}/g, r).replace(/\$\{res\.status\}/g, '401'));
    }
    for (const m of src.matchAll(/`\$\{g\}_E_([A-Z_]+)`/g)) for (const g of ['JOURNEY_GATE1', 'JOURNEY_GATE2']) thrown.add(`${g}_E_${m[1]}`);
    const missing = [...thrown].filter((c) => globalCode(c) !== c);
    ok(`SUMG every one of the ${thrown.size} codes thrown or recorded by the setup chain is staged as itself (none falls to OTHER)`, thrown.size > 60 && missing.length === 0);
    ok('SUMG the fixed list holds only upper-case gate codes', [...GLOBAL_CODES].every((c) => /^JOURNEY_(?:SETUP|GATE[123])_E_[A-Z0-9_]+$/.test(c)));
    ok('SUMG session-setup.ts never writes to stdout (the JSON report shares it)', !/process\.stdout|console\.(log|info|debug|table|dir)\(/.test(fs.readFileSync(path.join(repo, 'e2e/gradebook-roles/journey/session-setup.ts'), 'utf8')));
  }
  { // Blocked-list classification (blocked-class.mjs): fixed enums only; hostile markers never leave; non-foreign kept apart.
    const AP = ['http://127.0.0.1:8080', 'http://127.0.0.1:54321'];
    const code = (blocked, role = 'INSTRUCTOR', phase = 'SETTLE') => blockedCode({ role, phase, blocked, approved: AP });
    const P = `${BLOCKED_PREFIX}_INSTRUCTOR_SETTLE_`;
    ok('BLK a listed host: image from pravatar.cc', code([{ origin: 'https://i.pravatar.cc', kind: 'image' }]) === `${P}IMAGE_PRAVATAR_N1`);
    ok('BLK hostile markers in host, subdomain trick, port, path, query, userinfo and kind never leave (fixed values only)', (() => {
      const cases = [
        [{ origin: 'https://MARKER-secret.example', kind: 'script' }, `${P}SCRIPT_PUBLIC_OTHER_N1`],
        [{ origin: 'https://fonts.googleapis.com.MARKER.example', kind: 'stylesheet' }, `${P}STYLESHEET_PUBLIC_OTHER_N1`],
        [{ origin: 'https://xgooglefonts.googleapis.com', kind: 'font' }, `${P}FONT_PUBLIC_OTHER_N1`],
        [{ origin: 'https://MARKER:pw@fonts.gstatic.com:8443/MARKER?token=MARKER#MARKER', kind: 'font' }, `${P}FONT_FONTS_GSTATIC_N1`],
        [{ origin: 'https://db.MARKERREF.supabase.co', kind: 'fetch' }, `${P}FETCH_SUPABASE_CO_N1`],
        [{ origin: 'https://www.googletagmanager.com', kind: 'MARKER kind' }, `${P}OTHER_GOOGLETAGMANAGER_N1`],
        [{ origin: 'https://cdn.gpteng.co', kind: 'script-redirect' }, `${P}SCRIPT_REDIRECT_GPTENG_N1`],
        [{ origin: 'https://evil.example', kind: 'websocket' }, `${P}WEBSOCKET_PUBLIC_OTHER_N1`],
        [{ origin: 'ftp://MARKER.example', kind: 'other' }, `${P}OTHER_NON_HTTP_SCHEME_N1`],
      ];
      return cases.every(([e, want]) => { const c = code([e]); return c === want && !/MARKER|secret|token|8443|pw/i.test(c); });
    })());
    ok('BLK loopback under another spelling or port is not "foreign": LOOPBACK_OTHER_SPELLING / LOOPBACK_OTHER_PORT', code([{ origin: 'http://localhost:54321', kind: 'fetch' }]) === `${P}FETCH_LOOPBACK_OTHER_SPELLING_N1` && code([{ origin: 'http://127.0.0.1:9999', kind: 'xhr' }]) === `${P}XHR_LOOPBACK_OTHER_PORT_N1` && code([{ origin: 'http://[::1]:8080', kind: 'document' }]) === `${P}DOCUMENT_LOOPBACK_OTHER_SPELLING_N1`);
    ok('BLK the three non-foreign guard records keep their own kind and never get a host class', code([{ origin: 'redirect-unresolvable', kind: 'document' }]) === `${P}REDIRECT_UNRESOLVABLE_NONE_N1` && code([{ origin: 'unparseable', kind: 'image' }]) === `${P}UNPARSEABLE_NONE_N1` && code([{ origin: 'http://127.0.0.1:54321', kind: 'redirect-on-POST' }]) === `${P}REDIRECT_ON_WRITE_APP_OR_API_N1` && code([{ origin: 'https://MARKER.example', kind: 'redirect-on-PATCH' }]) === `${P}REDIRECT_ON_WRITE_APP_OR_API_N1`);
    ok('BLK only the FIRST entry is classified; count is bounded N1..N9', code([{ origin: 'https://www.youtube.com', kind: 'media' }, { origin: 'https://i.pravatar.cc', kind: 'image' }]) === `${P}MEDIA_YOUTUBE_N2` && code(Array.from({ length: 40 }, () => ({ origin: 'https://vimeo.com', kind: 'document' }))) === `${P}DOCUMENT_VIMEO_N9`);
    ok('BLK role and phase are fixed enums; anything else, an empty list, or malformed input gives the bare code, never a throw', code([{ origin: 'https://x.example', kind: 'image' }], 'MEMBER', 'GOTO') === `${BLOCKED_PREFIX}_MEMBER_GOTO_IMAGE_PUBLIC_OTHER_N1` && code([{ origin: 'https://x.example', kind: 'image' }], 'MARKER', 'SETTLE') === BLOCKED_PREFIX && code([{ origin: 'https://x.example', kind: 'image' }], 'MEMBER', 'MARKER') === BLOCKED_PREFIX && code([]) === BLOCKED_PREFIX && blockedCode({}) === BLOCKED_PREFIX && blockedCode(null) === BLOCKED_PREFIX && code([null]) === `${P}OTHER_NONE_N1` && code([{ origin: 42, kind: 7 }]) === `${P}OTHER_NONE_N1`);
    ok('BLK every role x phase x kind x class combination round-trips through the staged grammar and the summary allowlist', (() => {
      for (const r of B_ROLES) for (const ph of B_PHASES) for (const k of KINDS) for (const c of CLASSES) for (const n of [1, 9]) {
        const x = `${BLOCKED_PREFIX}_${r}_${ph}_${k}_${c}_N${n}`; if (!BLOCKED_CODE_RE.test(x) || globalCode(x) !== x) return false;
      }
      return globalCode(BLOCKED_PREFIX) === BLOCKED_PREFIX && globalCode(`${P}IMAGE_PRAVATAR_N0`) === 'OTHER' && globalCode(`${P}IMAGE_MARKER_N1`) === 'OTHER' && globalCode(`${P}IMAGE_PRAVATAR_N1_MARKER`) === 'OTHER';
    })());
    ok('BLK the summary stages a classified code at place SETUP (blocked-class.mjs location counts as setup)', playwrightSummary(JSON.stringify({ stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 }, errors: [{ message: `JourneyGateError: ${P}IMAGE_PRAVATAR_N3`, location: { file: '/r00t/e2e/gradebook-roles/journey/session-setup.ts' } }] }), '1', '', '/r00t').split('\n')[1] === `GLOBAL first=${P}IMAGE_PRAVATAR_N3 where=SETUP diag=NONE diag_class=NONE diags=0`);
    ok('BLK helpers: kindOf/classOf/entryClass are total on junk', kindOf(undefined) === 'OTHER' && classOf(undefined, AP) === 'NONE' && classOf('not a url', AP) === 'NONE' && entryClass(undefined, AP).cls !== undefined);
    const setupSrc = fs.readFileSync(path.join(repo, 'e2e/gradebook-roles/journey/session-setup.ts'), 'utf8');
    ok('BLK session-setup: guard call and approved origins unchanged; refusal still on any blocked entry, after storageState; code only from blockedCode', setupSrc.includes('newGuardedContext(browser, [app.origin, api.origin])') && /if \(blocked\.length\) \{[\s\S]{0,400}throw new JourneyGateError\(blockedCode\(\{ role: R, phase, blocked: \[\.\.\.blocked\], approved: \[app\.origin, api\.origin\] \}\)\)/.test(setupSrc) && setupSrc.indexOf('context.storageState()') < setupSrc.indexOf('if (blocked.length)'));
    const guardSrc = fs.readFileSync(path.join(repo, 'e2e/gradebook-roles/origin-guard.mjs'), 'utf8');
    ok('BLK origin guard file is byte-identical to its 9b69177 blob (pinned; not relaxed)', createHash('sha1').update(`blob ${Buffer.byteLength(guardSrc)}\0`).update(guardSrc).digest('hex') === '25332b129959bbae5d020c439e56b0cbbae46510');
  }
  ok('SUM empty report, and a report behind stray stdout, refuse with their own codes', SUMC(() => playwrightSummary('', '1')) === 'SUMMARY_E_PLAYWRIGHT_EMPTY' && SUMC(() => playwrightSummary('\n  \n', '1')) === 'SUMMARY_E_PLAYWRIGHT_EMPTY' && SUMC(() => playwrightSummary('[journey setup] MARKER\n{"stats":{}}', '0')) === 'SUMMARY_E_PLAYWRIGHT_POLLUTED' && SUMC(() => playwrightSummary('MARKER\n{not json', '0')) === 'SUMMARY_E_PLAYWRIGHT_PARSE');
  ok('SUM non-JSON or odd counts refused', SUMC(() => playwrightSummary('MARKER not json', '1')) === 'SUMMARY_E_PLAYWRIGHT_PARSE' && SUMC(() => playwrightSummary(JSON.stringify({ stats: { expected: '12', unexpected: 0, flaky: 0, skipped: 0 } }), '0')) === 'SUMMARY_E_PLAYWRIGHT_SHAPE');
  ok('SUM comparator lines pass their grammar', compareSummary('FAIL W_HASH_MISSING_PRE grades\nPROTECTED -\nUNPROVEN-EMPTY grade_history\nFAIL journey witness comparison\n') === 'FAIL W_HASH_MISSING_PRE grades\nPROTECTED -\nUNPROVEN-EMPTY grade_history\nFAIL journey witness comparison');
  ok('SUM a stray raw line (id, URL, message) in comparator output refused', SUMC(() => compareSummary('FAIL W_X\nERROR: MARKER at /tmp/x\nFAIL journey witness comparison\n')) === 'SUMMARY_E_COMPARE_LINE' && SUMC(() => compareSummary('FAIL W_X 9b6c0000-0000-4000-8000-000000000001\nFAIL journey witness comparison')) === 'SUMMARY_E_COMPARE_LINE');

  // ---- Screenshots: capture scan (shot-core) and export (shot-export), on fakes ----
  stage = "Screenshots: capture scan (shot-core) and export (shot-export), on fakes";
  const pchunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const PSIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = (w = 2, h = 1, depth = 8, color = 2) => { const b = Buffer.alloc(13); b.writeUInt32BE(w, 0); b.writeUInt32BE(h, 4); b[8] = depth; b[9] = color; return pchunk('IHDR', b); };
  const idat = (raw = Buffer.from([0, 1, 2, 3, 4, 5, 6]), level = 6) => pchunk('IDAT', zlib.deflateSync(raw, { level }));
  const iend = () => pchunk('IEND', Buffer.alloc(0));
  const mkPng = (...mid) => Buffer.concat([PSIG, ihdr(), ...(mid.length ? mid : [idat()]), iend()]);
  const NONCE = 'a'.repeat(31) + 'b';
  const SECRETS = shotSecrets({ E2E_INSTRUCTOR_PASSWORD: 'instr-pw-123456', E2E_MEMBER_PASSWORD: 'member-pw-654321', VITE_SUPABASE_ANON_KEY: 'anon-key-abcdefgh' }, { stack_id: NONCE });
  const SC = (txt) => JSON.stringify(scanPage(Array.isArray(txt) ? txt : [txt, '', '', '', ''], SECRETS));
  const SCE = (fn) => { try { fn(); return 'ACCEPTED'; } catch (e) { return e.code; } };
  ok('SHOTSCAN secrets refuse a missing nonce or a missing credential (a scan never checks less)', SCE(() => shotSecrets({ E2E_INSTRUCTOR_PASSWORD: 'x', E2E_MEMBER_PASSWORD: 'y', VITE_SUPABASE_ANON_KEY: 'z' }, {})) === 'SHOT_E_NO_NONCE' && SCE(() => shotSecrets({ E2E_INSTRUCTOR_PASSWORD: 'x', E2E_MEMBER_PASSWORD: '' , VITE_SUPABASE_ANON_KEY: 'z' }, { stack_id: NONCE })) === 'SHOT_E_NO_SECRET');
  ok('SHOTSCAN synthetic journey page text is clean', SC(['Journey Course\nModule 1\nUpload assignment 10 points', '<html><body>Journey Course</body></html>', '', 'Insights', 'http://127.0.0.1:4173/courses/9b6c0000-0000-4000-8000-000000000001']) === '[]');
  ok('SHOTSCAN the nonce anywhere (text, markup, form value, URL) refuses', [0, 1, 2, 4].every((i) => { const t = ['', '', '', '', '']; t[i] = `x ${NONCE} y`; return SC(t) === '["SHOT_E_NONCE"]'; }));
  ok('SHOTSCAN the carrier prefix refuses, in any case', SC('Gb-Journey-Pairing:') === '["SHOT_E_PREFIX"]');
  ok('SHOTSCAN a persona password or the anon key on the page refuses', SC('member-pw-654321') === '["SHOT_E_CREDENTIAL"]' && SC(['', '', 'instr-pw-123456', '', '']) === '["SHOT_E_CREDENTIAL"]' && SC('<meta content="anon-key-abcdefgh">') === '["SHOT_E_CREDENTIAL"]');
  ok('SHOTSCAN credential shapes refuse: database URI, JWT, Supabase key, service_role', ['postgresql://u@h/d', 'eyJhbGciOiJIUzI1.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJlMTI', 'sb_secret_abcdefgh12', 'role SERVICE_ROLE'].every((t) => SC(t) === '["SHOT_E_PATTERN"]'));
  ok('SHOTSCAN odd input refuses', JSON.stringify(scanPage([], SECRETS)) === '["SHOT_E_SCAN_INPUT"]' && JSON.stringify(scanPage([1], SECRETS)) === '["SHOT_E_SCAN_INPUT"]' && JSON.stringify(scanPage(['x'], [])) === '["SHOT_E_SCAN_INPUT"]');
  const shotDir = () => { const d = fs.mkdtempSync(path.join(tmp, 'shots-')); fs.chmodSync(d, 0o700); return d; };
  // The capture decision on fakes. A clean, unchanged window on the planned persona and path is the legitimate positive.
  const APPO = 'http://127.0.0.1:4173', APIO = 'http://127.0.0.1:54321';
  const PATH_OF = { detail: '/courses/9b6c0000-0000-4000-8000-000000000001', progress: '/courses/9b6c0000-0000-4000-8000-000000000001/progress', grades: '/courses/9b6c0000-0000-4000-8000-000000000001/grades' };
  const samp = (over = {}) => ({ url: `${APPO}${PATH_OF.grades}`, texts: ['Grades\nUpload assignment 10/10', '<html><body>Grades</body></html>', '', 'Insights', `${APPO}${PATH_OF.grades}`], images: [`${APPO}/logo.svg`, '/assets/hero.webp', `${APIO}/storage/v1/object/public/x.png`], surfaces: 0, ...over });
  const cleanObs = (over = {}) => ({ project: 'jr-4-learner-readback', expectedPath: PATH_OF.grades, appOrigin: APPO, apiOrigin: APIO, before: samp(), after: samp(), armed: 'k'.repeat(32), guard: { token: 'k'.repeat(32), n: 0 }, navigations: 0, incomplete: false, ...over });
  const DS = (name, obs) => JSON.stringify(decideShot(name, obs, SECRETS));
  ok('SHOTDECIDE unchanged legitimate positive (planned persona, exact path, same document, no mutation, clean before/after): write', DS('J4c-grades', cleanObs()) === '{"write":true}');
  ok('SHOTDECIDE J0a catalog (the carrier route) is withheld by rule, whatever the page shows', DS('J0a-catalog-before-publish', cleanObs({ project: 'jr-0-learner-draft' })) === '{"write":false,"reason":"CARRIER_ROUTE"}');
  ok('SHOTDECIDE clean -> secret during capture -> clean (mutations seen by the guard): withheld MUTATED', DS('J4c-grades', cleanObs({ guard: { token: 'k'.repeat(32), n: 2 } })) === '{"write":false,"reason":"MUTATED"}');
  ok('SHOTDECIDE navigation during capture, or a replaced document (guard token gone): withheld NAVIGATED', DS('J4c-grades', cleanObs({ navigations: 1 })) === '{"write":false,"reason":"NAVIGATED"}' && DS('J4c-grades', cleanObs({ guard: { token: null, n: -1 } })) === '{"write":false,"reason":"NAVIGATED"}' && DS('J4c-grades', cleanObs({ guard: { token: 'z'.repeat(32), n: 0 } })) === '{"write":false,"reason":"NAVIGATED"}');
  ok('SHOTDECIDE a field value changed between the samples: withheld CHANGED', DS('J4c-grades', cleanObs({ after: samp({ texts: ['Grades\nUpload assignment 10/10', '<html><body>Grades</body></html>', 'typed', 'Insights', `${APPO}${PATH_OF.grades}`] }) })) === '{"write":false,"reason":"CHANGED"}');
  ok('SHOTDECIDE wrong route (other path, query, hash, origin) or wrong persona project: withheld ROUTE / PERSONA', DS('J4c-grades', cleanObs({ before: samp({ url: `${APPO}${PATH_OF.progress}` }) })) === '{"write":false,"reason":"ROUTE"}' && DS('J4c-grades', cleanObs({ before: samp({ url: `${APPO}${PATH_OF.grades}?x=1` }) })) === '{"write":false,"reason":"ROUTE"}'
    && DS('J4c-grades', cleanObs({ before: samp({ url: `${APPO}${PATH_OF.grades}#h` }) })) === '{"write":false,"reason":"ROUTE"}' && DS('J4c-grades', cleanObs({ before: samp({ url: `http://127.0.0.1:9999${PATH_OF.grades}` }) })) === '{"write":false,"reason":"ROUTE"}' && DS('J4c-grades', cleanObs({ project: 'jr-3-instructor-grade' })) === '{"write":false,"reason":"PERSONA"}');
  ok('SHOTDECIDE a shot name outside the plan refuses (no record at all)', (() => { try { decideShot('J9-other', cleanObs(), SECRETS); return false; } catch (e) { return e.code === 'SHOT_E_NAME'; } })());
  ok('SHOTDECIDE unsupported surfaces (iframe/canvas/video/embed/object, an off-origin, data: or blob: image): withheld UNSUPPORTED_SURFACE', DS('J4c-grades', cleanObs({ before: samp({ surfaces: 1 }) })) === '{"write":false,"reason":"UNSUPPORTED_SURFACE"}' && DS('J4c-grades', cleanObs({ before: samp({ images: ['https://i.pravatar.cc/150'] }) })) === '{"write":false,"reason":"UNSUPPORTED_SURFACE"}' && ['data:image/png;base64,AAAA', 'blob:http://127.0.0.1:4173/x'].every((src) => DS('J4c-grades', cleanObs({ before: samp({ images: [src] }) })) === '{"write":false,"reason":"UNSUPPORTED_SURFACE"}'));
  ok('SHOTDECIDE dirty before (never captured) or dirty after: withheld DIRTY_BEFORE / DIRTY_AFTER', DS('J4c-grades', cleanObs({ before: samp({ texts: [`x ${NONCE}`, '', '', '', ''] }) })) === '{"write":false,"reason":"DIRTY_BEFORE"}' && DS('J4c-grades', cleanObs({ before: samp({ texts: ['a', 'member-pw-654321', '', '', ''] }), after: samp({ texts: ['a', 'member-pw-654321', '', '', ''] }) })) === '{"write":false,"reason":"DIRTY_BEFORE"}');
  ok('SHOTDECIDE incomplete checks (exception mid-window, missing sample or guard): withheld INCOMPLETE', DS('J4c-grades', cleanObs({ incomplete: true })) === '{"write":false,"reason":"INCOMPLETE"}' && DS('J4c-grades', { ...cleanObs(), after: undefined }) === '{"write":false,"reason":"INCOMPLETE"}' && DS('J4c-grades', { ...cleanObs(), guard: undefined }) === '{"write":false,"reason":"INCOMPLETE"}');
  ok('SHOTDECIDE every plan entry names a journey persona project and a route key', Object.values(SHOT_PLAN).every(([p, k]) => /^jr-[0-4]-/.test(p) && /^[a-z-]+$/.test(k)) && Object.keys(SHOT_PLAN).join() === SHOT_NAMES.join());
  // The in-page guard and the capture window, executed in a real DOM (jsdom) with the real SHOT_GUARD and captureShot.
  { const { JSDOM } = await import('jsdom');
    const PAGE = '<!doctype html><html><head><title>Insights</title></head><body><p id="t">Grades</p><input id="i" value=""></body></html>';
    const mkPage = (html = PAGE) => { const dom = new JSDOM(html, { url: `${APPO}${PATH_OF.grades}` }); const g = dom.window; const live = {};
      const add = g.addEventListener.bind(g), rem = g.removeEventListener.bind(g);
      g.addEventListener = (t, f, c) => { live[t] = (live[t] || 0) + 1; add(t, f, c); };
      g.removeEventListener = (t, f, c) => { live[t] = (live[t] || 0) - 1; rem(t, f, c); };
      return { g, live, detached: () => Object.values(live).every((n) => n === 0) && !('__gbShotGuard' in g) }; };
    const inWin = (g, fn) => { const K = ['document', 'MutationObserver', 'addEventListener', 'removeEventListener', '__gbShotGuard']; const prev = {}; for (const k of K) prev[k] = globalThis[k];
      globalThis.document = g.document; globalThis.MutationObserver = g.MutationObserver; globalThis.addEventListener = g.addEventListener; globalThis.removeEventListener = g.removeEventListener;
      if ('__gbShotGuard' in g) globalThis.__gbShotGuard = g.__gbShotGuard; else delete globalThis.__gbShotGuard;
      try { return fn(); } finally { if ('__gbShotGuard' in globalThis) g.__gbShotGuard = globalThis.__gbShotGuard; else delete g.__gbShotGuard; for (const k of K) { if (prev[k] === undefined) delete globalThis[k]; else globalThis[k] = prev[k]; } } };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    // A page driver over jsdom. hooks[`${when}:${step}#${k}`] runs in the gap before/after the k-th call of a step.
    const mkDrv = (pg, hooks = {}) => { const log = [], navs = new Set(), seen = {};
      const at = async (when, step) => { const k = `${when}:${step}#${seen[step] || 0}`; if (hooks[k]) { await hooks[k](pg.g, () => { for (const cb of navs) cb(); }); await tick(); } };
      const run = async (step, fn) => { seen[step] = (seen[step] || 0) + 1; await at('pre', step); log.push(step); const r = await fn(); await at('post', step); return r; };
      const d = () => pg.g.document;
      return { log, navs,
        watchNav: (cb) => { log.push('watch'); navs.add(cb); return () => { log.push('unwatch'); navs.delete(cb); }; },
        guard: (op, t) => run(op, () => inWin(pg.g, () => SHOT_GUARD([op, t]))),
        sample: () => run('sample', () => ({ url: pg.g.location.href, texts: [d().body.textContent, d().documentElement.outerHTML, [...d().querySelectorAll('input, textarea, select')].map((x) => x.value).join('\n'), d().title, pg.g.location.href],
          images: [...d().querySelectorAll('img')].map((x) => x.getAttribute('src') ?? ''), surfaces: d().querySelectorAll('iframe, canvas, video, embed, object').length })),
        screenshot: () => run('screenshot', () => (d().body.textContent.includes(NONCE) ? mkPng(pchunk('tEXt', Buffer.from(`painted ${NONCE}`))) : mkPng())) }; };
    const base = { project: 'jr-4-learner-readback', expectedPath: PATH_OF.grades, appOrigin: APPO, apiOrigin: APIO };
    const cap = async (hooks, html) => { const pg = mkPage(html); const drv = mkDrv(pg, hooks); const r = await captureShot(drv, base, 'k'.repeat(32), SECRETS);
      return { ...r, log: drv.log.join(','), pg, d: DS('J4c-grades', r.obs), navsLeft: drv.navs.size, leaked: !!r.png && r.png.includes(Buffer.from(NONCE)) }; };
    // The 945246b orchestration (sample -> arm -> screenshot -> read -> sample; read only disconnected the observer), kept
    // here ONLY as the causal reference for the gap controls below.
    const OLD_GUARD = ([op, token]) => { const w = globalThis; if (op === 'arm') { const st = { token, n: 0, obs: null }; const bump = () => { st.n += 1; };
      st.obs = new MutationObserver((recs) => { st.n += recs.length; }); st.obs.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      for (const ev of ['input', 'change', 'pagehide', 'beforeunload']) w.addEventListener(ev, bump, true); w.__gbShotGuard = st; return token; }
      const st = w.__gbShotGuard; if (!st) return { token: null, n: -1 }; if (st.obs) st.obs.disconnect(); return { token: st.token, n: st.n }; };
    const oldCap = async (hooks) => { const pg = mkPage(); const drv = mkDrv(pg, hooks); drv.guard = (op, t) => (async () => { const k = op; return inWin(pg.g, () => OLD_GUARD([k, t])); })();
      let navigations = 0; const before = await drv.sample(); const un = drv.watchNav(() => { navigations += 1; }); await drv.guard('arm', 'k'.repeat(32)); const png = await drv.screenshot();
      const guard = await drv.guard('read', 'k'.repeat(32)); un(); await hooks['old:read-sample']?.(pg.g); await tick(); const after = await drv.sample();
      const obs = { ...base, before, after, armed: 'k'.repeat(32), guard, navigations, incomplete: false };
      return { d: DS('J4c-grades', obs), leaked: png.includes(Buffer.from(NONCE)), detached: pg.detached() }; };
    const put = (g) => { g.document.getElementById('t').textContent = `x ${NONCE}`; };
    const unput = (g) => { g.document.getElementById('t').textContent = 'Grades'; };

    const pos = await cap({});
    ok('SHOTWINDOW unchanged legitimate positive: write, order watch,arm,sample,(mark:S),screenshot,(mark:A),sample,(mark:F),read,unwatch, fully detached', pos.d === '{"write":true}' && pos.log === 'watch,arm,sample,mark:S,screenshot,mark:A,sample,mark:F,read,unwatch' && pos.pg.detached() && pos.navsLeft === 0 && Buffer.isBuffer(pos.png));
    // T's exact case: clean BEFORE -> secret inserted -> screenshot shows it -> secret removed before AFTER.
    const oldT = await oldCap({ 'post:sample#1': put, 'old:read-sample': unput });
    const newT = await cap({ 'post:sample#1': put, 'pre:sample#2': unput });
    ok('SHOTWINDOW causal: the 945246b order WRITES a screenshot that painted the nonce (secret in both gaps)', oldT.d === '{"write":true}' && oldT.leaked);
    ok('SHOTWINDOW the same case now: the screenshot painted it, the guard counted it, withheld MUTATED', newT.leaked && newT.d === '{"write":false,"reason":"MUTATED"}' && newT.pg.detached());
    ok('SHOTWINDOW the 945246b read left input/change/pagehide/beforeunload listeners attached (reference)', oldT.detached === false);
    const gapA = await cap({ 'post:sample#1': put, 'post:screenshot#1': unput });
    ok('SHOTWINDOW gap sample->screenshot: inserted after the first sample, removed after the capture: withheld MUTATED', gapA.leaked && gapA.d === '{"write":false,"reason":"MUTATED"}');
    const gapB = await cap({ 'post:screenshot#1': put, 'post:sample#2': unput });
    ok('SHOTWINDOW gap screenshot->sample->read: inserted after the capture, removed after the AFTER sample, before the read: withheld MUTATED', gapB.d === '{"write":false,"reason":"MUTATED"}');
    const pend = await cap({ 'pre:read#1': (g) => { put(g); unput(g); } });
    ok('SHOTWINDOW a change still pending when the guard is read is drained (takeRecords): withheld MUTATED', pend.d === '{"write":false,"reason":"MUTATED"}');
    const fld = await cap({ 'post:sample#1': (g) => { const x = g.document.getElementById('i'); x.value = 'typed'; x.dispatchEvent(new g.Event('input', { bubbles: true })); } });
    ok('SHOTWINDOW a field value change between the samples is withheld (input event counted)', fld.d === '{"write":false,"reason":"MUTATED"}');
    const navA = await cap({ 'post:sample#1': (g, nav) => nav() }), navB = await cap({ 'pre:read#1': (g, nav) => nav() }), navC = await cap({ 'pre:sample#1': (g, nav) => nav() });
    ok('SHOTWINDOW a main-frame navigation before the first sample, in a capture gap, or before the read: withheld NAVIGATED', [navA, navB, navC].every((x) => x.d === '{"write":false,"reason":"NAVIGATED"}' && x.navsLeft === 0));
    const dirty = await cap({}, PAGE.replace('Grades</p>', `Grades ${NONCE}</p>`));
    ok('SHOTWINDOW a dirty first sample is never captured (no screenshot call), withheld DIRTY_BEFORE, detached', dirty.d === '{"write":false,"reason":"DIRTY_BEFORE"}' && !dirty.log.includes('screenshot') && dirty.log.endsWith('read,unwatch') && dirty.pg.detached());
    const boom = () => { throw new Error('x'); };
    const exS = await cap({ 'pre:screenshot#1': boom }), exP = await cap({ 'pre:sample#1': boom }), exP2 = await cap({ 'pre:sample#2': boom }), exA = await cap({ 'post:arm#1': boom });
    ok('SHOTWINDOW an exception in the screenshot or either sample: no buffer, INCOMPLETE, guard read and listeners detached', [exS, exP, exP2, exA].every((x) => x.png === null && x.d === '{"write":false,"reason":"INCOMPLETE"}' && x.log.endsWith('read,unwatch') && x.pg.detached() && x.navsLeft === 0));
    const exR = await cap({ 'pre:read#1': boom });
    ok('SHOTWINDOW an exception reading the guard: no buffer, INCOMPLETE, navigation listener still removed', exR.png === null && exR.d === '{"write":false,"reason":"INCOMPLETE"}' && exR.log.endsWith('unwatch') && exR.navsLeft === 0);
    const exArm = await cap({ 'pre:arm#1': boom });
    ok('SHOTWINDOW an exception before the guard is armed: read still attempted (no state), INCOMPLETE', exArm.png === null && exArm.d === '{"write":false,"reason":"INCOMPLETE"}' && exArm.log === 'watch,read,unwatch' && exArm.pg.detached());
    // The guard alone.
    const gRun = async (fn) => { const pg = mkPage(); inWin(pg.g, () => SHOT_GUARD(['arm', 'tok'])); await fn(pg.g); const r = inWin(pg.g, () => SHOT_GUARD(['read', 'tok'])); return { r, pg }; };
    const g0 = await gRun(async () => { await tick(); });
    ok('SHOTGUARD real DOM: unchanged page reads back the same token and 0 events (all phases zero), then is fully detached', JSON.stringify(g0.r) === JSON.stringify({ token: 'tok', n: 0, phases: [0, 1, 2, 3].map(() => Array(10).fill(0)) }) && g0.pg.detached());
    ok('SHOTGUARD real DOM: a secret written then reverted (not yet delivered to the observer) is counted', (await gRun((w) => { put(w); unput(w); })).r.n >= 2);
    ok('SHOTGUARD real DOM: a field value change (input event) is counted', (await gRun(async (w) => { const x = w.document.getElementById('i'); x.value = 'x'; x.dispatchEvent(new w.Event('input', { bubbles: true })); await tick(); })).r.n >= 1);
    { const pg = mkPage(); const r = inWin(pg.g, () => SHOT_GUARD(['read', 'tok']));
      ok('SHOTGUARD a replaced document (no guard state) reads token null', r.token === null && r.n === -1); }

    // ---- MUTATED differentiation (run 41493619385: 7 shots MUTATED, cause unknown). DIAGNOSTIC ONLY: fixed-kind counts per
    // phase, drained at each boundary; the decision, total, refusal, finally, navigation and unknown handling are unchanged.
    stage = 'Shot guard phase diagnostic (jsdom; diagnostic only)';
    const K = { attributes: 0, childList: 1, characterData: 2, unknown: 3, input: 4, change: 5, navigation: 6, STYLE: 7, CLASS: 8, OTHER: 9 };
    const flip = (g) => { put(g); unput(g); };   // two childList records, nothing left changed
    const only = (ph, at, want) => ph.every((row, i) => row.every((v, k) => v === (i === at && Object.hasOwn(want, k) ? want[k] : 0)));
    const gaps = [['post:sample#1', 0], ['pre:mark:S#1', 0], ['post:mark:S#1', 1], ['post:screenshot#1', 1], ['post:mark:A#1', 2], ['post:sample#2', 2], ['post:mark:F#1', 3], ['pre:read#1', 3]];
    const gapRes = [];
    for (const [hook, at] of gaps) { const r = await cap({ [hook]: flip }); const dg = mutationDiag(r.obs);
      gapRes.push(r.d === '{"write":false,"reason":"MUTATED"}' && r.obs.guard.n === 2 && dg.marks === 3 && dg.sum === 'EQ' && only(dg.phases, at, { [K.childList]: 2 }) && r.pg.detached()); }
    ok('SHOTDIAG a transient change in EACH gap (after sample 1, around each mark, after the screenshot, after sample 2, before the read) lands in exactly its phase; decision still MUTATED, n 2, sum EQ, marks 3', gapRes.every(Boolean));
    { const r = await cap({}); const dg = mutationDiag(r.obs);
      ok('SHOTDIAG the clean positive still writes; its diag would be all zero with 3 marks (no record is written for a capture)', r.d === '{"write":true}' && dg.marks === 3 && dg.sum === 'EQ' && only(dg.phases, -1, {})); }
    // Pending records: mutate synchronously in the same task as the mark/read, so the observer callback has NOT delivered them.
    const syncCap = async (when) => { const pg = mkPage(); const drv = mkDrv(pg); const g0 = drv.guard;
      drv.guard = (op, t) => (op === when ? (async () => { drv.log.push(op); return inWin(pg.g, () => { flip(pg.g); return SHOT_GUARD([op, t]); }); })() : g0(op, t));
      const r = await captureShot(drv, base, 'k'.repeat(32), SECRETS); return { r, dg: mutationDiag(r.obs), pg }; };
    const pS = await syncCap('mark:S'), pF = await syncCap('read');
    ok('SHOTDIAG pending records at a mark are drained (takeRecords) into the phase that is ending: BEFORE_SAMPLE', only(pS.dg.phases, 0, { [K.childList]: 2 }) && pS.r.obs.guard.n === 2 && pS.dg.sum === 'EQ' && DS('J4c-grades', pS.r.obs) === '{"write":false,"reason":"MUTATED"}');
    ok('SHOTDIAG pending records at the read are drained into FINAL and still counted in n', only(pF.dg.phases, 3, { [K.childList]: 2 }) && pF.r.obs.guard.n === 2 && pF.dg.sum === 'EQ' && pF.pg.detached());
    // Kinds and attribute families, with hostile names/values/text: only integers leave the page.
    const HN = 'data-' + NONCE;
    const hostileHook = (g) => { const p = g.document.getElementById('t'); p.setAttribute('style', `x:${NONCE}`); p.setAttribute('class', NONCE); p.setAttribute(HN, NONCE);
      p.setAttribute('__proto__', NONCE); p.setAttribute('constructor', NONCE); p.firstChild.data = `Grades ${NONCE}`; p.firstChild.data = 'Grades';
      for (const a of ['style', 'class', HN, '__proto__', 'constructor']) p.removeAttribute(a); };
    const evHook = (g) => { const x = g.document.getElementById('i'); x.dispatchEvent(new g.Event('input', { bubbles: true })); x.dispatchEvent(new g.Event('change', { bubbles: true })); g.dispatchEvent(new g.Event('pagehide')); };
    { const r = await cap({ 'post:screenshot#1': hostileHook, 'post:sample#2': evHook }); const dg = mutationDiag(r.obs); const sfx = diagSuffix(dg);
      const okS = dg.phases[1][K.attributes] === 10 && dg.phases[1][K.STYLE] === 2 && dg.phases[1][K.CLASS] === 2 && dg.phases[1][K.OTHER] === 6 && dg.phases[1][K.characterData] === 2;
      const okA = dg.phases[2][K.input] === 1 && dg.phases[2][K.change] === 1 && dg.phases[2][K.navigation] === 1;
      const flat = JSON.stringify(r.obs.guard) + JSON.stringify(dg) + sfx;
      ok('SHOTDIAG hostile attribute names/values and text: STYLE/CLASS/OTHER families and characterData counted in SCREENSHOT; input/change/navigation in AFTER_SAMPLE; sum EQ',
        okS && okA && dg.sum === 'EQ' && r.d === '{"write":false,"reason":"MUTATED"}');
      ok('SHOTDIAG nothing but integers and fixed words leave: no nonce, attribute name, selector, URL or text in the guard read, the diag or the manifest suffix',
        !flat.includes(NONCE) && !/style|constructor|__proto__|data-|Grades|http|#/.test(JSON.stringify(dg) + JSON.stringify(r.obs.guard.phases)) && DIAG_SUFFIX_RE.test(sfx) && Object.keys(r.obs.guard).sort().join() === 'n,phases,token'); }
    // Exceptions: a failing mark is not counted and changes nothing else; a failing step stays INCOMPLETE with no diag.
    { const a = await cap({ 'pre:mark:S#1': boom }), b = await cap({ 'pre:mark:A#1': boom, 'post:screenshot#1': flip }), c = await cap({ 'post:mark:S#1': flip, 'pre:screenshot#1': boom });
      const db = mutationDiag(b.obs);
      ok('SHOTDIAG a mark that throws: positive still writes (marks 2), detached; the window order is unchanged apart from the missing mark', a.d === '{"write":true}' && a.obs.marks === 2 && a.pg.detached() && a.log === 'watch,arm,sample,screenshot,mark:A,sample,mark:F,read,unwatch');
      ok('SHOTDIAG a mark that throws after a change: still MUTATED, records stay in the phase that was current (SCREENSHOT), marks 2, sum EQ', b.d === '{"write":false,"reason":"MUTATED"}' && db.marks === 2 && only(db.phases, 1, { [K.childList]: 2 }) && db.sum === 'EQ' && b.pg.detached());
      ok('SHOTDIAG an exception in the screenshot after a mark: INCOMPLETE, no buffer, guard read in finally, listeners detached, no diag on the record', c.png === null && c.d === '{"write":false,"reason":"INCOMPLETE"}' && c.log.endsWith('read,unwatch') && c.pg.detached() && c.navsLeft === 0); }
    { const pg = mkPage(); inWin(pg.g, () => SHOT_GUARD(['arm', 'tok']));
      const back = inWin(pg.g, () => [SHOT_GUARD(['mark:A', 'tok']), SHOT_GUARD(['mark:S', 'tok']), SHOT_GUARD(['mark:Z', 'tok']), SHOT_GUARD(['mark:A', 'tok'])]);
      const fresh = mkPage(); const none = inWin(fresh.g, () => SHOT_GUARD(['mark:S', 'tok']));
      inWin(pg.g, () => SHOT_GUARD(['read', 'tok']));
      ok('SHOTDIAG marks move forward only (backward, repeated or unknown phase is a no-op); a mark on a document with no guard creates nothing', JSON.stringify(back) === '[{"phase":2},{"phase":-1},{"phase":-1},{"phase":-1}]' && JSON.stringify(none) === '{"phase":-1}' && fresh.detached() && pg.detached()); }
    // Total preserved: the 9cef498 guard (no marks) and this guard (with marks) count the same n for the same changes.
    { const oldSrc = execFileSync('git', ['show', '9cef49853a47e32906cb66a5d4b8adfa99e06b1a:e2e/gradebook-roles/journey/shot-core.mjs'], { cwd: repo, encoding: 'utf8' });
      const body = oldSrc.slice(oldSrc.indexOf('export function SHOT_GUARD('), oldSrc.indexOf('/**\n * The capture window')).replace('export function', 'function');
      const OLD9 = new Function(`${body}; return SHOT_GUARD;`)();
      const seq = (G, marks, acts) => { const pg = mkPage(); return inWin(pg.g, () => { G(['arm', 'tok']); acts.forEach((f, i) => { f(pg.g); if (marks && i < 3) G([`mark:${'SAF'[i]}`, 'tok']); }); return G(['read', 'tok']).n; }); };
      const asyncSeq = async (G, marks, acts) => { const pg = mkPage(); inWin(pg.g, () => G(['arm', 'tok'])); for (let i = 0; i < acts.length; i++) { inWin(pg.g, () => acts[i](pg.g)); await tick(); if (marks && i < 3) inWin(pg.g, () => G([`mark:${'SAF'[i]}`, 'tok'])); } return inWin(pg.g, () => G(['read', 'tok'])).n; };
      const nop = () => {}; const ev = evHook;
      const plans = [[nop, nop, nop, nop], [flip, nop, nop, nop], [nop, flip, flip, nop], [hostileHook, ev, flip, hostileHook], [ev, ev, ev, ev]];
      const sync = plans.every((a) => seq(OLD9, false, a) === seq(SHOT_GUARD, true, a));
      let asy = true; for (const a of plans) asy = asy && (await asyncSeq(OLD9, false, a)) === (await asyncSeq(SHOT_GUARD, true, a));
      ok('SHOTDIAG total preserved: for 5 change plans (pending and delivered records, events), the 9cef498 guard n equals this guard n with all three marks', sync && asy); } }
  { const d = shotDir(); const png = mkPng();
    const r1 = writeShot(d, 'J4c-grades', png, cleanObs(), SECRETS);
    ok('SHOTWRITE positive writes <name>.png and its record bound to the sha256 (0600)', r1.written === 'png' && r1.sha256 === createHash('sha256').update(png).digest('hex') && JSON.stringify(JSON.parse(fs.readFileSync(path.join(d, 'J4c-grades.scan.json'), 'utf8'))) === JSON.stringify({ name: 'J4c-grades', sha256: r1.sha256, verdict: 'clean', scans: 2, window: 'same-document-unchanged' }) && ['J4c-grades.png', 'J4c-grades.scan.json'].every((f) => (fs.statSync(path.join(d, f)).mode & 0o777) === 0o600));
    const r2 = writeShot(d, 'J4c-progress', png, cleanObs({ project: 'jr-4-learner-readback', expectedPath: PATH_OF.progress, before: samp({ url: `${APPO}${PATH_OF.progress}` }), after: samp({ url: `${APPO}${PATH_OF.progress}` }), guard: { token: 'k'.repeat(32), n: 1 } }), SECRETS);
    ok('SHOTWRITE a withheld decision writes ONLY <name>.withheld.json with the reason; the buffer is never written', r2.written === 'withheld' && r2.reason === 'MUTATED' && !fs.existsSync(path.join(d, 'J4c-progress.png')) && !fs.existsSync(path.join(d, 'J4c-progress.scan.json')) && fs.readFileSync(path.join(d, 'J4c-progress.withheld.json'), 'utf8') === '{"name":"J4c-progress","withheld":true,"reason":"MUTATED","diag":"NA"}');
    ok('SHOTWRITE a positive decision with no buffer is withheld INCOMPLETE', writeShot(d, 'J4d-certificate', null, cleanObs({ expectedPath: PATH_OF.grades }), SECRETS).reason === 'INCOMPLETE' && !fs.existsSync(path.join(d, 'J4d-certificate.png')));
    ok('SHOTWRITE J0a writes only its withheld record', writeShot(d, 'J0a-catalog-before-publish', png, cleanObs(), SECRETS).reason === 'CARRIER_ROUTE' && !fs.existsSync(path.join(d, 'J0a-catalog-before-publish.png')));
    ok('SHOTWRITE an unknown name or an existing file refuses', SCE(() => writeShot(d, 'J9-other', png, cleanObs(), SECRETS)) === 'SHOT_E_NAME' && SCE(() => writeShot(d, 'J4c-grades', png, cleanObs(), SECRETS)) === 'SHOT_E_EXCLUSIVE_CREATE');
    const open = fs.mkdtempSync(path.join(tmp, 'shots-open-')); fs.chmodSync(open, 0o755);
    const link = path.join(tmp, `shots-link-${randomUUID()}`); fs.symlinkSync(shotDir(), link);
    ok('SHOTWRITE a non-private, symlinked or relative shot dir refuses (nothing written)', SCE(() => writeShot(open, 'J4c-grades', png, cleanObs(), SECRETS)) === 'SHOT_E_DIR' && SCE(() => writeShot(link, 'J4c-grades', png, cleanObs(), SECRETS)) === 'SHOT_E_DIR' && SCE(() => writeShot('rel', 'J4c-grades', png, cleanObs(), SECRETS)) === 'SHOT_E_DIR' && fs.readdirSync(open).length === 0); }
  // PNG re-encoding
  { const clean = mkPng();
    const withMeta = mkPng(pchunk('tEXt', Buffer.from(`Comment\0MARKER gb-journey-pairing:${NONCE}`, 'latin1')), idat(), pchunk('tIME', Buffer.alloc(7)));
    const out = sanitizePng(withMeta);
    ok('PNG clean image passes byte-identical', sanitizePng(clean).png.equals(clean));
    ok('PNG ancillary chunks (tEXt with marker + nonce, tIME) are dropped; image data kept byte-identical', !out.png.includes(Buffer.from('MARKER')) && !out.png.includes(Buffer.from(NONCE)) && !out.png.includes(Buffer.from('tEXt')) && out.png.equals(clean) && out.width === 2 && out.height === 1);
    const bad = Buffer.from(clean); bad[bad.length - 13] ^= 1;
    const PC = (b) => SCE(() => sanitizePng(b));
    ok('PNG refusals: signature, CRC, truncated, trailing bytes', PC(Buffer.concat([Buffer.from('GIF89a..'), clean.subarray(8)])) === 'SHOT_E_PNG_SIG' && PC(bad) === 'SHOT_E_PNG_CRC' && PC(clean.subarray(0, clean.length - 6)) === 'SHOT_E_PNG_TRUNCATED' && PC(Buffer.concat([clean, Buffer.from('MARKER')])) === 'SHOT_E_PNG_TRAILING');
    ok('PNG refusals: IHDR not first or repeated, odd IHDR, unknown critical chunk, split IDAT, missing IEND, non-inflating IDAT', PC(Buffer.concat([PSIG, idat(), ihdr(), iend()])) === 'SHOT_E_PNG_IHDR' && PC(Buffer.concat([PSIG, ihdr(), ihdr(), idat(), iend()])) === 'SHOT_E_PNG_IHDR' && PC(Buffer.concat([PSIG, ihdr(2, 1, 3, 2), idat(), iend()])) === 'SHOT_E_PNG_IHDR'
      && PC(mkPng(idat(), pchunk('ABCD', Buffer.from('x')))) === 'SHOT_E_PNG_CHUNK' && PC(mkPng(idat(), pchunk('tEXt', Buffer.from('a\0b')), idat())) === 'SHOT_E_PNG_IDAT' && PC(Buffer.concat([PSIG, ihdr(), idat()])) === 'SHOT_E_PNG_IEND' && PC(mkPng(pchunk('IDAT', Buffer.from('not zlib MARKER')))) === 'SHOT_E_PNG_DATA'); }
  // Export
  const shotRun = () => {
    const par = fs.mkdtempSync(path.join(tmp, 'shotrun-')); fs.chmodSync(par, 0o700);
    for (const d of ['proof', 'session', 'shots']) fs.mkdirSync(path.join(par, d), { mode: 0o700 });
    const proofFile = path.join(par, 'proof', 'pairing-proof.json');
    fs.writeFileSync(proofFile, JSON.stringify({ version: 2, stack_id: NONCE, control_course_id: CTRL, db_read: `gb-journey-pairing:${NONCE}`, api_read: `gb-journey-pairing:${NONCE}`, journey_rows_before_pairing: 0 }), { mode: 0o600 });
    return { par, shots: path.join(par, 'shots'), session: path.join(par, 'session'), proofFile, exportDir: path.join(par, 'export') };
  };
  const put = (r, name, png, rec = {}) => { fs.writeFileSync(path.join(r.shots, `${name}.png`), png, { mode: 0o600 }); fs.writeFileSync(path.join(r.shots, `${name}.scan.json`), JSON.stringify({ name, sha256: createHash('sha256').update(png).digest('hex'), verdict: 'clean', scans: 2, window: 'same-document-unchanged', ...rec }), { mode: 0o600 }); };
  const putW = (r, name, reason = 'MUTATED', extra = {}) => fs.writeFileSync(path.join(r.shots, `${name}.withheld.json`), JSON.stringify({ name, withheld: true, reason, ...extra }), { mode: 0o600 });
  const EX = (r, over = {}) => { try { return exportShots({ shotDir: r.shots, sessionDir: r.session, proofFile: r.proofFile, exportDir: r.exportDir, ...over }); } catch (e) { return e.code; } };
  { const r = shotRun(); const meta = mkPng(pchunk('iTXt', Buffer.from(`XML:com.adobe.xmp\0\0\0\0\0MARKER ${NONCE}`, 'latin1')), idat());
    put(r, 'J4d-certificate', meta); put(r, 'J0a-catalog-before-publish', mkPng());
    const lines = EX(r);
    const outs = fs.readdirSync(r.exportDir).sort();
    ok('SHOTEXPORT clean pair exported in allowlist order with exact manifest lines; bytes re-encoded without metadata', Array.isArray(lines) && lines.length === 3 && lines[0].startsWith('SHOT J0a-catalog-before-publish sha256=') && lines[1].startsWith('SHOT J4d-certificate sha256=') && lines[2] === 'SHOTS 2 captured 0 withheld of 16'
      && outs.join(',') === 'J0a-catalog-before-publish.png,J4d-certificate.png' && !fs.readFileSync(path.join(r.exportDir, 'J4d-certificate.png')).includes(Buffer.from('MARKER')) && lines[1].includes(`sha256=${createHash('sha256').update(fs.readFileSync(path.join(r.exportDir, 'J4d-certificate.png'))).digest('hex')}`));
    ok('SHOTEXPORT export dir 0700, files 0600; scan records are never exported', (fs.statSync(r.exportDir).mode & 0o777) === 0o700 && outs.every((f) => (fs.statSync(path.join(r.exportDir, f)).mode & 0o777) === 0o600) && !outs.some((f) => f.endsWith('.json')));
    ok('SHOTEXPORT the export dir must not exist yet', EX(r) === 'SHOT_E_EXPORT_DIR'); }
  ok('SHOTEXPORT no shots: just the count line', JSON.stringify(EX(shotRun())) === '["SHOTS 0 captured 0 withheld of 16"]');
  { const r = shotRun(); putW(r, 'J0a-catalog-before-publish', 'CARRIER_ROUTE'); put(r, 'J4c-grades', mkPng()); putW(r, 'J4d-certificate', 'NAVIGATED');
    const l = EX(r);
    ok('SHOTEXPORT withheld shots are reported by name and reason, in allowlist order, and never exported', Array.isArray(l) && l[0] === 'WITHHELD J0a-catalog-before-publish reason=CARRIER_ROUTE' && l[1].startsWith('SHOT J4c-grades sha256=') && l[2] === 'WITHHELD J4d-certificate reason=NAVIGATED' && l[3] === 'SHOTS 1 captured 2 withheld of 16' && fs.readdirSync(r.exportDir).join() === 'J4c-grades.png'); }
  // MUTATED diagnostic: a strictly validated fixed-kind record prints its counts; anything else in diag refuses.
  { const PH = [[1, 2, 0, 0, 0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [3, 0, 1, 0, 1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];
    const DG = { phases: PH, marks: 3, sum: 'EQ' };
    const r = shotRun(); putW(r, 'J2c-submitted-after-reload', 'MUTATED', { diag: DG }); putW(r, 'J4c-grades', 'MUTATED', { diag: 'NA' }); putW(r, 'J4d-certificate', 'MUTATED');
    const l = EX(r);
    ok('SHOTEXPORT a MUTATED record with diag prints BEFORE_SAMPLE/SCREENSHOT/AFTER_SAMPLE/FINAL counts, marks and sum; NA and no-diag records stay valid',
      Array.isArray(l) && l[0] === 'WITHHELD J2c-submitted-after-reload reason=MUTATED BEFORE_SAMPLE=1/2/0/0/0/0/0/1/0/0 SCREENSHOT=0/0/0/0/0/0/0/0/0/0 AFTER_SAMPLE=3/0/1/0/1/1/1/1/1/1 FINAL=0/0/0/0/0/0/0/0/0/0 marks=3 sum=EQ'
      && l[1] === 'WITHHELD J4c-grades reason=MUTATED diag=NA' && l[2] === 'WITHHELD J4d-certificate reason=MUTATED' && l[3] === 'SHOTS 0 captured 3 withheld of 16');
    const bad = [{ ...DG, extra: 1 }, { ...DG, marks: 4 }, { ...DG, sum: 'eq' }, { ...DG, phases: PH.slice(0, 3) }, { ...DG, phases: [PH[0].concat(0), PH[1], PH[2], PH[3]] },
      { ...DG, phases: [[1000, 0, 0, 0, 0, 0, 0, 0, 0, 0], PH[1], PH[2], PH[3]] }, { ...DG, phases: [[-1, 0, 0, 0, 0, 0, 0, 0, 0, 0], PH[1], PH[2], PH[3]] },
      { ...DG, phases: [['1', 0, 0, 0, 0, 0, 0, 0, 0, 0], PH[1], PH[2], PH[3]] }, { ...DG, phases: [[1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0], PH[1], PH[2], PH[3]] }, 'MARKER', null, [1]];
    const refused = bad.map((dg) => { const x = shotRun(); putW(x, 'J4c-grades', 'MUTATED', { diag: dg }); return EX(x); });
    const onOther = (() => { const x = shotRun(); putW(x, 'J4c-grades', 'NAVIGATED', { diag: 'NA' }); return EX(x); })();
    ok('SHOTEXPORT malformed diag (extra key, marks 4, sum case, 3 phases, 11 counts, over cap, negative, string, float, text, null, array) and diag on a non-MUTATED reason all refuse',
      refused.every((x) => x === 'SHOT_E_WITHHELD_RECORD') && onOther === 'SHOT_E_WITHHELD_RECORD'); }
  { const D = path.join(tmp, `wdiag-${process.pid}`); fs.mkdirSync(D, { mode: 0o700 });
    const obsM = { project: 'jr-4-learner-readback', expectedPath: PATH_OF.grades, appOrigin: APPO, apiOrigin: APIO, before: samp(), after: samp(), armed: 'k'.repeat(32), navigations: 0, incomplete: false, marks: 3,
      guard: { token: 'k'.repeat(32), n: 2001, phases: [[2000, 0, 0, 0, 0, 0, 0, 0, 2000, 0], [0, 1, 0, 0, 0, 0, 0, 0, 0, 0], Array(10).fill(0), Array(10).fill(0)] } };
    const w = writeShot(D, 'J4c-grades', null, obsM, SECRETS); const rec = JSON.parse(fs.readFileSync(path.join(D, 'J4c-grades.withheld.json'), 'utf8'));
    ok('SHOTWRITE a MUTATED record carries the capped diag (2000 -> 999), sum computed on the uncapped counts; decision unchanged',
      w.written === 'withheld' && w.reason === 'MUTATED' && rec.diag.sum === 'EQ' && rec.diag.phases[0][0] === 999 && rec.diag.phases[0][8] === 999 && rec.diag.marks === 3 && Object.keys(rec).join() === 'name,withheld,reason,diag');
    const w2 = writeShot(D, 'J4c-progress', null, { ...obsM, expectedPath: PATH_OF.progress, before: samp({ url: `${APPO}${PATH_OF.progress}` }), after: samp({ url: `${APPO}${PATH_OF.progress}` }), guard: { ...obsM.guard, n: 7 } }, SECRETS);
    const rec2 = JSON.parse(fs.readFileSync(path.join(D, 'J4c-progress.withheld.json'), 'utf8'));
    ok('SHOTWRITE a diag whose kind total differs from n says sum=NE (never hidden)', w2.reason === 'MUTATED' && rec2.diag.sum === 'NE');
    const w3 = writeShot(D, 'J4d-certificate', null, { ...obsM, project: 'jr-x' }, SECRETS);
    ok('SHOTWRITE other withheld reasons carry no diag', w3.reason === 'PERSONA' && fs.readFileSync(path.join(D, 'J4d-certificate.withheld.json'), 'utf8') === '{"name":"J4d-certificate","withheld":true,"reason":"PERSONA"}'); }
  { const cases = [
      ['nonce inside the image data itself (stored deflate) refuses', (r) => put(r, 'J4c-grades', mkPng(idat(Buffer.from(`\0${NONCE}`), 0))), 'SHOT_E_NONCE_IN_PNG'],
      ['carrier prefix inside the image data refuses', (r) => put(r, 'J4c-grades', mkPng(idat(Buffer.from('\0gb-journey-pairing:'), 0))), 'SHOT_E_NONCE_IN_PNG'],
      ['a dirty verdict refuses', (r) => put(r, 'J4c-grades', mkPng(), { verdict: 'dirty' }), 'SHOT_E_SCAN_RECORD'],
      ['a record for one scan only refuses', (r) => put(r, 'J4c-grades', mkPng(), { scans: 1 }), 'SHOT_E_SCAN_RECORD'],
      ['a record with an extra key refuses', (r) => put(r, 'J4c-grades', mkPng(), { note: 'x' }), 'SHOT_E_SCAN_RECORD'],
      ['a record naming another shot refuses', (r) => put(r, 'J4c-grades', mkPng(), { name: 'J4c-progress' }), 'SHOT_E_SCAN_RECORD'],
      ['PNG bytes changed after the scan refuse', (r) => { put(r, 'J4c-grades', mkPng()); fs.writeFileSync(path.join(r.shots, 'J4c-grades.png'), mkPng(idat(Buffer.from([0, 7, 7, 7, 7, 7, 7]))), { mode: 0o600 }); }, 'SHOT_E_SCAN_MISMATCH'],
      ['a PNG without its record refuses', (r) => fs.writeFileSync(path.join(r.shots, 'J4c-grades.png'), mkPng(), { mode: 0o600 }), 'SHOT_E_UNPAIRED'],
      ['a record without its PNG refuses', (r) => fs.writeFileSync(path.join(r.shots, 'J4c-grades.scan.json'), '{}', { mode: 0o600 }), 'SHOT_E_UNPAIRED'],
      ['a withheld record next to a PNG refuses', (r) => { put(r, 'J4c-grades', mkPng()); putW(r, 'J4c-grades'); }, 'SHOT_E_UNPAIRED'],
      ['a withheld record with an unknown reason, an extra key or another name refuses', (r) => putW(r, 'J4c-grades', 'BECAUSE'), 'SHOT_E_WITHHELD_RECORD'],
      ['a withheld record with an extra key refuses', (r) => putW(r, 'J4c-grades', 'MUTATED', { note: 'x' }), 'SHOT_E_WITHHELD_RECORD'],
      ['a scan record without the capture-window field refuses', (r) => put(r, 'J4c-grades', mkPng(), { window: undefined }), 'SHOT_E_SCAN_RECORD'],
      ['an unknown file (not allowlisted) refuses', (r) => fs.writeFileSync(path.join(r.shots, 'J9-extra.png'), mkPng(), { mode: 0o600 }), 'SHOT_E_UNKNOWN_FILE'],
      ['a 0644 PNG refuses', (r) => { put(r, 'J4c-grades', mkPng()); fs.chmodSync(path.join(r.shots, 'J4c-grades.png'), 0o644); }, 'SHOT_E_MODE'],
      ['a symlinked PNG refuses (no-follow)', (r) => { put(r, 'J4c-grades', mkPng()); const t = path.join(r.par, 'real.png'); fs.renameSync(path.join(r.shots, 'J4c-grades.png'), t); fs.symlinkSync(t, path.join(r.shots, 'J4c-grades.png')); }, 'SHOT_E_OPEN'],
      ['a FIFO in place of a PNG refuses at once (non-blocking)', (r) => { put(r, 'J4c-grades', mkPng()); fs.rmSync(path.join(r.shots, 'J4c-grades.png')); execFileSync('mkfifo', ['-m', '600', path.join(r.shots, 'J4c-grades.png')]); }, 'SHOT_E_TYPE'],
      ['a directory in place of a record refuses', (r) => { fs.writeFileSync(path.join(r.shots, 'J4c-grades.png'), mkPng(), { mode: 0o600 }); fs.mkdirSync(path.join(r.shots, 'J4c-grades.scan.json'), { mode: 0o700 }); }, 'SHOT_E_TYPE'],
      ['an oversize record refuses', (r) => { put(r, 'J4c-grades', mkPng()); fs.writeFileSync(path.join(r.shots, 'J4c-grades.scan.json'), 'x'.repeat(600), { mode: 0o600 }); }, 'SHOT_E_SIZE'],
    ];
    for (const [label, setup, want] of cases) { const r = shotRun(); setup(r); const t0 = Date.now(); const got = EX(r); ok(`SHOTEXPORT ${label}; nothing exported`, got === want && !fs.existsSync(r.exportDir) && Date.now() - t0 < 5000); } }
  { const r = shotRun(); put(r, 'J4c-grades', mkPng());
    const open = shotRun(); fs.chmodSync(open.shots, 0o755); put(open, 'J4c-grades', mkPng());
    ok('SHOTEXPORT a non-private shot dir or an invalid/missing proof refuses', EX(open) === 'SHOT_E_DIR' && EX(r, { proofFile: path.join(r.par, 'none.json') }) === 'SHOT_E_PROOF' && EX(r, { sessionDir: path.join(r.par, 'proof') }) === 'SHOT_E_PROOF');
    const f = path.join(r.shots, 'J4c-grades.png'); const io = (over) => ({ openSync: fs.openSync, fstatSync: fs.fstatSync, readSync: fs.readSync, closeSync: fs.closeSync, ...over });
    const HC = (o) => { try { shotReadHandle(f, 1 << 20, { io: io(o) }); return 'ACCEPTED'; } catch (e) { return e.code; } };
    const resize = (d) => (fd) => { const st = fs.fstatSync(fd); return Object.assign(Object.create(Object.getPrototypeOf(st)), st, { size: st.size + d }); };
    let closed = 0;
    ok('SHOTEXPORT handle: growth, shrink, read error, close error refuse; handle always closed', HC({ fstatSync: resize(-3) }) === 'SHOT_E_GROWTH' && HC({ fstatSync: resize(3) }) === 'SHOT_E_GROWTH'
      && HC({ readSync: () => { throw new Error('EIO'); }, closeSync: (fd) => { closed++; fs.closeSync(fd); } }) === 'SHOT_E_READ' && closed === 1 && HC({ closeSync: (fd) => { fs.closeSync(fd); throw new Error('x'); } }) === 'SHOT_E_CLOSE');
    ok('SHOTEXPORT handle: an endless reader stops at the cap', HC({ fstatSync: resize(0), readSync: (_fd, b, off, len) => { b.fill(1, off, off + len); return len; } }) === 'SHOT_E_SIZE'); }
  // Manifest grammar
  { const L = (n) => `SHOT ${n} sha256=${'c'.repeat(64)} bytes=120 width=1280 height=2400`;
    const SS = (t) => { try { return shotsSummary(t, SHOT_NAMES, WITHHELD_REASONS); } catch (e) { return e.code; } };
    ok('SUM shots manifest (captured and withheld) in allowlist order passes', SS(`WITHHELD J0a-catalog-before-publish reason=CARRIER_ROUTE\n${L('J4d-certificate')}\nSHOTS 1 captured 1 withheld of 16\n`) === `WITHHELD J0a-catalog-before-publish reason=CARRIER_ROUTE\n${L('J4d-certificate')}\nSHOTS 1 captured 1 withheld of 16`);
    { const SFX = 'BEFORE_SAMPLE=1/2/0/0/0/0/0/1/0/0 SCREENSHOT=0/0/0/0/0/0/0/0/0/0 AFTER_SAMPLE=3/0/1/0/1/1/1/1/1/1 FINAL=0/0/0/0/0/0/0/0/0/0 marks=3 sum=EQ';
      ok('SUM a MUTATED withheld line with the fixed diag suffix (or diag=NA) passes unchanged',
        SS(`WITHHELD J2c-submitted-after-reload reason=MUTATED ${SFX}\nWITHHELD J4c-grades reason=MUTATED diag=NA\nSHOTS 0 captured 2 withheld of 16`) === `WITHHELD J2c-submitted-after-reload reason=MUTATED ${SFX}\nWITHHELD J4c-grades reason=MUTATED diag=NA\nSHOTS 0 captured 2 withheld of 16`);
      ok('SUM a suffix on another reason, a malformed suffix (4-digit count, extra field, path, wrong order) refuses',
        [`WITHHELD J4c-grades reason=NAVIGATED ${SFX}`, `WITHHELD J4c-grades reason=MUTATED ${SFX.replace('1/2/', '1000/2/')}`, `WITHHELD J4c-grades reason=MUTATED ${SFX} x=1`,
          `WITHHELD J4c-grades reason=MUTATED ${SFX.replace('marks=3', 'marks=/tmp/x')}`, `WITHHELD J4c-grades reason=MUTATED ${SFX.replace(/^BEFORE_SAMPLE=(\S+) SCREENSHOT=(\S+)/, 'SCREENSHOT=$2 BEFORE_SAMPLE=$1')}`]
          .every((l) => SS(`${l}\nSHOTS 0 captured 1 withheld of 16`) === 'SUMMARY_E_SHOTS_LINE')); }
    ok('SUM shots refusals: out of order, duplicate, unknown name, unknown reason, wrong counts, stray raw line', SS(`${L('J4d-certificate')}\n${L('J0b-detail-before-publish')}\nSHOTS 2 captured 0 withheld of 16`) === 'SUMMARY_E_SHOTS_LINE' && SS(`${L('J4c-grades')}\n${L('J4c-grades')}\nSHOTS 2 captured 0 withheld of 16`) === 'SUMMARY_E_SHOTS_LINE'
      && SS(`${L('J9-other-shot')}\nSHOTS 1 captured 0 withheld of 16`) === 'SUMMARY_E_SHOTS_LINE' && SS('WITHHELD J4c-grades reason=BECAUSE\nSHOTS 0 captured 1 withheld of 16') === 'SUMMARY_E_SHOTS_LINE' && SS(`${L('J4c-grades')}\nSHOTS 0 captured 1 withheld of 16`) === 'SUMMARY_E_SHOTS_SHAPE' && SS(`${L('J4c-grades')}\nMARKER /tmp/x\nSHOTS 2 captured 0 withheld of 16`) === 'SUMMARY_E_SHOTS_LINE'); }

  // ---- Runner, end to end on FAKES: a copy of the tree with fake psql/npx on PATH and an in-process fake API ----
  stage = "Runner, end to end on FAKES: a copy of the tree with fake psql/npx on PATH and an in-process fake API";
  // The copy's ONLY edits: the two D1 pins and the two first-write gate constants point at selftest fakes. Every other
  // byte (runner, producer, private-psql, summaries, SQL, guards) is the real file. Nothing touches a database.
  const http = await import('node:http');
  const fakeBin = fs.mkdtempSync(path.join(tmp, 'fbin-'));
  fs.writeFileSync(path.join(fakeBin, 'psql'), `#!/usr/bin/env node
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const S=process.env.FAKE_STATE, fail=process.env.FAKE_FAIL||'';
const input=fs.readFileSync(0,'utf8');
let op='other'; const inc=input.match(/\\\\i (\\S+)/);
if(inc) op=path.basename(inc[1]); else if(/JOURNEY_ROWS/.test(input)) op='precheck'; else if(/'CARRIER '/.test(input)) op='carrier'; else if(/pg_control_system/.test(input)) op='sysid';
if(op==='witness-journey.sql'){const f=S+'/wcount';const n=fs.existsSync(f)?Number(fs.readFileSync(f,'utf8')):0;fs.writeFileSync(f,String(n+1));op=n===0?'witness-pre':'witness-post';}
const pf=process.env.PGPASSFILE; let pass=null;
if(pf){const st=fs.lstatSync(pf);pass={mode:(st.mode&0o777).toString(8),b64:fs.readFileSync(pf).toString('base64'),dir:path.dirname(pf)};}
fs.appendFileSync(S+'/psql.jsonl',JSON.stringify({op,argv:process.argv.slice(2),pass,dsn:'SUPABASE_DB_URL' in process.env,pgpw:'PGPASSWORD' in process.env})+'\\n');
if(fail===op){process.stdout.write('MARKER-'+op+'-STDOUT\\n');process.stderr.write('MARKER-'+op+'-STDERR\\n');process.exit(3);}
process.stderr.write('MARKER-'+op+'-noise\\n');
const out=(s)=>process.stdout.write(s+'\\n');
if(op==='sysid') out('SYSID 7400000000000000001');
else if(op==='composition.sql'){out('MARKER-composition-noise');out('COMPOSITION '+(process.env.FAKE_COMPOSITION||'composed-r5'));}
else if(op==='precheck') out('JOURNEY_ROWS '+(process.env.FAKE_ROWS||'0'));
else if(op==='pairing-seed.sql'){const m=input.match(/\\\\set pairing '([^']+)'/);fs.writeFileSync(S+'/carrier',m[1]);if(process.env.FAKE_INSERT!=='0') out('PAIRING_INSERTED');}
else if(op==='carrier') out('CARRIER '+fs.readFileSync(S+'/carrier','utf8'));
else if(op==='seed-journey.sql'){const m=input.match(/\\\\set pairing '([^']+)'/);if(!m||m[1]!==fs.readFileSync(S+'/carrier','utf8'))process.exit(4);out('MARKER-seed-noise');out(process.env.FAKE_SEED_PASS);}
else if(op==='witness-pre'||op==='witness-post'){out('MARKER-witness-noise');}
`);
  fs.writeFileSync(path.join(fakeBin, 'npx'), `#!/usr/bin/env node
const fs=require('fs');
fs.appendFileSync(process.env.FAKE_STATE+'/npx.jsonl',JSON.stringify({argv:process.argv.slice(2),cwd:process.cwd()})+'\\n');
process.stderr.write('MARKER-playwright-STDERR\\n');
const m=process.env.FAKE_FAIL;
if(m==='playwright-badjson'){process.stdout.write('MARKER-playwright-not-json');process.exit(1);}
if(m==='playwright-empty'){process.exit(1);}
if(m==='playwright-setup'){const p=require('path');fs.writeFileSync(p.join(process.env.GB_DIAG_DIR,'diag-001.json'),JSON.stringify({code:'JOURNEY_SETUP_E_GOTO_INSTRUCTOR',name:'TimeoutError',message:'MARKER-diag-message http://x'}),{mode:0o600,flag:'wx'});
  process.stdout.write(JSON.stringify({config:{marker:'MARKER'},suites:[],errors:[{message:'JourneyGateError: JOURNEY_SETUP_E_GOTO_INSTRUCTOR',stack:'MARKER-stack',location:{file:p.join(process.cwd(),'e2e/gradebook-roles/journey/session-setup.ts'),line:1,column:1}}],stats:{expected:0,unexpected:0,flaky:0,skipped:0}}));process.exit(1);}
if(m==='playwright-polluted'){process.stdout.write('[journey setup] MARKER\\n'+JSON.stringify({stats:{expected:12,unexpected:0,flaky:0,skipped:0},errors:[]}));process.exit(0);}
const bad=m==='playwright';
{ const crypto=require('crypto'),zlib=require('zlib'),path=require('path');
  const T=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;T[n]=c>>>0;}
  const crc=(b)=>{let c=0xffffffff;for(const x of b)c=T[(c^x)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;};
  const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t,'latin1'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(2,0);ih.writeUInt32BE(1,4);ih[8]=8;ih[9]=2;
  const proof=JSON.parse(fs.readFileSync(process.env.GB_JOURNEY_PAIRING_PROOF,'utf8'));
  const meta=ch('tEXt',Buffer.from('Comment\0MARKER-png-text '+proof.db_read,'latin1'));
  const png=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),ch('IHDR',ih),meta,ch('IDAT',zlib.deflateSync(Buffer.from([0,9,9,9,8,8,8]))),ch('IEND',Buffer.alloc(0))]);
  const mode=process.env.FAKE_SHOTS||'two';
  const d=process.env.GB_SHOT_DIR;
  if(mode!=='none') fs.writeFileSync(path.join(d,'J0a-catalog-before-publish.withheld.json'),JSON.stringify({name:'J0a-catalog-before-publish',withheld:true,reason:'CARRIER_ROUTE'}),{mode:0o600,flag:'wx'});
  if(mode!=='none') for(const name of ['J0b-detail-before-publish','J4d-certificate']){
    fs.writeFileSync(path.join(d,name+'.png'),png,{mode:0o600,flag:'wx'});
    fs.writeFileSync(path.join(d,name+'.scan.json'),JSON.stringify({name,sha256:crypto.createHash('sha256').update(png).digest('hex'),verdict:mode==='dirty'?'dirty':'clean',scans:2,window:'same-document-unchanged'}),{mode:0o600,flag:'wx'});
    if(mode==='stray'){fs.writeFileSync(path.join(d,'MARKER-stray.txt'),'x',{mode:0o600});} } }
process.stdout.write(JSON.stringify({config:{marker:'MARKER-playwright-json'},suites:[],errors:bad?[{message:'MARKER-playwright-error'}]:[],stats:{expected:bad?11:12,unexpected:bad?1:0,flaky:0,skipped:0}}));
process.exit(bad?1:0);
`);
  fs.chmodSync(path.join(fakeBin, 'psql'), 0o755); fs.chmodSync(path.join(fakeBin, 'npx'), 0o755);
  const FAKE_D1 = "import fs from 'node:fs';\nexport function verifyRecord(file, a) { let r; try { r = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { ok: false, code: 'SO_PARSE' }; }\n  if (r.run_id !== String(a.runId) || r.pg_system_identifier !== String(a.liveSystemIdentifier) || r.api_origin !== a.apiOrigin || r.app_origin !== a.appOrigin) return { ok: false, code: 'SO_RUN_MISMATCH' };\n  if (r.bootstrap_sha256 !== a.expectedBootstrapSha256) return { ok: false, code: 'SO_BOOTSTRAP_MISMATCH' };\n  return { ok: true, code: 'SO_OK', record: r }; }\n";
  const FAKE_FIX = '{"fake":true}\n';
  const FAKE_APP = "export async function verifyServedApp({ appOrigin }) { return process.env.FAKE_APP_OK === '1' && appOrigin === 'http://127.0.0.1:4173' ? { ok: true } : { ok: false }; }\n";
  const buildRunnerTree = ({ boot = true, app = true } = {}) => { // boot: true | 'tamper' (record digest is set per run)
    const root = fs.mkdtempSync(path.join(tmp, 'rtree-'));
    for (const d of ['e2e/gradebook-roles', 'scripts/gradebook-fixture']) fs.cpSync(path.join(repo, d), path.join(root, d), { recursive: true });
    for (const f of ['scripts/e2e/assert-safe-target.mjs', 'scripts/local-db/assert-local-dsn.mjs', 'e2e/support/chromium-executable.ts', 'scripts/local-stack/bootstrap.sh', 'supabase/config.toml', 'playwright.gradebook-roles.config.ts']) {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.copyFileSync(path.join(repo, f), path.join(root, f));
    }
    fs.mkdirSync(path.join(root, 'scripts/e2e/fixtures'), { recursive: true });
    fs.writeFileSync(path.join(root, 'scripts/e2e/stack-ownership.mjs'), FAKE_D1);
    fs.writeFileSync(path.join(root, 'scripts/e2e/fixtures/stack-ownership.fake.json'), FAKE_FIX);
    fs.writeFileSync(path.join(root, 'scripts/e2e/fake-served-app-verify.mjs'), FAKE_APP);
    const pf = path.join(root, 'scripts/gradebook-fixture/journey/pairing-producer.mjs');
    let src = fs.readFileSync(pf, 'utf8');
    src = src.replace(/'scripts\/e2e\/stack-ownership\.mjs': '[0-9a-f]{40}'/, `'scripts/e2e/stack-ownership.mjs': '${gitBlobId(Buffer.from(FAKE_D1))}'`)
      .replace(/'scripts\/e2e\/fixtures\/stack-ownership\.fake\.json': '[0-9a-f]{40}'/, `'scripts/e2e/fixtures/stack-ownership.fake.json': '${gitBlobId(Buffer.from(FAKE_FIX))}'`);
    if (boot === 'tamper') fs.appendFileSync(path.join(root, 'scripts/local-stack/bootstrap.sh'), '# drift\n');
    // The copy's served-app pins point at a selftest fake (the shared verifier needs a built dist and a served copy).
    const fb = gitBlobId(Buffer.from(FAKE_APP));
    src = src.replace(/'scripts\/served-app\/served-app-check\.mjs': '[0-9a-f]{40}',\n/, `'scripts/e2e/fake-served-app-verify.mjs': '${fb}',\n`).replace(/  'scripts\/served-app\/hermetic-dist\.mjs': '[0-9a-f]{40}',\n/, '');
    src = src.replace(/^export const SERVED_APP_VERIFIER = Object\.freeze\(.*$/m, app ? `export const SERVED_APP_VERIFIER = Object.freeze({ path: 'scripts/e2e/fake-served-app-verify.mjs', blob: '${fb}' });` : 'export const SERVED_APP_VERIFIER = null;');
    fs.writeFileSync(pf, src);
    return root;
  };
  let apiMode = 'ok', apiState = null; const apiCalls = [];
  const server = http.createServer((req, res) => {
    apiCalls.push({ url: req.url, auth: req.headers.authorization ?? null, method: req.method });
    if (apiMode === '500') { res.statusCode = 500; res.end('MARKER-api-500'); return; }
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    let body = '[]';
    if (id === `eq.${CTRL}`) { let c = ''; try { c = fs.readFileSync(path.join(apiState, 'carrier'), 'utf8'); } catch { /* not inserted */ } body = JSON.stringify(c ? [{ id: CTRL, description: c }] : []); }
    res.setHeader('content-type', 'application/json'); res.end(body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const API_O = `http://127.0.0.1:${server.address().port}`;
  const { spawn } = await import('node:child_process');
  const runRunner = (root, extra = {}) => new Promise((resolve) => {
    const sb = fs.mkdtempSync(path.join(tmp, 'rsb-')); fs.chmodSync(sb, 0o700);
    const st = fs.mkdtempSync(path.join(tmp, 'rst-')); apiState = st; apiCalls.length = 0;
    const rec = path.join(sb, 'stack-ownership.json'); fs.writeFileSync(rec, JSON.stringify({ ...REC, api_origin: API_O, bootstrap_sha256: extra.RECORD_BOOTSTRAP ?? EXPECTED_BOOTSTRAP_SHA256 })); fs.chmodSync(rec, 0o600); delete extra.RECORD_BOOTSTRAP;
    const env = { PATH: `${fakeBin}:${process.env.PATH}`, HOME: process.env.HOME, TMPDIR: sb, RUNNER_TEMP: sb, FAKE_STATE: st, FAKE_SEED_PASS: SEED_PASS,
      SUPABASE_DB_URL: DSN, VITE_SUPABASE_URL: API_O, E2E_RELAY_TARGET: API_O, VITE_SUPABASE_ANON_KEY: 'anon', E2E_BASE_URL: 'http://127.0.0.1:4173',
      E2E_INSTRUCTOR_PASSWORD: 'x', E2E_MEMBER_PASSWORD: 'y', STACK_OWNERSHIP_FILE: rec, GITHUB_RUN_ID: '1000000001', GITHUB_RUN_ATTEMPT: '1', FAKE_APP_OK: '1' };
    for (const [k, v] of Object.entries(extra)) { if (v === undefined) delete env[k]; else env[k] = typeof v === 'function' ? v(sb) : v; }
    const out = path.join(sb, 'evidence');
    const child = spawn('bash', [path.join(root, 'scripts/gradebook-fixture/journey/run-journey.sh'), out], { env });
    let so = '', se = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
    child.stdout.on('data', (b) => { so += b; }); child.stderr.on('data', (b) => { se += b; });
    child.on('close', (rc) => { clearTimeout(timer); resolve({ rc, so, se, sb, st, out }); });
  });
  const ALLOWED = {
    'composition.txt': (s) => s === 'COMPOSITION composed-r5\n',
    'pairing.txt': (s) => s === 'PASS pairing: carrier written through the DSN, read back through the DSN and the anon API\n',
    'seed.txt': (s) => s === `${SEED_PASS}\n`,
    'playwright-summary.txt': (s) => /^PLAYWRIGHT exit=\d+ expected=\d+ unexpected=\d+ flaky=\d+ skipped=\d+ global_errors=\d+\nGLOBAL first=(?:NONE|OTHER|JOURNEY_[A-Z0-9_]+) where=(?:NONE|SETUP|SPEC|CONFIG|OTHER) diag=(?:NONE|OTHER|JOURNEY_[A-Z0-9_]+) diag_class=[A-Za-z]+ diags=\d+\n(?:CASE J[0-4][a-d]? status=[A-Z]+ stage=[A-Z]+ where=[A-Z_]+ line=\d+ cat=[A-Z_]+ obs=[A-Z0-9_:,]+ errors=\d+ all=[A-Z0-9_.,]+ attempts=\d\n){12}CASES known=\d+ unknown=\d+\n$/.test(s),
    'compare.txt': (s) => { try { compareSummary(s); return true; } catch { return false; } },
    'screenshots.txt': (s) => { try { shotsSummary(s, SHOT_NAMES, WITHHELD_REASONS); return true; } catch { return false; } },
    'screenshots': () => true, // checked below against its manifest
  };
  const verdict = (r, rc, err, files) => {
    const staged = fs.existsSync(r.out) ? fs.readdirSync(r.out).sort() : [];
    const isDir = (f) => fs.lstatSync(path.join(r.out, f)).isDirectory();
    const pngs = staged.includes('screenshots') ? fs.readdirSync(path.join(r.out, 'screenshots')).sort() : [];
    const texts = staged.map((f) => isDir(f) ? pngs.map((x) => fs.readFileSync(path.join(r.out, f, x), 'latin1')).join('\n') : fs.readFileSync(path.join(r.out, f), 'utf8'));
    let nonce = ''; try { nonce = fs.readFileSync(path.join(r.st, 'carrier'), 'utf8').split(':')[1] ?? ''; } catch { /* no carrier yet */ }
    const all = [r.so, r.se, ...texts].join('\n');
    const left = fs.readdirSync(r.sb).filter((f) => f.startsWith('gb-journey-run.'));
    const why = [];
    if (r.rc !== rc) why.push(`rc=${r.rc}`);
    if (r.se.trim() !== err) why.push('stderr');
    if (/MARKER|s3cr3t|%3A|postgresql:\/\/|gb-journey-pairing:/.test(all)) why.push('leak');
    if (left.length) why.push('parent-left');
    if (staged.join(',') !== files) why.push(`files=${staged.join(',')}`);
    if (nonce && all.includes(nonce)) why.push('nonce');
    if (staged.some((f, i) => !ALLOWED[f] || !ALLOWED[f](texts[i]))) why.push('content');
    if (staged.includes('screenshots')) {
      const man = fs.readFileSync(path.join(r.out, 'screenshots.txt'), 'utf8').split('\n').filter((l) => l.startsWith('SHOT '));
      const named = man.map((l) => `${l.split(' ')[1]}.png`).sort(); // WITHHELD lines name no file
      if (JSON.stringify(named) !== JSON.stringify(pngs)) why.push('shots-manifest');
      for (const l of man) { const [, n, sh] = l.split(' '); const b = fs.readFileSync(path.join(r.out, 'screenshots', `${n}.png`));
        if (`sha256=${createHash('sha256').update(b).digest('hex')}` !== sh || b.includes(Buffer.from('tEXt')) || (fs.statSync(path.join(r.out, 'screenshots', `${n}.png`)).mode & 0o777) !== 0o600) why.push('shots-bytes'); } }
    return why;
  };
  const RUN = async (name, opts, extra, rc, err, files) => {
    const r = await runRunner(buildRunnerTree(opts), extra);
    const why = verdict(r, rc, err, files);
    ok(`RUNFAKE ${name}${why.length ? ` (${why.join(' ')})` : ''}`, why.length === 0);
    return r;
  };
  try {
    const ALL = 'compare.txt,composition.txt,pairing.txt,playwright-summary.txt,screenshots,screenshots.txt,seed.txt';
    const happy = await RUN('every step on fakes: exit 1 (fake witness fails compare), only the 5 fixed summaries + screenshots manifest + re-encoded PNGs staged, nothing raw, parent removed', {}, {}, 1, '', ALL);
    { const calls = fs.readFileSync(path.join(happy.st, 'psql.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      ok('RUNFAKE psql call order: sysid, composition, precheck, carrier insert, readback, seed, witness pre, witness post', JSON.stringify(calls.map((c) => c.op)) === '["sysid","composition.sql","precheck","pairing-seed.sql","carrier","seed-journey.sql","witness-pre","witness-post"]');
      ok('RUNFAKE every psql argv is -w with plain -h/-p/-U/-d; no password, URI or nonce on any argv', calls.every((c) => JSON.stringify(c.argv) === JSON.stringify(plan.argv)));
      ok('RUNFAKE every psql child had a 0600 passfile in the run private raw dir with exactly the planned line, and no DSN or PGPASSWORD env', calls.every((c) => c.pass && c.pass.mode === '600' && typeof c.pass.b64 === 'string' && Buffer.from(c.pass.b64, 'base64').equals(Buffer.from(plan.passLine)) && /\/gb-journey-run\.[A-Za-z0-9]{10}\/raw$/.test(c.pass.dir) && !c.dsn && !c.pgpw));
      const npx = JSON.parse(fs.readFileSync(path.join(happy.st, 'npx.jsonl'), 'utf8').trim());
      ok('RUNFAKE Playwright gets --reporter=json and a private --output under the run parent', npx.argv.includes('--reporter=json') && npx.argv.some((a) => /^--output=.*\/gb-journey-run\.[A-Za-z0-9]{10}\/raw\/test-results$/.test(a)));
      ok('RUNFAKE J0a reported withheld; two clean shots exported with the tEXt chunk (marker + nonce) dropped; manifest matches bytes', fs.readdirSync(path.join(happy.out, 'screenshots')).join(',') === 'J0b-detail-before-publish.png,J4d-certificate.png' && /^WITHHELD J0a-catalog-before-publish reason=CARRIER_ROUTE\nSHOT J0b-detail-before-publish sha256=[0-9a-f]{64} bytes=\d+ width=2 height=1\nSHOT J4d-certificate sha256=[0-9a-f]{64} bytes=\d+ width=2 height=1\nSHOTS 2 captured 1 withheld of 16\n$/.test(fs.readFileSync(path.join(happy.out, 'screenshots.txt'), 'utf8')));
      ok('RUNFAKE stdout is exactly the staged compare lines plus the Playwright count line', happy.so === `${fs.readFileSync(path.join(happy.out, 'compare.txt'), 'utf8')}PLAYWRIGHT exit=0 expected=12 unexpected=0 flaky=0 skipped=0 global_errors=0\nGLOBAL first=NONE where=NONE diag=NONE diag_class=NONE diags=0\n${ABSENT12}\n`); }
    const apiSeen = [...apiCalls];
    ok('RUNFAKE carrier API reads: GET, anon key only, carrier then random-id control', apiSeen.length === 2 && apiSeen.every((c) => c.method === 'GET' && c.auth === null) && apiSeen[0].url === `/rest/v1/courses?id=eq.${CTRL}&select=id,description` && /^\/rest\/v1\/courses\?id=eq\.[0-9a-f-]{36}&select=id,description$/.test(apiSeen[1].url) && apiSeen[1].url !== apiSeen[0].url);
    { const r = await RUN('bootstrap.sh drifted from its pin: refused at step 0 pins, NO database contact', { boot: 'tamper' }, {}, 3, 'run-journey refused: RUN_E_PIN', '');
      ok('RUNFAKE no psql call at all when the bootstrap file drifts', !fs.existsSync(path.join(r.st, 'psql.jsonl'))); }
    await RUN('record names another bootstrap digest: RUN_E_D1_SO_BOOTSTRAP_MISMATCH', {}, { RECORD_BOOTSTRAP: 'c'.repeat(64) }, 3, 'run-journey refused: RUN_E_D1 RUN_E_D1_SO_BOOTSTRAP_MISMATCH', '');
    await RUN('record copies a job-env digest (not the reviewed constant): refused', {}, { RECORD_BOOTSTRAP: BOOT, GB_D1_BOOTSTRAP_SHA256: BOOT, EXPECTED_BOOTSTRAP_SHA256: BOOT }, 3, 'run-journey refused: RUN_E_D1 RUN_E_D1_SO_BOOTSTRAP_MISMATCH', '');
    { const r = await RUN('served-app verifier unpinned (null) refuses before the carrier INSERT', { app: false }, {}, 3, 'run-journey refused: RUN_E_APP RUN_E_APP_UNVERIFIED', '');
      ok('RUNFAKE only the read-only system identifier was queried before the app gate refused', fs.readFileSync(path.join(r.st, 'psql.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l).op).join(',') === 'sysid'); }
    await RUN('D1 system identifier read fails (marker on psql streams)', {}, { FAKE_FAIL: 'sysid' }, 3, 'run-journey refused: RUN_E_D1 PAIR_E_PSQL', '');
    await RUN('D1 record missing', {}, { STACK_OWNERSHIP_FILE: (sb) => path.join(sb, 'none.json') }, 3, 'run-journey refused: RUN_E_D1 RUN_E_D1_HANDLE_OPEN', '');
    await RUN('D1 record is a FIFO (no hang)', {}, { STACK_OWNERSHIP_FILE: (sb) => { const f = path.join(sb, 'rec.fifo'); execFileSync('mkfifo', ['-m', '600', f]); return f; } }, 3, 'run-journey refused: RUN_E_D1 RUN_E_D1_HANDLE_TYPE', '');
    await RUN('D1 record for another run', {}, { GITHUB_RUN_ID: '1000000009' }, 3, 'run-journey refused: RUN_E_D1 RUN_E_D1_SO_RUN_MISMATCH', '');
    await RUN('served app not verified', {}, { FAKE_APP_OK: '0' }, 3, 'run-journey refused: RUN_E_APP RUN_E_APP_UNVERIFIED', '');
    await RUN('composition psql fails (marker on psql streams)', {}, { FAKE_FAIL: 'composition.sql' }, 3, 'run-journey refused: RUN_E_COMPOSITION', '');
    await RUN('composition is not composed-r5', {}, { FAKE_COMPOSITION: 'baseline-139' }, 3, 'run-journey refused: RUN_E_COMPOSITION', '');
    await RUN('precheck psql fails', {}, { FAKE_FAIL: 'precheck' }, 3, 'run-journey refused: RUN_E_PAIRING PAIR_E_PSQL', 'composition.txt');
    await RUN('used stack (journey rows before pairing)', {}, { FAKE_ROWS: '2' }, 3, 'run-journey refused: RUN_E_PAIRING PAIR_E_USED_STACK', 'composition.txt');
    await RUN('carrier conflict (insert returns no row)', {}, { FAKE_INSERT: '0' }, 3, 'run-journey refused: RUN_E_PAIRING PAIR_E_INSERT', 'composition.txt');
    apiMode = '500';
    await RUN('API readback 500 (marker body)', {}, {}, 3, 'run-journey refused: RUN_E_PAIRING PAIR_E_API_STATUS', 'composition.txt');
    apiMode = 'ok';
    await RUN('seed psql fails', {}, { FAKE_FAIL: 'seed-journey.sql' }, 3, 'run-journey refused: RUN_E_SEED PAIR_E_PSQL', 'composition.txt,pairing.txt');
    await RUN('witness pre fails', {}, { FAKE_FAIL: 'witness-pre' }, 3, 'run-journey refused: RUN_E_WITNESS_PRE', 'composition.txt,pairing.txt,seed.txt');
    await RUN('Playwright report is not JSON (marker)', {}, { FAKE_FAIL: 'playwright-badjson' }, 3, 'run-journey refused: RUN_E_PLAYWRIGHT_SUMMARY SUMMARY_E_PLAYWRIGHT_PARSE', 'composition.txt,pairing.txt,seed.txt');
    { const r = await RUN('Playwright fails (marker in report, stderr and errors): run continues, exit 1, counts only', {}, { FAKE_FAIL: 'playwright' }, 1, '', ALL);
      ok('RUNFAKE failed Playwright summary is the fixed count line', fs.readFileSync(path.join(r.out, 'playwright-summary.txt'), 'utf8') === `PLAYWRIGHT exit=1 expected=11 unexpected=1 flaky=0 skipped=0 global_errors=1\nGLOBAL first=OTHER where=NONE diag=NONE diag_class=NONE diags=0\n${ABSENT12}\n`); }
    { const r = await RUN('global setup fails (gate code + private diag with marker message): code, place and diag class staged before cleanup', {}, { FAKE_FAIL: 'playwright-setup' }, 1, '', ALL);
      const t = fs.readFileSync(path.join(r.out, 'playwright-summary.txt'), 'utf8');
      ok('RUNFAKE setup failure staged as fixed code/place/diag class, zero cases, no marker', t === `PLAYWRIGHT exit=1 expected=0 unexpected=0 flaky=0 skipped=0 global_errors=1\nGLOBAL first=JOURNEY_SETUP_E_GOTO_INSTRUCTOR where=SETUP diag=JOURNEY_SETUP_E_GOTO_INSTRUCTOR diag_class=TimeoutError diags=1\n${ABSENT12}\n` && !(r.so + r.se).includes('MARKER')); }
    await RUN('Playwright wrote no report (config load or start failure)', {}, { FAKE_FAIL: 'playwright-empty' }, 3, 'run-journey refused: RUN_E_PLAYWRIGHT_SUMMARY SUMMARY_E_PLAYWRIGHT_EMPTY', 'composition.txt,pairing.txt,seed.txt');
    await RUN('stray runner stdout in front of the report', {}, { FAKE_FAIL: 'playwright-polluted' }, 3, 'run-journey refused: RUN_E_PLAYWRIGHT_SUMMARY SUMMARY_E_PLAYWRIGHT_POLLUTED', 'composition.txt,pairing.txt,seed.txt');
    await RUN('witness post fails', {}, { FAKE_FAIL: 'witness-post' }, 3, 'run-journey refused: RUN_E_WITNESS_POST', 'composition.txt,pairing.txt,playwright-summary.txt,screenshots,screenshots.txt,seed.txt');
    await RUN('a dirty scan record in the shot dir refuses the export (nothing staged from it)', {}, { FAKE_SHOTS: 'dirty' }, 3, 'run-journey refused: RUN_E_SHOTS', 'composition.txt,pairing.txt,playwright-summary.txt,seed.txt');
    await RUN('a stray file in the shot dir refuses the export', {}, { FAKE_SHOTS: 'stray' }, 3, 'run-journey refused: RUN_E_SHOTS', 'composition.txt,pairing.txt,playwright-summary.txt,seed.txt');
    { const r = await RUN('no screenshots taken: empty screenshots dir, manifest SHOTS 0 of 16', {}, { FAKE_SHOTS: 'none' }, 1, '', ALL);
      ok('RUNFAKE zero-shot manifest is exactly the count line', fs.readFileSync(path.join(r.out, 'screenshots.txt'), 'utf8') === 'SHOTS 0 captured 0 withheld of 16\n'); }
  } finally { server.close(); }

  // ---- Runner refusals on THIS tree that need no stack ----
  stage = "Runner refusals on THIS tree that need no stack";
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
  stage = "Static contract: real tree PASS, each mutation FAILS its own rule";
  const real = checkJourney(repo);
  ok(`SC real tree passes (${real.length ? real.join('; ') : 'no violations'})`, real.length === 0);
  const copyTree = () => {
    const root = fs.mkdtempSync(path.join(tmp, 'tree-'));
    for (const d of ['e2e/gradebook-roles', 'e2e/gradebook-roles/journey', 'scripts/gradebook-fixture/journey', 'scripts/gradebook-fixture/journey/tests']) {
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
    ['producer D1 drops the API origin check', `${S}/pairing-producer.mjs`, (s) => s.replace("  if (record.api_origin !== o.apiOrigin) return ['RUN_E_D1_API_ORIGIN'];\n", ''), 'R11_PRODUCER_D1_WEAK'],
    ['producer D1 trusts disposable', `${S}/pairing-producer.mjs`, (s) => s.replace("  const record = r.record;", "  const record = r.record;\n  if (record && record.disposable === true) return [];"), 'R11_PRODUCER_D1_WEAK'],
    ['producer D1 accepts ok without SO_OK', `${S}/pairing-producer.mjs`, (s) => s.replace("r.ok !== true || r.code !== 'SO_OK'", "r.ok !== true"), 'R11_PRODUCER_D1_WEAK'],
    ['producer D1 module unpinned', `${S}/pairing-producer.mjs`, (s) => s.replace("'scripts/e2e/stack-ownership.mjs': 'ea39300dda9673b66fc6918b75929ca1b5e5d467',", ''), 'R11_D1_NOT_PINNED'],
    ['runner hides the D1 refusal code', `${S}/run-journey.sh`, (s) => s.replace('step RUN_E_D1 ownership', 'true RUN_E_D1 ownership'), 'R11_RUNNER_NO_D1'],
    ['runner skips the served-app gate', `${S}/run-journey.sh`, (s) => s.replace(/^step RUN_E_APP appverify .*$/m, ''), 'R11_RUNNER_NO_D1'],
    ['runner passes the DSN to psql on argv', `${S}/run-journey.sh`, (s) => s.replace('node "$HERE/private-psql.mjs" run "$RAW" "$GB/composition.sql" "$RAW/composition.raw"', 'psql "$SUPABASE_DB_URL" -f "$GB/composition.sql" > "$RAW/composition.raw"; true'), 'R11_RUNNER_DSN_ARGV'],
    ['runner stages raw Playwright output', `${S}/run-journey.sh`, (s) => s.replace('cp "$RAW/playwright-summary.out" "$OUT/playwright-summary.txt"', 'cp "$RAW/playwright.json" "$OUT/playwright-summary.txt"'), 'R11_RUNNER_RAW_STAGED'],
    ['producer D1 opens blocking (no O_NONBLOCK)', `${S}/pairing-producer.mjs`, (s) => s.replace(/ \| \(fs\.constants\.O_NONBLOCK \?\? 0\)| \| fs\.constants\.O_NONBLOCK/, ''), 'R11_PRODUCER_D1_WEAK'],
    ['producer D1 drops the bootstrap pin to the verifier', `${S}/pairing-producer.mjs`, (s) => s.replace(', expectedBootstrapSha256: o.expectedBootstrapSha256 })', ' })'), 'R11_PRODUCER_D1_WEAK'],
    ['bootstrap identity pinned to an arbitrary value', `${S}/pairing-producer.mjs`, (s) => s.replace(/^export const EXPECTED_BOOTSTRAP_SHA256 = '[0-9a-f]{64}';$/m, `export const EXPECTED_BOOTSTRAP_SHA256 = '${'0'.repeat(64)}';`), 'R11_GATES_NOT_FAIL_CLOSED'],
    ['bootstrap identity read from the job env', `${S}/pairing-producer.mjs`, (s) => s.replace(/^export const EXPECTED_BOOTSTRAP_SHA256 = '[0-9a-f]{64}';$/m, "export const EXPECTED_BOOTSTRAP_SHA256 = process.env.GB_D1_BOOTSTRAP_SHA256;"), 'R11_GATES_NOT_FAIL_CLOSED'],
    ['bootstrap digest not re-hashed from the pinned file', `${S}/pairing-producer.mjs`, (s) => s.replace("    if (bootstrapFileSha256(root) !== EXPECTED_BOOTSTRAP_SHA256) throw new PairError('RUN_E_D1_BOOTSTRAP_FILE');\n", ''), 'R11_GATES_NOT_FAIL_CLOSED'],
    ['bootstrap.sh unpinned', `${S}/pairing-producer.mjs`, (s) => s.replace("  'scripts/local-stack/bootstrap.sh': 'aa34aa297e3ec1a214e33ebb09fc934f6991cbaa',\n", ''), 'R11_GATES_NOT_FAIL_CLOSED'],
    ['served-app verifier swapped for another module', `${S}/pairing-producer.mjs`, (s) => s.replace(/^export const SERVED_APP_VERIFIER = Object\.freeze\(.*$/m, "export const SERVED_APP_VERIFIER = Object.freeze({ path: 'x.mjs', blob: '0000000000000000000000000000000000000000' });"), 'R11_GATES_NOT_FAIL_CLOSED'],
    ['served-app gate back to null', `${S}/pairing-producer.mjs`, (s) => s.replace(/^export const SERVED_APP_VERIFIER = Object\.freeze\(.*$/m, 'export const SERVED_APP_VERIFIER = null;'), 'R11_GATES_NOT_FAIL_CLOSED'],
    ['hermetic-dist import unpinned', `${S}/pairing-producer.mjs`, (s) => s.replace(/  'scripts\/served-app\/hermetic-dist\.mjs': '[0-9a-f]{40}',\n/, ''), 'R11_GATES_NOT_FAIL_CLOSED'],
    ['appverify skips the pin re-check', `${S}/pairing-producer.mjs`, (s) => s.replace("  if (cmd === 'appverify') {\n    const f = pinFailures(root);", "  if (cmd === 'appverify') {\n    const f = [];"), 'R11_GATES_NOT_FAIL_CLOSED'],
    ['producer spawns psql itself', `${S}/pairing-producer.mjs`, (s) => s.replace("import fs from 'node:fs';", "import fs from 'node:fs';\nimport { spawnSync } from 'node:child_process';"), 'R11_PRODUCER_DSN_ARGV'],
    ['captureShot captures without the pre-scan gate', `${J}/shot-core.mjs`, (s) => s.replace('    if (scanPage(before.texts, secrets).length === 0) {            // a dirty page is never captured', '    {'), 'R12_SHOT_WINDOW'],
    ['captureShot samples BEFORE arming the guard (the 945246b order)', `${J}/shot-core.mjs`, (s) => s.replace("    await drv.guard('arm', armed);\n    before = await drv.sample();", "    before = await drv.sample();\n    await drv.guard('arm', armed);"), 'R12_SHOT_WINDOW'],
    ['captureShot reads the guard BEFORE the after sample', `${J}/shot-core.mjs`, (s) => s.replace("      after = await drv.sample();\n", "      guard = await drv.guard('read', armed);\n      after = await drv.sample();\n"), 'R12_SHOT_WINDOW'],
    ['captureShot watches navigation only after the first sample', `${J}/shot-core.mjs`, (s) => s.replace("  const unwatch = drv.watchNav(() => { navigations += 1; });\n", "  let unwatch = () => {};\n").replace("    await drv.guard('arm', armed);\n    before = await drv.sample();", "    await drv.guard('arm', armed);\n    before = await drv.sample();\n    unwatch = drv.watchNav(() => { navigations += 1; });"), 'R12_SHOT_WINDOW'],
    ['captureShot skips the guard read on an exception (no finally)', `${J}/shot-core.mjs`, (s) => s.replace("  } catch { failed = true; } finally {\n    try { guard = await drv.guard('read', armed); } catch { failed = true; }\n    unwatch();\n  }", "    guard = await drv.guard('read', armed);\n    unwatch();\n  } catch { failed = true; }"), 'R12_SHOT_WINDOW'],
    ['captureShot keeps the buffer after an exception', `${J}/shot-core.mjs`, (s) => s.replace('  if (failed || !guard) return { png: null, obs: { ...base, incomplete: true } };', '  if (failed || !guard) return { png, obs: { ...base, incomplete: true } };'), 'R12_SHOT_WINDOW'],
    ['guard read only disconnects the observer (the 945246b read)', `${J}/shot-core.mjs`, (s) => s.replace('  for (const ev of EVENTS) w.removeEventListener(ev, st.bump, true);\n', ''), 'R12_SHOT_GUARD_DETACH'],
    ['guard read drops pending mutation records', `${J}/shot-core.mjs`, (s) => s.replace('  st.n += st.tally(st.obs.takeRecords());\n  st.obs.disconnect();', '  st.obs.disconnect();'), 'R12_SHOT_GUARD_DETACH'],
    ['the diagnostic mark rethrows (a failed mark would become INCOMPLETE)', `${J}/shot-core.mjs`, (s) => s.replace('if (r && r.phase > 0) marks += 1; } catch { /* diagnostic only */ } };', 'if (r && r.phase > 0) marks += 1; } catch (e) { throw e; } };'), 'R12_SHOT_WINDOW'],
    ['a mark is sent before the first sample', `${J}/shot-core.mjs`, (s) => s.replace("    await drv.guard('arm', armed);\n    before = await drv.sample();", "    await drv.guard('arm', armed);\n    await mark('S');\n    before = await drv.sample();"), 'R12_SHOT_WINDOW'],
    ['guard read returns without its phase tallies dropped from n (read no longer adds drained records)', `${J}/shot-core.mjs`, (s) => s.replace('  st.n += st.tally(st.obs.takeRecords());\n  st.obs.disconnect();', '  st.tally(st.obs.takeRecords());\n  st.obs.disconnect();'), 'R12_SHOT_GUARD_DETACH'],
    ['shot() bypasses captureShot with its own screenshot', `${J}/observe.ts`, (s) => s.replace("  const { png, obs } = await captureShot(drv, base, randomBytes(16).toString('hex'), secrets);", "  const png = await page.screenshot({ fullPage: true, animations: 'disabled' }); const obs = { ...base, incomplete: true };"), 'R12_SHOT_UNSCANNED'],
    ['shot() attaches the raw capture again', `${J}/observe.ts`, (s) => s.replace('  writeShot(dir, name, png, obs, secrets);\n}', "  await info.attach(`${name}.png`, { body: png ?? Buffer.alloc(0), contentType: 'image/png' });\n  writeShot(dir, name, png, obs, secrets);\n}"), 'R12_SHOT_UNSCANNED'],
    ['a second page script appears', `${J}/observe.ts`, (s) => s.replace("    sample: () => sample(page),", "    sample: () => sample(page),\n    x: () => page.evaluate(() => 1),"), 'R3_EVALUATE'],
    ['decision skips the mutation check', `${J}/shot-core.mjs`, (s) => s.replace("  if (obs.guard.n !== 0) return no('MUTATED');\n", ''), 'R12_SHOT_DECISION'],
    ['decision skips the route check', `${J}/shot-core.mjs`, (s) => s.replace(/  if \(u\.origin !== obs\.appOrigin.*\n/, ''), 'R12_SHOT_DECISION'],
    ['J0a no longer withheld by rule', `${J}/shot-core.mjs`, (s) => s.replace("export const WITHHOLD_ALWAYS = Object.freeze({ 'J0a-catalog-before-publish': 'CARRIER_ROUTE' });", 'export const WITHHOLD_ALWAYS = Object.freeze({});'), 'R12_SHOT_DECISION'],
    ['guard writes to the page', `${J}/shot-core.mjs`, (s) => s.replace('    w.__gbShotGuard = st;\n    return token;', "    w.__gbShotGuard = st;\n    document.body.setAttribute('data-x', '1');\n    return token;"), 'R12_SHOT_GUARD_WRITES'],
    ['a plan route key observe.ts cannot resolve', `${J}/shot-core.mjs`, (s) => s.replace("'J4c-grades': ['jr-4-learner-readback', 'grades'],", "'J4c-grades': ['jr-4-learner-readback', 'gradebook'],"), 'R12_SHOT_ROUTES'],
    ['a spec takes its own screenshot', `${J}/j4-learner-readback-certificate.spec.ts`, (s) => s.replace("await shot(page, info, 'J4d-certificate');", "await shot(page, info, 'J4d-certificate');\n  await page.screenshot({ path: 'x.png' });"), 'R12_SHOT_UNSCANNED'],
    ['allowlist gains a name no spec uses', `${J}/shot-core.mjs`, (s) => s.replace("'J4d-certificate',\n]);", "'J4d-certificate', 'J9-anything',\n]);"), 'R12_SHOT_ALLOWLIST'],
    ['scan drops the anon key', `${J}/shot-core.mjs`, (s) => s.replace("'E2E_MEMBER_PASSWORD', 'VITE_SUPABASE_ANON_KEY']", "'E2E_MEMBER_PASSWORD']"), 'R12_SHOT_SCAN_WEAK'],
    ['scan drops the nonce', `${J}/shot-core.mjs`, (s) => s.replace("{ label: 'NONCE', value: proof.stack_id }, ", ''), 'R12_SHOT_SCAN_WEAK'],
    ['export keeps ancillary chunks', `${S}/shot-export.mjs`, (s) => s.replace('      // ancillary (lower-case first letter): dropped, never copied', '      else kept.push(whole); // ancillary kept'), 'R12_SHOT_EXPORT_WEAK'],
    ['export trusts any CRITICAL set', `${S}/shot-export.mjs`, (s) => s.replace("const CRITICAL = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND']);", "const CRITICAL = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'zTXt']);"), 'R12_SHOT_EXPORT_WEAK'],
    ['export skips the nonce byte check', `${S}/shot-export.mjs`, (s) => s.replace('const forbidden = [Buffer.from(proof.stack_id), Buffer.from(PAIRING_PREFIX)];', 'const forbidden = [];'), 'R12_SHOT_EXPORT_WEAK'],
    ['readPrivateJson goes back to lstat-then-read-path', `${J}/private-dir.mjs`, (s) => s.replace("else text = fs.readFileSync(fd, 'utf8');", "else { fs.lstatSync(p); text = fs.readFileSync(p, 'utf8'); }"), 'R13_FILE_RACE'],
    ['readRaw drops O_NOFOLLOW', `${S}/run-summary.mjs`, (s) => s.replace("fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0))", "fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0))"), 'R13_FILE_RACE'],
    ['readRaw re-reads the path', `${S}/run-summary.mjs`, (s) => s.replace("  try { return new TextDecoder('utf-8').decode(buf); }", "  try { return fs.readFileSync(file, 'utf8'); }"), 'R13_FILE_RACE'],
    ['readHandle catch back to the useless conditional', `${S}/shot-export.mjs`, (s) => s.replace("  } catch { err = 'SHOT_E_READ'; }", "  } catch { err = err ?? 'SHOT_E_READ'; }"), 'R13_USELESS_CONDITIONAL'],
    ['export ignores the scan sha256', `${S}/shot-export.mjs`, (s) => s.replace("!== rec.sha256) throw new ShotError('SHOT_E_SCAN_MISMATCH')", "!== rec.sha256) void 0"), 'R12_SHOT_EXPORT_WEAK'],
    ['runner stages the raw shot dir', `${S}/run-journey.sh`, (s) => s.replace('mv "$RAW/shots-export" "$OUT/screenshots"', 'cp -r "$PARENT/shots" "$OUT/screenshots"'), 'R11_RUNNER_RAW_STAGED'],
    ['runner skips the shot export', `${S}/run-journey.sh`, (s) => s.replace(/^node "\$HERE\/shot-export\.mjs".*$/m, 'true'), 'R11_RUNNER_ORDER'],
    ['private psql sets PGPASSFILE only when there is a password', `${S}/private-psql.mjs`, (s) => s.replace('\n    plan.env.PGPASSFILE = passFile;\n', '\n    if (plan.passLine) plan.env.PGPASSFILE = passFile;\n'), 'R11_PSQL_NOT_PRIVATE'],
    ['private psql plans null for a passwordless DSN again', `${S}/private-psql.mjs`, (s) => s.replace("passLine: pw === null ? '' :", 'passLine: pw === null ? null :'), 'R11_PSQL_NOT_PRIVATE'],
    ['private psql drops -w', `${S}/private-psql.mjs`, (s) => s.replace("'-At', '-w',", "'-At',"), 'R11_PSQL_NOT_PRIVATE'],
    ['binding passes the DSN on argv', 'e2e/gradebook-roles/local-binding.mjs', (s) => s.replace("import path from 'node:path';", "import path from 'node:path';\nimport { execFileSync } from 'node:child_process';"), 'R11_BINDING_DSN_ARGV'],
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
} catch (e) {
  const name = e instanceof Error && ABORT_NAMES.has(e.name) ? e.name : 'OTHER';
  const code = e?.code === undefined ? '' : ` code=${ABORT_CODES.has(e.code) ? e.code : 'OTHER'}`;
  const status = Number.isInteger(e?.status) && e.status >= 0 && e.status <= 255 ? ` status=${e.status}` : '';
  aborted = `${name}${code}${status}`;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
if (aborted !== null) {
  console.log(`FAIL journey selftest: ABORTED in stage ${JSON.stringify(stage)} (${aborted}) after ${pass} ok, ${fail} failed`);
  process.exit(1);
}
console.log(`${fail === 0 ? 'PASS' : 'FAIL'} journey selftest: ${pass} ok, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
