// ABOUTME: FAKE psql for the #159 narrow-reads tier controls (no database). Records what the tier's transport gave it
// ABOUTME: (argv, env names, HOME, passfile mode/content facts, stdin) and answers each pinned SQL file per NR_FAKE_SCENARIO.
// State (OLD/NEW policies, ledger rows, call counts) lives in NR_FAKE_DIR. Markers are only ever reported as booleans.
const fs = require('node:fs');
const path = require('node:path');
const D = process.env.NR_FAKE_DIR;
const SC = process.env.NR_FAKE_SCENARIO || 'ok';
const MARK = 'HOSTILE-MARKER';
const stdin = fs.readFileSync(0, 'utf8');
const inc = (/^\\i (\S+)$/m.exec(stdin) || [])[1] || '';
const base = path.basename(inc);
const isApply = /^begin;$/m.test(stdin);
const sets = Object.fromEntries([...stdin.matchAll(/^\\set (\w+) '([^']*)'$/gm)].map((m) => [m[1], m[2]]));
const pf = process.env.PGPASSFILE;
let pfMode = null, pfMark = false;
try { pfMode = (fs.statSync(pf).mode & 0o777).toString(8); pfMark = fs.readFileSync(pf, 'utf8').includes(MARK); } catch { /* recorded as null */ }
const rec = {
  argv: process.argv.slice(2), argvMark: process.argv.some((a) => a.includes(MARK)),
  envNames: Object.keys(process.env).filter((k) => /^(PG|SUPABASE_DB_URL$|E2E_)/.test(k)).sort(),
  envMark: Object.values(process.env).some((v) => String(v).includes(MARK)),
  home: process.env.HOME, pfDir: pf ? path.dirname(pf) : null, pfMode, pfMark,
  stdinMark: stdin.includes(MARK), file: base, apply: isApply, step: sets.nr_step || null,
};
fs.appendFileSync(path.join(D, 'calls.jsonl'), JSON.stringify(rec) + '\n');
const cnt = (k) => { const f = path.join(D, `n-${k}`); const n = (fs.existsSync(f) ? Number(fs.readFileSync(f, 'utf8')) : 0) + 1; fs.writeFileSync(f, String(n)); return n; };
const stF = path.join(D, 'state'); const state = fs.existsSync(stF) ? fs.readFileSync(stF, 'utf8') : 'OLD';
const ledF = path.join(D, 'ledger');
const out = (s) => process.stdout.write(s);
const err = (s) => process.stderr.write(s);
const n = cnt(base + (isApply ? '-apply' : ''));
err(`NOTICE: ${MARK}-stderr raw detail\n`);
const h = (c) => c.repeat(32);
const OLD_SET = process.env.NR_FAKE_OLD_SET, NEW_SET = process.env.NR_FAKE_NEW_SET;
const CASES = String(process.env.NR_FAKE_CASES).split(' ');
let code = 0;
if (isApply) {
  if (SC === 'apply_fail' && base.startsWith('2026')) { err(`ERROR: ${MARK} apply failed\n`); process.exit(3); }
  fs.writeFileSync(stF, base === 'rollback.sql' ? 'OLD' : 'NEW');
  fs.appendFileSync(ledF, `${sets.nr_step}:${sets.nr_version}:${sets.nr_sha}\n`);
} else if (base === 'ledger.sql') {
  const l = fs.existsSync(ledF) ? fs.readFileSync(ledF, 'utf8').trim().split('\n').join(',') : '';
  out(`LEDGER ${l || 'NONE'}\n`);
} else if (base === 'catalog.sql') {
  out(`POLICYSET ${state === 'OLD' ? OLD_SET : NEW_SET}\nPOLICYBODIES ${h(state === 'OLD' ? 'a' : 'b')}\nOTHERPOLICIES 40 ${h('c')}\nGRANTS ${h('d')}\nCOLUMNS ${h('e')}\nTRIGGERS ${h('f')}\n`);
  if (SC === 'catalog_marker') out(`${MARK} policy text line\n`);
} else if (base === 'baseline.sql') {
  out('BASELINE 2 2 1\n');
} else if (base === 'rowhash.sql') {
  out(`ROWHASH career_quiz_attempts 2 ${h('1')}\nROWHASH user_feedback 2 ${h('2')}\nROWHASH blog_settings 1 ${h('3')}\n`);
  if (SC === 'rowhash_exit19' && n === 2) code = 19;     // the expected bytes, but the producer failed
} else if (base === 'matrix.sql') {
  let lines = CASES.map((e) => { const [id, k] = e.split(':');
    if (k === 'kept') return `PASS ${id} kept old=MATCH`;
    return state === 'OLD' ? `FAIL ${id} closed old=MATCH` : `PASS ${id} closed old=DIFF`; });
  if (SC === 'old_r1' && state === 'OLD') lines = lines.map((l) => l.replace(/^FAIL (\S+) closed/, 'PASS $1 closed'));
  if (SC === 'new_one_line' && state === 'NEW') lines = lines.slice(0, 1);
  if (SC === 'matrix_marker') lines.push(`FAIL Q01 kept old=MATCH (got ${MARK}, expected x)`);
  out(['', ...lines, '', 'CHECKS 26 closed 8', ''].join('\n'));
  const nf = lines.filter((l) => l.startsWith('FAIL ')).length;
  if (nf > 0) { err(`psql:<stdin>:200: ERROR:  ${nf} narrow-read check(s) failed\n`); code = 3; }
} else { err(`ERROR: unexpected file\n`); code = 3; }
process.exit(code);
