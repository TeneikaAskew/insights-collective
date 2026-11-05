#!/usr/bin/env node
// ABOUTME: No-network self-test of the preflight refusal codes: preflight-codes.mjs, every fail() site in preflight.mjs, and
// ABOUTME: run.sh's preflight_code case table (executed through bash -c on its own text). No stack, listener or file write.
// Usage: node scripts/local-stack/lesson-editor/tests/preflight-codes-selftest.mjs   (exit 0 only when every case passes)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANE = path.resolve(HERE, '..');
const { PREFLIGHT_EXIT } = await import(path.join(LANE, 'preflight-codes.mjs'));
const PRE = readFileSync(path.join(LANE, 'preflight.mjs'), 'utf8');
const RUN = readFileSync(path.join(LANE, 'run.sh'), 'utf8');
const P3 = readFileSync(path.join(LANE, 'p3-exposure.mjs'), 'utf8');

let pass = 0, fail = 0;
const say = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); };
const EXPECT = { LE_PRE_E_INPUT: 20, LE_PRE_E_P1: 21, LE_PRE_E_P2: 22, LE_PRE_E_P3_HTTP: 23, LE_PRE_E_P3_COUNT: 24, LE_PRE_E_P3_TABLES: 25, LE_PRE_E_P4: 26, LE_PRE_E_UNEXPECTED: 27 };
const CODES = Object.keys(EXPECT);

// K: the table itself.
say('K1 preflight-codes.mjs holds exactly the 8 agreed codes with statuses 20..27', JSON.stringify(PREFLIGHT_EXIT) === JSON.stringify(EXPECT) && Object.isFrozen(PREFLIGHT_EXIT));

// M: run.sh maps ONLY an exit status, through its own case table, executed here as written.
const m = RUN.match(/^preflight_code\(\) \{\n[\s\S]*?\n\}\n/m);
const code = (st) => spawnSync('bash', ['-c', `${m[0]}\npreflight_code "$1"`, 'x', String(st)], { encoding: 'utf8' }).stdout;
say('M0 run.sh defines preflight_code exactly once', !!m && RUN.split('preflight_code() {').length === 2);
if (m) {
  for (const c of CODES) say(`M ${EXPECT[c]} -> ${c}`, code(EXPECT[c]) === `${c}\n`);
  for (const st of [0, 1, 2, 19, 28, 127, 255, 'x', '']) say(`M unknown status '${st}' -> UNMAPPED`, code(st) === 'UNMAPPED\n');
}
const lines = RUN.split('\n').filter((l) => l.includes('LE-SETUP-CODE'));
say('M1 run.sh emits LE-SETUP-CODE in exactly one place, as "LE-SETUP-CODE: $(preflight_code "$st")" and only when preflight failed',
  lines.filter((l) => !l.trim().startsWith('#')).length === 1
  && lines.some((l) => l.includes('if [ "$st" -ne 0 ]; then echo "LE-SETUP-CODE: $(preflight_code "$st")" >&2; refuse "preflight'))
  && RUN.includes('st=0; quiet "preflight" node "$HERE/preflight.mjs" "$API" "$APP" "$DB" "$ANON" "$SERVICE" || st=$?'));

// S: every refusal site in preflight.mjs names a listed code; each code has a site.
const sites = [...PRE.matchAll(/\bfail\(([^,)]+)/g)].map((x) => x[1].trim()).filter((a) => a !== 'code' && !a.startsWith('code,'));
const named = sites.filter((a) => /^'LE_PRE_E_[A-Z0-9_]+'$/.test(a)).map((a) => a.slice(1, -1));
const other = sites.filter((a) => !/^'LE_PRE_E_[A-Z0-9_]+'$/.test(a));
say('S1 every fail(...) site names a listed code, the sql() code parameter, or the P3 code template', named.every((c) => CODES.includes(c))
  && JSON.stringify(other) === JSON.stringify(['`LE_PRE_E_${p3.code}`']) && PRE.includes('const fail = (code, m) =>'));
const sqlCodes = [...PRE.matchAll(/\bsql\('([A-Z0-9_]+)', '/g)].map((x) => x[1]);
say('S2 every sql() probe passes a listed code', sqlCodes.length === 6 && sqlCodes.every((c) => CODES.includes(c)) && !/\bsql\('P[0-9]/.test(PRE));
const p3codes = [...new Set([...P3.matchAll(/code: '(P3_[A-Z]+)'/g)].map((x) => `LE_PRE_E_${x[1]}`))].sort();
say('S3 p3-exposure.mjs codes are exactly P3_HTTP, P3_COUNT, P3_TABLES and all are listed', JSON.stringify(p3codes) === JSON.stringify(['LE_PRE_E_P3_COUNT', 'LE_PRE_E_P3_HTTP', 'LE_PRE_E_P3_TABLES']));
const used = new Set([...named, ...sqlCodes, ...p3codes]);
say('S4 every listed code has at least one refusal site', CODES.every((c) => used.has(c)));
say('S5 an unknown code exits as UNEXPECTED; uncaught errors and rejections exit as UNEXPECTED', PRE.includes('process.exit(PREFLIGHT_EXIT[code] ?? PREFLIGHT_EXIT.LE_PRE_E_UNEXPECTED);')
  && PRE.includes("process.on('uncaughtException', () => fail('LE_PRE_E_UNEXPECTED',") && PRE.includes("process.on('unhandledRejection', () => fail('LE_PRE_E_UNEXPECTED',"));
say('S6 preflight.mjs has no other process.exit status', [...PRE.matchAll(/process\.exit\(([^)]*)\)/g)].map((x) => x[1]).every((a) => a.startsWith('PREFLIGHT_EXIT')));

// R: real preflight.mjs runs that refuse BEFORE any network, psql or file (input checks are first).
const HELPER = path.resolve(LANE, '../t09/api-http.mjs');
const runPre = (args) => spawnSync(process.execPath, [path.join(LANE, 'preflight.mjs'), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH } });
let r = runPre([]);
if (!existsSync(HELPER)) {
  // The lane tree alone has no T-09 helper (the composition supplies it): a module-load failure is not a check, so its
  // status (1) must stay UNMAPPED. R1/R2 run on a composed tree.
  say('R0 lane tree without the T-09 helper: preflight exits 1, which run.sh reports as UNMAPPED (R1/R2 need the composed tree)', r.status === 1 && code(1) === 'UNMAPPED\n');
} else {
say('R1 preflight with no arguments exits 20 (LE_PRE_E_INPUT)', r.status === 20);
r = runPre(['https://example.invalid', 'http://127.0.0.1:8080', 'postgresql://postgres@127.0.0.1:54322/postgres', '/nonexistent/a', '/nonexistent/s']);
say('R2 a non-loopback API origin exits 20 (LE_PRE_E_INPUT) with only the fixed line', r.status === 20 && r.stdout === 'FAIL le-preflight: origin refused (strict loopback origin required)\n');
}

console.log(`le preflight-codes-selftest (no network, listener, stack or file write; bash -c runs only run.sh's preflight_code text): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
