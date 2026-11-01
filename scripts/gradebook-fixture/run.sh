#!/usr/bin/env bash
# ABOUTME: Orchestrates the gradebook real-role run on a LOCAL stack: target guard, fixture seed, pre-witness, the two
# ABOUTME: Playwright projects (instructor writers, then learner), post-witness, and an exact comparison. Loopback only.
# Usage: scripts/gradebook-fixture/run.sh <evidence dir (must not exist)>
# Env: SUPABASE_DB_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (as exported by the isolated job). Never a hosted project.
# The SpeedGrader feedback is a TipTap editor, so the stored value is the editor's HTML; the expected md5 placeholders
# <SG0b>/<SG7> are therefore resolved from the post-witness only after checking the stored text contains the feedback.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; HERE="$ROOT/scripts/gradebook-fixture"
OUT="${1:?evidence dir}"; [ ! -e "$OUT" ] || { echo "run refused: $OUT exists" >&2; exit 2; }
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating || { echo "run refused: target guard" >&2; exit 3; }
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$SUPABASE_DB_URL" >/dev/null || { echo "run refused: not a loopback DSN" >&2; exit 3; }
mkdir -m 700 "$OUT"
PSQL=(env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$HERE/seed.sql" | tee "$OUT/seed.txt"
"${PSQL[@]}" -f "$HERE/witness.sql" > "$OUT/witness-pre.txt"
# Non-vacuity: the protected set must contain rows to protect (the e2e seed's own submissions).
grep -qE '^HASH other_submissions [1-9]' "$OUT/witness-pre.txt" || { echo "run refused: no non-fixture submissions to protect (protected hash would be vacuous)"; exit 4; }
set +e
npx --no-install playwright test -c playwright.gradebook-roles.config.ts --reporter=list,html > "$OUT/playwright.txt" 2>&1; PW=$?
set -e
"${PSQL[@]}" -f "$HERE/witness.sql" > "$OUT/witness-post.txt"
# Feedback is checked by content first (the text the spec typed must be inside the stored HTML), then its md5 is
# taken from the stored value so the comparison below is exact for everything else.
c() { "${PSQL[@]}" -Atc "select grader_comments from public.assignment_submissions where id = '9b6b0000-0000-4000-8000-0000000003$1'"; }
grep -qF 'GB fixture: thesis missing; see rubric row 1.' <<<"$(c 01)" || { echo "FAIL SG0 stored feedback lacks the re-saved text"; exit 1; }
grep -qF 'GB fixture: solid argument.' <<<"$(c 02)" || { echo "FAIL SG7 stored feedback lacks the saved text"; exit 1; }
m() { "${PSQL[@]}" -Atc "select md5(grader_comments) from public.assignment_submissions where id = '9b6b0000-0000-4000-8000-0000000003$1'"; }
sed -e "s/<SG0b>/$(m 01)/" -e "s/<SG7>/$(m 02)/" "$HERE/expected-post.txt" > "$OUT/expected-post.resolved.txt"
rc=0
diff <(grep -E '^(STATE|AUDIT) ' "$OUT/witness-post.txt") "$OUT/expected-post.resolved.txt" > "$OUT/state-diff.txt" && echo "PASS fixture state and audit trail exactly as expected" || { echo "FAIL fixture state/audit differs (state-diff.txt)"; rc=1; }
diff <(grep '^HASH ' "$OUT/witness-pre.txt") <(grep '^HASH ' "$OUT/witness-post.txt") > "$OUT/protected-diff.txt" && echo "PASS protected rows byte-identical (other submissions, other audit events, grades, grade_history, certificates, fixture assignments)" || { echo "FAIL a protected hash changed (protected-diff.txt)"; rc=1; }
[ $PW -eq 0 ] && echo "PASS playwright (both projects)" || { echo "FAIL playwright exit $PW"; rc=1; }
exit $rc
