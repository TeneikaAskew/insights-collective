#!/usr/bin/env bash
# ABOUTME: LOCAL SQL rehearsal of the whole expected write sequence (as the real role ids, JWT claims) on a scratch copy of
# ABOUTME: a local template, then exact comparison and four negative controls. NOT API or browser evidence. Loopback only.
# Usage: local-sql-rehearsal.sh <loopback maintenance url> <template db> <receipt dir>
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
URL="${1:?url}"; TEMPLATE="${2:?template}"; OUT="${3:?receipt dir}"; mkdir -p "$OUT"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$URL" >/dev/null || { echo "refused: not loopback"; exit 2; }
DB=gb_rehearsal_$$; BASE="${URL%/*}"
P() { psql -X -q -v ON_ERROR_STOP=1 "$BASE/$DB" "$@"; }
psql -X -q "$URL" -c "create database $DB template $TEMPLATE" >/dev/null || exit 2
trap 'psql -X -q "$URL" -c "drop database if exists $DB" >/dev/null' EXIT
P -f "$ROOT/scripts/local-db/local-preseed.sql" >/dev/null
P -f "$HERE/seed.sql" > "$OUT/seed.txt" 2>&1 || { echo "FAIL seed"; cat "$OUT/seed.txt"; exit 1; }
P -f "$HERE/witness.sql" > "$OUT/witness-pre.txt"
as() { printf "select set_config('request.jwt.claims', '{\"sub\":\"e2e00000-0000-4000-8000-000000000%s\",\"role\":\"authenticated\"}', false) as claims_set \\\\gset\nset role authenticated;\n" "$1"; }
upd() { printf "update public.assignment_submissions set %s where id = '9b6b0000-0000-4000-8000-000000000%s';\n" "$2" "$1"; }
{ as 002
  upd 301 "grade=0, grader_comments='<p>GB fixture: thesis missing.</p>', graded_at=now(), workflow_state='graded'"
  upd 301 "grade=0, grader_comments='<p>GB fixture: thesis missing; see rubric row 1.</p>', graded_at=now(), workflow_state='graded'"
  upd 302 "grade=7, grader_comments='<p>GB fixture: solid argument.</p>', graded_at=now(), workflow_state='graded'"
  upd 303 "grade=0, graded_at=now(), workflow_state='graded'"
  upd 304 "grade=7, graded_at=now(), workflow_state='graded'"
  upd 311 "grade=9, workflow_state='graded'"                                   # Z1/U1: zero rows (not this instructor's course)
  as 003
  upd 302 "grade=9, grader_comments='<p>GB fixture: pinned attempt.</p>', graded_at=now(), workflow_state='graded'"   # U2 pinned
  upd 302 "grade=10, grader_comments='self-graded'"                            # P1
  upd 302 "grade=7, grader_comments='self feedback'"                           # P2
  upd 302 "graded_at='2020-01-01T00:00:00Z'"                                   # P3
  upd 311 "workflow_state='graded', grade=10"                                  # P4 (workflow_state not pinned)
  upd 312 "grade=10"                                                           # Z2 zero rows
} > "$OUT/sequence.sql"
P -f "$OUT/sequence.sql" > /dev/null
P -f "$HERE/witness.sql" > "$OUT/witness-post.txt"
oracle() { printf '%s' "$1" | md5sum | cut -c1-32; }
sed -e "s/<SG0b>/$(oracle '<p>GB fixture: thesis missing; see rubric row 1.</p>')/" -e "s/<SG7>/$(oracle '<p>GB fixture: solid argument.</p>')/" "$HERE/expected-post.txt" > "$OUT/expected-post.resolved.txt"
pass=0; fail=0; ok() { echo "PASS $*"; pass=$((pass+1)); }; no() { echo "FAIL $*"; fail=$((fail+1)); }
cmp_state() { diff <(grep -E '^(STATE|AUDIT) ' "$1") "$OUT/expected-post.resolved.txt"; }
cmp_prot() { diff <(grep '^HASH ' "$OUT/witness-pre.txt") <(grep '^HASH ' "$1"); }
for k in other_submissions other_audit_events grades grade_history certificates fixture_assignments fixture_submission_immutable fixture_courses fixture_modules fixture_items fixture_enrollments; do
  grep -qE "^HASH $k [1-9]" "$OUT/witness-pre.txt" && ok "R0-$k non-empty" || no "R0-$k EMPTY"
done
cmp_state "$OUT/witness-post.txt" > "$OUT/state-diff.txt" && ok "R1 post state + audit exactly as expected (oracle hashes)" || no "R1 state differs (state-diff.txt)"
cmp_prot "$OUT/witness-post.txt" > "$OUT/protected-diff.txt" && ok "R2 every protected hash identical" || no "R2 protected differs"
# Negative controls: each must make the comparison FAIL. Service-role claims so the pins do not hide the corruption.
neg() { # label sql which(state|prot)
  P -c "begin" -c "select set_config('request.jwt.claims','{\"sub\":\"e2e00000-0000-4000-8000-000000000001\",\"role\":\"service_role\"}',true)" -c "$2" -f "$HERE/witness.sql" -c "rollback" > "$OUT/neg-$1-witness.txt" 2>&1
  if [ "$3" = state ]; then cmp_state "$OUT/neg-$1-witness.txt" > "$OUT/neg-$1-diff.txt"; else cmp_prot "$OUT/neg-$1-witness.txt" > "$OUT/neg-$1-diff.txt"; fi
  [ $? -ne 0 ] && ok "N-$1 detected ($(grep -c '^[<>]' "$OUT/neg-$1-diff.txt") diff lines)" || no "N-$1 NOT detected"
}
neg grade-7-to-8 "update public.assignment_submissions set grade=8 where id='9b6b0000-0000-4000-8000-000000000304'" state
neg feedback-not-oracle "update public.assignment_submissions set grader_comments='<p>GB fixture: solid argument!</p>' where id='9b6b0000-0000-4000-8000-000000000302'" state
neg canary-grade-corrupted "update public.grades set points_earned=6 where id='9b6b0000-0000-4000-8000-000000000601'" prot
neg canary-certificate-touched "update public.certificates set issued_at=issued_at + interval '1 second' where id='9b6b0000-0000-4000-8000-000000000701'" prot
neg immutable-body-changed "update public.assignment_submissions set body='<p>rewritten</p>' where id='9b6b0000-0000-4000-8000-000000000302'" prot
neg enrollment-removed "delete from public.enrollments where course_id='9b6b0000-0000-4000-8000-000000000001'" prot
P -f "$HERE/seed.sql" > "$OUT/seed-on-used-stack.txt" 2>&1 && no "N-seed-reuse seed accepted a used stack" || ok "N-seed-reuse seed refused a used stack: $(grep -o 'GRADEBOOK FIXTURE REFUSED[^"]*' "$OUT/seed-on-used-stack.txt" | head -1 | cut -c1-90)"
echo "== LOCAL SQL rehearsal (plain PostgreSQL; no GoTrue, PostgREST or browser): $pass PASS, $fail FAIL"
[ $fail -eq 0 ]
