#!/usr/bin/env bash
# ABOUTME: Orchestrates the gradebook real-role run on a LOCAL stack: target guard, fixture seed, pre-witness, the two
# ABOUTME: Playwright projects (instructor writers, then learner), post-witness, and an exact comparison. Loopback only.
# Usage: scripts/gradebook-fixture/run.sh <evidence dir (must not exist)>
# Env: SUPABASE_DB_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (as exported by the isolated job). Never a hosted project.
# Expected feedback hashes come from an independent oracle (the exact requested value), never from the stored value.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; HERE="$ROOT/scripts/gradebook-fixture"
OUT="${1:?evidence dir}"; [ ! -e "$OUT" ] || { echo "run refused: $OUT exists" >&2; exit 2; }
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating || { echo "run refused: target guard" >&2; exit 3; }
(cd "$ROOT" && node e2e/gradebook-roles/local-binding.mjs) || { echo "run refused: strict local binding" >&2; exit 3; }
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$SUPABASE_DB_URL" >/dev/null || { echo "run refused: not a loopback DSN" >&2; exit 3; }
mkdir -m 700 "$OUT"
PSQL=(env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1)
# Composition is detected from the database itself (pin fingerprint + T-09 ledger); unknown or mismatched fails closed.
GB_COMPOSITION=$("${PSQL[@]}" -f "$HERE/composition.sql" | sed -n 's/^COMPOSITION //p'); export GB_COMPOSITION
case "$GB_COMPOSITION" in baseline-139|t09-old) EXPECTED="$HERE/expected-post.txt" ;; composed-r5) EXPECTED="$HERE/expected-post.composed-r5.txt" ;;
  *) echo "run refused: gradebook composition not identified" >&2; exit 3 ;; esac
echo "COMPOSITION $GB_COMPOSITION ($(basename "$EXPECTED"))" | tee "$OUT/composition.txt"
"${PSQL[@]}" -f "$HERE/seed.sql" | tee "$OUT/seed.txt"
# Association nonce: written HERE through the DB DSN, read back by session-setup.ts through the approved API (API -> DB).
GB_ASSOCIATION_NONCE=$(od -An -tx1 -N16 /dev/urandom | tr -d ' \n'); export GB_ASSOCIATION_NONCE
[[ "$GB_ASSOCIATION_NONCE" =~ ^[0-9a-f]{32}$ ]] || { echo "run refused: could not draw an association nonce" >&2; exit 3; }
# (psql interpolates :'nonce' only in script input, never in -c, so the statement is fed on stdin.)
n=$(printf "update public.courses set description = :'nonce' where id = '9b6b0000-0000-4000-8000-000000000001' returning 1;\n" \
    | "${PSQL[@]}" -At -v nonce="gb-association:$GB_ASSOCIATION_NONCE" -f - | grep -c '^1$' || true)
[ "$n" = 1 ] || { echo "run refused: association nonce not written to exactly one fixture course row" >&2; exit 3; }
"${PSQL[@]}" -f "$HERE/witness.sql" > "$OUT/witness-pre.txt"
# Non-vacuity: the protected set must contain rows to protect (the e2e seed's own submissions).
for k in other_submissions other_audit_events grades grade_history certificates fixture_assignments fixture_submission_immutable fixture_courses fixture_modules fixture_items fixture_enrollments other_notifications; do
  grep -qE "^HASH $k [1-9]" "$OUT/witness-pre.txt" || { echo "run refused: protected set $k is empty (its hash would be vacuous)"; exit 4; }
done
set +e
npx --no-install playwright test -c playwright.gradebook-roles.config.ts > "$OUT/playwright.txt" 2>&1; PW=$?
set -e
"${PSQL[@]}" -f "$HERE/witness.sql" > "$OUT/witness-post.txt"
# Independent oracle: the expected stored feedback is the EXACT value the spec requests (one plain paragraph, as the editor
# serialises it; fixture.ts STORED()), hashed here from these literals. Nothing is derived from what the run stored.
oracle() { printf '%s' "$1" | md5sum | cut -c1-32; }
SG0B=$(oracle '<p>GB fixture: thesis missing; see rubric row 1.</p>'); SG7=$(oracle '<p>GB fixture: solid argument.</p>')
sed -e "s/<SG0b>/$SG0B/" -e "s/<SG7>/$SG7/" "$EXPECTED" | grep -E '^(STATE|AUDIT) ' > "$OUT/expected-post.resolved.txt"
rc=0
diff <(grep -E '^(STATE|AUDIT) ' "$OUT/witness-post.txt") "$OUT/expected-post.resolved.txt" > "$OUT/state-diff.txt" && echo "PASS fixture state and audit trail exactly as expected" || { echo "FAIL fixture state/audit differs (state-diff.txt)"; rc=1; }
{ grep -v '^#' "$HERE/expected-notif-added.txt"; grep '^NOTIF ' "$OUT/witness-pre.txt"; } | LC_ALL=C sort > "$OUT/expected-notif.resolved.txt"
diff <(grep '^NOTIF ' "$OUT/witness-post.txt") "$OUT/expected-notif.resolved.txt" > "$OUT/notif-diff.txt" && echo "PASS fixture-course notifications exactly the pre set plus one per real grade/feedback change" || { echo "FAIL fixture-course notifications differ (notif-diff.txt)"; rc=1; }
diff <(grep '^HASH ' "$OUT/witness-pre.txt") <(grep '^HASH ' "$OUT/witness-post.txt") > "$OUT/protected-diff.txt" && echo "PASS protected rows byte-identical (other submissions, other audit events, grades, grade_history, certificates, fixture assignments/courses/module/items/enrollments, fixture submission immutable fields)" || { echo "FAIL a protected hash changed (protected-diff.txt)"; rc=1; }
[ $PW -eq 0 ] && echo "PASS playwright (both projects)" || { echo "FAIL playwright exit $PW"; rc=1; }
exit $rc
