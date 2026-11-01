// ABOUTME: Local fake/unit selftest for the journey proposal (no stack, no network, no browser). Gate 1 and gate 3 checkers on
// ABOUTME: temp files, and the static contract on the real tree (must PASS) and on mutated copies (each must FAIL its own rule).
// Usage: node scripts/gradebook-fixture/journey/tests/journey-selftest.mjs   (exit 0 only if every case behaves)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertPrivateSessionDir, writePrivateFile } from '../../../../e2e/gradebook-roles/journey/private-dir.mjs';
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

  // ---- Gate 3: pairing proof consumer ----
  const sid = 'a'.repeat(32);
  const proof = (obj, mode = 0o600) => { const f = path.join(tmp, `proof-${Math.random().toString(16).slice(2)}.json`); fs.writeFileSync(f, JSON.stringify(obj)); fs.chmodSync(f, mode); return f; };
  const base = { version: 1, stack_id: sid, db_read: sid, api_read: sid, produced_before_seed: true };
  ok('G3 matched proof accepted', code(() => assertPairingProof(proof(base))) === 'ACCEPTED');
  ok('G3 no proof refused (the current state: producer not built)', code(() => assertPairingProof(undefined)) === 'JOURNEY_GATE3_E_NO_PROOF');
  ok('G3 missing file refused', code(() => assertPairingProof(path.join(tmp, 'none.json'))) === 'JOURNEY_GATE3_E_NO_PROOF');
  ok('G3 0644 proof refused', code(() => assertPairingProof(proof(base, 0o644))) === 'JOURNEY_GATE3_E_MODE');
  ok('G3 API read differs refused', code(() => assertPairingProof(proof({ ...base, api_read: 'b'.repeat(32) }))) === 'JOURNEY_GATE3_E_API_MISMATCH');
  ok('G3 DB read differs refused', code(() => assertPairingProof(proof({ ...base, db_read: 'b'.repeat(32) }))) === 'JOURNEY_GATE3_E_DB_MISMATCH');
  ok('G3 produced after seed refused', code(() => assertPairingProof(proof({ ...base, produced_before_seed: false }))) === 'JOURNEY_GATE3_E_ORDER');
  ok('G3 short stack id refused', code(() => assertPairingProof(proof({ ...base, stack_id: 'abc', db_read: 'abc', api_read: 'abc' }))) === 'JOURNEY_GATE3_E_STACK_ID');
  ok('G3 extra field refused', code(() => assertPairingProof(proof({ ...base, note: 'x' }))) === 'JOURNEY_GATE3_E_SHAPE');
  const bad = path.join(tmp, 'bad.json'); fs.writeFileSync(bad, '{not json'); fs.chmodSync(bad, 0o600);
  ok('G3 unparsable refused', code(() => assertPairingProof(bad)) === 'JOURNEY_GATE3_E_PARSE');

  // ---- Static contract: real tree PASS, each mutation FAILS its own rule ----
  const real = checkJourney(repo);
  ok(`SC real tree passes (${real.length ? real.join('; ') : 'no violations'})`, real.length === 0);
  const copyTree = () => {
    const root = fs.mkdtempSync(path.join(tmp, 'tree-'));
    for (const d of ['e2e/gradebook-roles/journey', 'scripts/gradebook-fixture/journey']) {
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
    ['spec PATCHes the grade through the API', `${J}/j3-instructor-grade.spec.ts`, (s) => s.replace("await page.getByRole('button', { name: /^Save$/ }).click();", "await page.request.patch('http://127.0.0.1:54321/rest/v1/assignment_submissions', { data: { grade: 7 } });"), 'R3_OWN_REQUEST'],
    ['spec mocks the API', `${J}/j2-learner-enroll-submit.spec.ts`, (s) => s.replace("test.describe.configure({ mode: 'serial' });", "test.describe.configure({ mode: 'serial' });\ntest.beforeEach(async ({ page }) => { await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 201, body: '[]' })); });"), 'R3_MOCKED_API'],
    ['spec writes through the supabase client', `${J}/j2-learner-enroll-submit.spec.ts`, (s) => s.replace("test.describe.configure({ mode: 'serial' });", "test.describe.configure({ mode: 'serial' });\nconst x = () => supabase.from('enrollments');"), 'R3_CLIENT_SHORTCUT'],
    ['spec reads the service key', `${J}/j1-instructor-publish.spec.ts`, (s) => s.replace("test.describe.configure({ mode: 'serial' });", "test.describe.configure({ mode: 'serial' });\nconst k = process.env.SUPABASE_SERVICE_ROLE_KEY;"), 'R3_SERVICE_KEY'],
    ['spec logs a URL', `${J}/j4-learner-readback-certificate.spec.ts`, (s) => s.replace('await popup.close();', 'console.log(popup.url());\n  await popup.close();'), 'R3_URL_OR_LOG'],
    ['spec evaluates in page', `${J}/j2-learner-enroll-submit.spec.ts`, (s) => s.replace("test.describe.configure({ mode: 'serial' });", "test.describe.configure({ mode: 'serial' });\nconst e = (page: any) => page.evaluate(() => 1);"), 'R3_EVALUATE'],
    ['a pass threshold is invented', `${J}/ids.ts`, (s) => s + '\nexport const PASSING_SCORE = 7;\n', 'R4_GRADE_THRESHOLD'],
    ['ts id drifts from the seed', `${J}/ids.ts`, (s) => s.replace("assignment: '9b6c0000-0000-4000-8000-000000000202'", "assignment: '9b6c0000-0000-4000-8000-000000000299'"), 'R5_TS_ID_NOT_SEEDED_299'],
    ['grading fixture id leaks into the journey', `${J}/j3-instructor-grade.spec.ts`, (s) => s + "\nconst g = '9b6b0000-0000-4000-8000-000000000302';\n", 'R5_GRADING_FIXTURE_ID'],
    ['hosted project ref appears', `${J}/ids.ts`, (s) => s + "\nexport const H = 'https://siuqvhscuiycvdrtiqsh.supabase.co';\n", 'R5_HOSTED_REF'],
    ['gate 3 moved after sign-in', `${J}/session-setup.ts`, (s) => s.replace('  assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF);\n', '').replace("    if (res.status !== 200)", '    assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF);\n    if (res.status !== 200)'), 'R6_GATES_AFTER_SIGNIN'],
    ['session saved non-exclusively', `${J}/session-setup.ts`, (s) => s.replace('const state = await context.storageState();', "const state = await context.storageState({ path: 'x.json' });"), 'R6_NON_EXCLUSIVE_SESSION_WRITE'],
    ['error leaks the response body', `${J}/session-setup.ts`, (s) => s.replace('`JOURNEY_SETUP_E_SIGNIN_HTTP_${res.status}_${role.toUpperCase()}`', '`JOURNEY_SETUP_E_SIGNIN_HTTP ${await res.text()}`'), 'R6_UNSANITIZED_ERROR'],
  ];
  for (const [name, rel, fn, rule] of cases) {
    const v = mutate(rel, fn);
    ok(`SC causal: ${name} -> ${rule}`, v.some((x) => x.startsWith(rule)));
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${fail === 0 ? 'PASS' : 'FAIL'} journey selftest: ${pass} ok, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
