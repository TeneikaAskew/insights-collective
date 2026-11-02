// ABOUTME: Local static contract for the no-quiz journey proposal (no stack, no network). Checks that the seed only inserts the
// ABOUTME: course shell, the witness is read-only, specs never send their own writes or mock the API, and ids line up.
// Usage: node scripts/gradebook-fixture/journey/tests/static-contract.mjs [--root <repo>]   (exit 0 PASS, 1 FAIL)
// Prints rule codes and file names only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JOURNEY_SPECS = [
  'j0-learner-before-publish.spec.ts', 'j1-instructor-publish.spec.ts', 'j2-learner-enroll-submit.spec.ts',
  'j3-instructor-grade.spec.ts', 'j4-learner-readback-certificate.spec.ts',
];
const SEED_TABLES = new Set(['public.courses', 'public.modules', 'public.content_items', 'public.assignments']);

const stripSqlComments = (s) => s.replace(/--[^\n]*/g, '');
const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** @param {string} root @returns {string[]} violations as "CODE file" */
export function checkJourney(root) {
  const v = [];
  const rd = (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { v.push(`MISSING ${rel}`); return ''; } };
  const jdir = 'e2e/gradebook-roles/journey';
  const sdir = 'scripts/gradebook-fixture/journey';

  // R1 seed: inserts into the four shell tables only; nothing that writes elsewhere or changes behaviour.
  const seedRaw = rd(`${sdir}/seed-journey.sql`);
  const seed = stripSqlComments(seedRaw).toLowerCase();
  if (/\b(delete|truncate|drop|alter|grant|revoke|copy)\b/.test(seed) || /\bupdate\s+(public\.|storage\.|auth\.)/.test(seed)) v.push('R1_SEED_NON_INSERT_WRITE seed-journey.sql');
  if (/\bcreate\s+(or\s+replace\s+)?(policy|function|trigger|table|view|rule|extension)\b/.test(seed)) v.push('R1_SEED_DDL seed-journey.sql');
  if (/service_role|set_config\s*\(/.test(seed)) v.push('R1_SEED_CLAIMS seed-journey.sql');
  for (const m of seed.matchAll(/insert\s+into\s+([a-z_.]+)/g)) if (!SEED_TABLES.has(m[1])) v.push(`R1_SEED_TABLE_${m[1]} seed-journey.sql`);
  if (!/journey seed refused/.test(seed)) v.push('R1_SEED_NO_PRISTINE_REFUSAL seed-journey.sql');
  if (!/published\s*,\s*status\s*,\s*instructor_id\)\s*values\s*\([^)]*false,\s*'draft'/.test(seed)) v.push('R1_SEED_COURSE_NOT_DRAFT seed-journey.sql');
  if (!/journey_paired/.test(seed) || !/description = :'pairing'/.test(seed)) v.push('R1_SEED_NOT_BOUND_TO_PAIRING seed-journey.sql');
  if (/'9b6c0000-0000-4000-8000-000000000011',\s*'journey control course'/.test(seed)) v.push('R1_SEED_INSERTS_CARRIER seed-journey.sql');
  const pairSeedRaw = rd(`${sdir}/pairing-seed.sql`);
  const pairSeed = stripSqlComments(pairSeedRaw).toLowerCase();
  if (/\b(delete|truncate|drop|alter|grant|revoke|copy|update|create)\b/.test(pairSeed) || /service_role|set_config\s*\(/.test(pairSeed)) v.push('R1_PAIRING_NON_INSERT pairing-seed.sql');
  const pairIns = [...pairSeed.matchAll(/insert\s+into\s+([a-z_.]+)/g)].map((m) => m[1]);
  if (pairIns.length !== 1 || pairIns[0] !== 'public.courses' || !/values\s*\('9b6c0000-0000-4000-8000-000000000011',[^;]*:'pairing'[^;]*true,\s*'published'/.test(pairSeed) || !/on conflict \(id\) do nothing\s+returning 'pairing_inserted'/.test(pairSeed)) v.push('R1_PAIRING_NOT_CARRIER_ONLY pairing-seed.sql');

  // R2 witness: read-only.
  const wit = stripSqlComments(rd(`${sdir}/witness-journey.sql`)).toLowerCase();
  if (/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|copy|set_config)\b/.test(wit)) v.push('R2_WITNESS_WRITES witness-journey.sql');

  // R3 specs: UI-driven only. No own writes, no API mocking, no client shortcuts, no service key, no URL logging.
  for (const f of [...JOURNEY_SPECS, 'observe.ts', 'observe-core.mjs', 'progress-oracle.ts']) {
    const src = stripJsComments(rd(`${jdir}/${f}`));
    if (/\.request\.(post|patch|put|delete|fetch)\s*\(|request\.newContext|\bfetch\s*\(/.test(src)) v.push(`R3_OWN_REQUEST ${f}`);
    if (/\.route\s*\(|\.fulfill\s*\(|routeFromHAR/.test(src)) v.push(`R3_MOCKED_API ${f}`);
    if (/supabase\s*\.\s*(from|rpc|storage|auth)|createClient\s*\(/.test(src)) v.push(`R3_CLIENT_SHORTCUT ${f}`);
    if (/service_role|SERVICE_ROLE|SUPABASE_SERVICE/.test(src)) v.push(`R3_SERVICE_KEY ${f}`);
    if (/createSignedUrl|console\.(log|info|warn|error)\s*\(/.test(src)) v.push(`R3_URL_OR_LOG ${f}`);
    if (/page\.evaluate\s*\(/.test(src)) v.push(`R3_EVALUATE ${f}`);
  }

  // R4 no invented grade/pass threshold anywhere in the journey lane.
  for (const f of [...JOURNEY_SPECS, 'ids.ts', 'observe.ts', 'progress-oracle.ts']) {
    if (/pass(ing)?[_ -]?(score|grade|threshold|mark)|min(imum)?[_ -]?grade/i.test(stripJsComments(rd(`${jdir}/${f}`)))) v.push(`R4_GRADE_THRESHOLD ${f}`);
  }

  // R5 ids: the journey namespace only; the TS ids equal the seed ids; no hosted refs.
  const ids = rd(`${jdir}/ids.ts`);
  const tsIds = [...ids.matchAll(/'(9b6c0000-0000-4000-8000-[0-9a-f]{12})'/g)].map((m) => m[1]).sort();
  const seedIds = new Set([...(seedRaw + pairSeedRaw).matchAll(/'(9b6c0000-0000-4000-8000-[0-9a-f]{12})'/g)].map((m) => m[1]));
  if (tsIds.length !== 8) v.push('R5_TS_ID_COUNT ids.ts');
  for (const id of tsIds) if (!seedIds.has(id)) v.push(`R5_TS_ID_NOT_SEEDED_${id.slice(-3)} ids.ts`);
  for (const f of [...JOURNEY_SPECS, 'ids.ts', 'observe.ts', 'session-setup.ts']) {
    const s = rd(`${jdir}/${f}`);
    if (/9b6b0000-0000-4000-8000-/.test(s)) v.push(`R5_GRADING_FIXTURE_ID ${f}`);
    if (/supabase\.co|siuqvhscuiycvdrtiqsh/.test(s)) v.push(`R5_HOSTED_REF ${f}`);
  }
  for (const f of ['seed-journey.sql', 'witness-journey.sql', 'pairing-seed.sql', 'pairing-producer.mjs', 'run-journey.sh']) {
    const s = rd(`${sdir}/${f}`);
    if (/9b6b0000-0000-4000-8000-/.test(s)) v.push(`R5_GRADING_FIXTURE_ID ${f}`);
    if (/supabase\.co|siuqvhscuiycvdrtiqsh/.test(s)) v.push(`R5_HOSTED_REF ${f}`);
  }

  // R6 setup order: gate 1 and gate 3 are checked before the first sign-in request.
  const setup = rd(`${jdir}/session-setup.ts`);
  const iG1 = setup.indexOf('assertPrivateSessionDir(process.env.GB_SESSION_DIR)');
  const iG3 = setup.indexOf('assertPairingProof(process.env.GB_JOURNEY_PAIRING_PROOF,');
  const iLive = setup.indexOf('await assertLivePairing(proof,');
  const iPost = setup.indexOf("method: 'POST'");
  if (iG1 < 0 || iG3 < 0 || iPost < 0 || !(iG1 < iPost && iG3 < iPost)) v.push('R6_GATES_AFTER_SIGNIN session-setup.ts');
  if (iLive < 0 || iPost < 0 || !(iG3 < iLive && iLive < iPost)) v.push('R6_LIVE_PAIRING_NOT_BEFORE_SIGNIN session-setup.ts');
  const pp = stripJsComments(rd(`${jdir}/pairing-proof.mjs`));
  if (/produced_before_seed/.test(pp) || !/p\.version !== 2/.test(pp)) v.push('R6_PROOF_NOT_V2 pairing-proof.mjs');
  if (/Authorization|authorization/.test(pp)) v.push('R6_LIVE_PAIRING_PERSONA pairing-proof.mjs');
  const iComp = setup.indexOf("process.env.GB_COMPOSITION !== 'composed-r5'");
  if (iComp < 0 || iPost < 0 || !(iComp < iPost)) v.push('R6_COMPOSITION_AFTER_SIGNIN session-setup.ts');
  if (!/assertPairingProof\(process\.env\.GB_JOURNEY_PAIRING_PROOF,\s*\{\s*sessionDir:/.test(setup)) v.push('R6_PROOF_NOT_SEPARATED session-setup.ts');
  if (/storageState\s*\(\s*\{\s*path/.test(setup)) v.push('R6_NON_EXCLUSIVE_SESSION_WRITE session-setup.ts');
  if (/\$\{[^}]*(message|body|text\(\)|password|token)[^}]*\}/i.test(setup.replace(/body: JSON\.stringify\([^)]*\)/g, ''))) v.push('R6_UNSANITIZED_ERROR session-setup.ts');


  // R7 J4 checks are independent (no serial mode), so the expected-red F1 check cannot skip the read-only checks.
  if (/mode:\s*'serial'/.test(stripJsComments(rd(`${jdir}/j4-learner-readback-certificate.spec.ts`)))) v.push('R7_J4_SERIAL j4-learner-readback-certificate.spec.ts');
  // R8 public verification is DEFERRED in the no-Edge journey: no spec navigates to it or stubs the Edge function.
  for (const f of JOURNEY_SPECS) if (/verify-certificate|functions\/v1/.test(stripJsComments(rd(`${jdir}/${f}`)))) v.push(`R8_VERIFY_NOT_DEFERRED ${f}`);
  // R9 the expected post is fully pinned: no OBSERVED or unpinned markers, and the audit/notification lines are present.
  const exp = rd(`${sdir}/expected-journey-post.txt`).split('\n').filter((l) => l && !l.startsWith('#'));
  if (exp.some((l) => /<OBSERVED>|<UPLOAD_BYTES>|<MD5_FEEDBACK>|to pin|>=/.test(l))) v.push('R9_EXPECTED_UNPINNED expected-journey-post.txt');
  if (exp.filter((l) => l.startsWith('AUDIT ')).length !== 2 || exp.filter((l) => l.startsWith('NOTIF ')).length !== 3) v.push('R9_EXPECTED_EVENTS expected-journey-post.txt');

  // R10 the comparator's declared HASH inventory is exactly the set of scopes the witness SQL prints.
  const cmp = rd(`${sdir}/tests/compare-witness.mjs`);
  const decl = (cmp.match(/DECLARED_HASHES = Object\.freeze\(Object\.assign\(Object\.create\(null\), \{([\s\S]*?)\}\)\);/) || [, ''])[1];
  const declNames = [...decl.matchAll(/([a-z_]+):\s*'(?:counted|single|guarded)'/g)].map((m) => m[1]).sort();
  const sqlNames = [...new Set([...rd(`${sdir}/witness-journey.sql`).matchAll(/^select 'HASH ([a-z_]+) /gm)].map((m) => m[1]))].sort();
  if (!declNames.length || JSON.stringify(declNames) !== JSON.stringify(sqlNames)) v.push('R10_HASH_INVENTORY compare-witness.mjs');

  // R11 adapter order (run-journey.sh) and producer order (pairing-producer.mjs); D1 before any DB contact; no nonce in shell.
  const sh = rd(`${sdir}/run-journey.sh`).split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const steps = ['pairing-producer.mjs" pins', 'assert-safe-target.mjs" --mutating', 'local-binding.mjs', 'assert-local-dsn.mjs"', 'pairing-producer.mjs" ownership',
    'composition.sql', 'mktemp -d', 'trap cleanup EXIT', 'pairing-producer.mjs" pair', 'pairing-producer.mjs" seed', 'witness-journey.sql" -At > "$OUT/witness-pre.txt"',
    'playwright test', 'witness-journey.sql" -At > "$OUT/witness-post.txt"', 'compare-witness.mjs'];
  const at = steps.map((x) => sh.indexOf(x));
  if (at.some((i) => i < 0) || at.some((i, k) => k > 0 && i <= at[k - 1])) v.push('R11_RUNNER_ORDER run-journey.sh');
  if (/set -x|xtrace|stack_id|pairing:|\bnonce\b/i.test(sh)) v.push('R11_RUNNER_NONCE_OR_TRACE run-journey.sh');
  if (/rm -rf -- "\$PARENT"/.test(sh) === false || (sh.match(/rm -/g) || []).length !== 1) v.push('R11_RUNNER_CLEANUP run-journey.sh');
  if (!/pairing-producer\.mjs" ownership >&2 \|\| refuse RUN_E_D1 5/.test(sh)) v.push('R11_RUNNER_NO_D1 run-journey.sh');
  const prod = stripJsComments(rd(`${sdir}/pairing-producer.mjs`));
  const pAt = ['o.db.journeyRowCount()', 'o.db.insertCarrier(', 'o.db.readCarrier()', 'assertLivePairing('].map((x) => prod.indexOf(x, prod.indexOf('export async function producePairing')));
  if (pAt.some((i) => i < 0) || pAt.some((i, k) => k > 0 && i <= pAt[k - 1])) v.push('R11_PRODUCER_ORDER pairing-producer.mjs');
  if (/console\.(log|error|warn|info)\([^)]*(nonce|carrier|stack_id|description)/.test(prod)) v.push('R11_PRODUCER_LOGS_NONCE pairing-producer.mjs');
  const d1 = prod.slice(prod.indexOf('export function stackOwnershipFailures'), prod.indexOf('export async function producePairing'));
  if (!/record\.api_origin !== o\.apiOrigin/.test(d1) || !/record\.app_origin !== o\.appOrigin/.test(d1) || !/\(st\.mode & 0o777\) !== 0o600/.test(d1) || !/r\.ok !== true \|\| r\.code !== 'SO_OK'/.test(d1) || !/apiOrigin: o\.apiOrigin, appOrigin: o\.appOrigin \}\)/.test(d1) || /disposable/.test(d1)) v.push('R11_PRODUCER_D1_WEAK pairing-producer.mjs');
  if (!/'scripts\/e2e\/stack-ownership\.mjs': 'afa9ebd812d57a03c52f3d67477e5dd6190fc40f'/.test(prod) || !/fixtures\/stack-ownership\.fake\.json': 'f1c384ec604bfa377af28b425ff981e2c072a32a'/.test(prod)) v.push('R11_D1_NOT_PINNED pairing-producer.mjs');

  return v;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const i = process.argv.indexOf('--root');
  const root = i > 0 ? process.argv[i + 1] : process.cwd();
  const v = checkJourney(root);
  if (v.length) { for (const x of v) console.log(`FAIL ${x}`); process.exit(1); }
  console.log('PASS journey static contract: seed inserts shell only, witness read-only, specs UI-driven, ids consistent, gates before sign-in');
}
