#!/usr/bin/env node
// ABOUTME: Causal-control helper for guards-selftest.sh: weakens a COPY of run.sh in a mirror tree in exactly one named way, so
// ABOUTME: the checks that depend on that protection must fail. Each mutation must match exactly once; the real file is never touched.
// Usage: mutate-runner.mjs <no-override-guard | stderr-echo | password-argv> <run.sh copy>
import { readFileSync, writeFileSync } from 'node:fs';

const [control, file] = process.argv.slice(2);
const MUTATIONS = {
  // O1-O3: drop the self-test-override refusal from setup and owner.
  'no-override-guard': [/^ {4}no_selftest_overrides\n/gm, ''],
  // F9: quiet() prints stderr text again (the pre-fix behaviour), instead of a fixed code.
  'stderr-echo': [/^ {4}for c in "\$\{CODES\[@\]\}"; do .*$/gm, '    grep -oE \'(lesson-editor fixture refused|fixture): .{1,160}\' "$e" | head -3 >&2'],
  // D6: the password goes into psql's DSN argument (argv), as a password-bearing URL would.
  'password-argv': [
    /^psql\(\) \{ command "\$\{CLEAN\[@\]\}" PGPASSFILE="\$PF_DIR\/pgpass" psql -w "\$@"; \}.*$/gm,
    'psql() { local d="$1"; shift; command "${CLEAN[@]}" PGPASSFILE="$PF_DIR/pgpass" psql -w "${d/@/:$(head -1 "$LE_DB_PASSWORD_FILE")@}" "$@"; }',
  ],
};
const m = MUTATIONS[control];
if (!m || !file) {
  console.log('usage: mutate-runner.mjs <no-override-guard|stderr-echo|password-argv> <run.sh copy>');
  process.exit(2);
}
const src = readFileSync(file, 'utf8');
const hits = src.match(m[0])?.length ?? 0;
const expected = control === 'no-override-guard' ? 2 : 1;
if (hits !== expected) {
  console.log(`mutate-runner: ${control} matched ${hits} time(s), expected ${expected}`);
  process.exit(1);
}
writeFileSync(file, src.replace(m[0], m[1]));
