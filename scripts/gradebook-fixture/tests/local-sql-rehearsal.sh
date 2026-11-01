#!/usr/bin/env bash
# ABOUTME: LOCAL SQL rehearsal of the whole expected write sequence (real role ids as JWT claims) on a scratch copy of a local
# ABOUTME: template, then exact comparison and fail-closed negative controls. NOT API or browser evidence. Loopback only.
# Usage: local-sql-rehearsal.sh <maintenance URI: postgresql://user@loopback:port/postgres> <template db> <receipt dir>
# The template decides the composition (composition.sql): no T-09 ledger = baseline-139; all 7 pinned T-09 migrations with
# their local_evidence ledger = composed-r5. The expected post state is chosen from the detected composition only.
#
# Negative-control contract (fail closed): a corruption counts as DETECTED only if (1) the corruption SQL and the witness both
# ran with psql exit 0, (2) the witness is complete (6 STATE rows, every protected HASH key once, >= 1 NOTIF, both OBSERVED
# lines), and (3) the comparison then differs. A psql error or an incomplete witness is INVALID, never "detected".
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
URL="${1:-}"; TEMPLATE="${2:-}"; OUT="${3:-}"
CANON='^postgresql://([A-Za-z0-9_.-]+(:[^@/?#[:space:]]*)?)@(127\.0\.0\.1|localhost|\[::1\]):([0-9]{1,5})/([a-z0-9_]+)$'
[[ "$URL" =~ $CANON ]] && [ "${BASH_REMATCH[5]}" = postgres ] || { echo "refused: maintenance URI is not the canonical loopback /postgres form (nothing was run)"; exit 2; }
AUTH="${BASH_REMATCH[1]}"; HOSTP="${BASH_REMATCH[3]}"; PORT="${BASH_REMATCH[4]}"
[[ "$TEMPLATE" =~ ^[a-z0-9_]+$ ]] && [ -n "$OUT" ] || { echo "refused: template must be a plain database name and a receipt dir is required (nothing was run)"; exit 2; }
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$URL" >/dev/null 2>&1 || { echo "refused: not loopback (nothing was run)"; exit 2; }
DB=gb_rehearsal_$$; SCRATCH="postgresql://$AUTH@$HOSTP:$PORT/$DB"
[[ "$SCRATCH" =~ $CANON ]] && [ "${BASH_REMATCH[5]}" = "$DB" ] || { echo "refused: derived scratch DSN is not canonical"; exit 2; }
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE -u PGDATABASE -u PGOPTIONS psql "$@"; }
mkdir -p "$OUT"
psql -X -q "$URL" -c "create database $DB template $TEMPLATE" >/dev/null || exit 2
trap 'psql -X -q "$URL" -c "drop database if exists $DB" >/dev/null' EXIT
[ "$(psql -X -Atq "$SCRATCH" -c 'select current_database()')" = "$DB" ] || { echo "refused: scratch connection did not reach $DB"; exit 2; }
P() { psql -X -q -v ON_ERROR_STOP=1 "$SCRATCH" "$@"; }
P -f "$ROOT/scripts/local-db/local-preseed.sql" >/dev/null || { echo "FAIL preseed"; exit 1; }
COMP=$(P -f "$HERE/composition.sql" 2>"$OUT/composition.err" | sed -n 's/^COMPOSITION //p')
case "$COMP" in baseline-139|t09-old) EXPECTED="$HERE/expected-post.txt" ;; composed-r5) EXPECTED="$HERE/expected-post.composed-r5.txt" ;;
  *) echo "FAIL composition not identified: $(head -c 300 "$OUT/composition.err")"; exit 1 ;; esac
echo "composition: $COMP (template $TEMPLATE; expected $(basename "$EXPECTED"))" | tee "$OUT/composition.txt"
P -f "$HERE/seed.sql" > "$OUT/seed.txt" 2>&1 || { echo "FAIL seed"; cat "$OUT/seed.txt"; exit 1; }
P -f "$HERE/witness.sql" > "$OUT/witness-pre.txt" || { echo "FAIL pre-witness"; exit 1; }
as() { printf "select set_config('request.jwt.claims', '{\"sub\":\"e2e00000-0000-4000-8000-000000000%s\",\"role\":\"authenticated\"}', false) as claims_set \\\\gset\nset role authenticated;\n" "$1"; }
upd() { printf "update public.assignment_submissions set %s where id = '9b6b0000-0000-4000-8000-000000000%s';\n" "$2" "$1"; }
{ as 002
  upd 301 "grade=0, grader_comments='<p>GB fixture: thesis missing.</p>', graded_at=now(), workflow_state='graded'"                  # W1
  upd 301 "grade=0, grader_comments='<p>GB fixture: thesis missing; see rubric row 1.</p>', graded_at=now(), workflow_state='graded'"  # W1b
  upd 302 "grade=7, grader_comments='<p>GB fixture: solid argument.</p>', graded_at=now(), workflow_state='graded'"                  # W2
  upd 303 "grade=0, graded_at=now(), workflow_state='graded'"                                                                       # W3
  upd 304 "grade=7, graded_at=now(), workflow_state='graded'"                                                                       # W3
  upd 311 "grade=9, workflow_state='graded'"                                   # Z1/U1: zero rows (not this instructor's course)
  as 003
  upd 302 "grade=7, grader_comments='<p>GB fixture: pinned attempt.</p>', graded_at=now(), workflow_state='graded'"   # U2: SAME grade 7, new feedback: pinned
  upd 302 "grade=10, grader_comments='self-graded'"                            # P1
  upd 302 "grade=7, grader_comments='self feedback'"                           # P2
  upd 302 "graded_at='2020-01-01T00:00:00Z'"                                   # P3
  upd 311 "workflow_state='graded', grade=10"                                  # P4 (composition-dependent outcome)
  upd 312 "grade=10"                                                           # Z2 zero rows
} > "$OUT/sequence.sql"
P -f "$OUT/sequence.sql" > /dev/null || { echo "FAIL sequence"; exit 1; }
P -f "$HERE/witness.sql" > "$OUT/witness-post.txt" || { echo "FAIL post-witness"; exit 1; }
oracle() { printf '%s' "$1" | md5sum | cut -c1-32; }
sed -e "s/<SG0b>/$(oracle '<p>GB fixture: thesis missing; see rubric row 1.</p>')/" -e "s/<SG7>/$(oracle '<p>GB fixture: solid argument.</p>')/" "$EXPECTED" | grep -E '^(STATE|AUDIT) ' > "$OUT/expected-post.resolved.txt"
{ grep -v '^#' "$HERE/expected-notif-added.txt"; grep '^NOTIF ' "$OUT/witness-pre.txt"; } | LC_ALL=C sort > "$OUT/expected-notif.resolved.txt"
pass=0; fail=0; ok() { echo "PASS $*"; pass=$((pass+1)); }; no() { echo "FAIL $*"; fail=$((fail+1)); }
KEYS="other_submissions other_audit_events grades grade_history certificates fixture_assignments fixture_submission_immutable fixture_courses fixture_modules fixture_items fixture_enrollments other_notifications"
cmp_state() { diff <(grep -E '^(STATE|AUDIT) ' "$1") "$OUT/expected-post.resolved.txt" && diff <(grep '^NOTIF ' "$1") "$OUT/expected-notif.resolved.txt"; }
cmp_prot() { diff <(grep '^HASH ' "$OUT/witness-pre.txt") <(grep '^HASH ' "$1"); }
complete() {
  [ "$(grep -c '^STATE ' "$1")" -eq 6 ] || return 1
  for k in $KEYS; do [ "$(grep -cE "^HASH $k [0-9]" "$1")" -eq 1 ] || return 1; done
  [ "$(grep -c '^NOTIF ' "$1")" -ge 1 ] || return 1
  grep -q '^OBSERVED fixture_item_progressions ' "$1" && grep -q '^OBSERVED fixture_notifications_read ' "$1"
}
for k in $KEYS; do grep -qE "^HASH $k [1-9]" "$OUT/witness-pre.txt" && ok "R0-$k non-empty" || no "R0-$k EMPTY"; done
complete "$OUT/witness-pre.txt" && complete "$OUT/witness-post.txt" && ok "R0 pre and post witness complete (all classes)" || no "R0 witness incomplete"
cmp_state "$OUT/witness-post.txt" > "$OUT/state-diff.txt" && ok "R1 post state, audit and notifications exactly as expected for $COMP" || no "R1 state differs (state-diff.txt)"
cmp_prot "$OUT/witness-post.txt" > "$OUT/protected-diff.txt" && ok "R2 every protected hash identical" || no "R2 protected differs"
# neg LABEL SQL CLASS(state|prot) [EXPECT detected|invalid]. Service-role claims so the pins do not hide the corruption.
neg() {
  local label="$1" sql="$2" class="$3" expect="${4:-detected}" st verdict
  P -c "begin" -c "select set_config('request.jwt.claims','{\"sub\":\"e2e00000-0000-4000-8000-000000000001\",\"role\":\"service_role\"}',true)" \
    -c "$sql" -f "$HERE/witness.sql" -c "rollback" > "$OUT/neg-$label-witness.txt" 2>&1; st=$?
  if [ $st -ne 0 ]; then verdict="INVALID (psql exit $st)"
  elif ! complete "$OUT/neg-$label-witness.txt"; then verdict="INVALID (witness incomplete)"
  else
    if [ "$class" = state ]; then cmp_state "$OUT/neg-$label-witness.txt" > "$OUT/neg-$label-diff.txt"; else cmp_prot "$OUT/neg-$label-witness.txt" > "$OUT/neg-$label-diff.txt"; fi
    if [ $? -ne 0 ]; then verdict="detected ($(grep -c '^[<>]' "$OUT/neg-$label-diff.txt") diff lines)"; else verdict="NOT detected"; fi
  fi
  case "$expect:$verdict" in detected:detected*|invalid:INVALID*) ok "N-$label $verdict" ;; *) no "N-$label $verdict (expected $expect)" ;; esac
}
I='9b6b0000-0000-4000-8000-000000000'
neg grade-7-to-8 "update public.assignment_submissions set grade=8 where id='${I}304'" state
neg feedback-not-oracle "update public.assignment_submissions set grader_comments='<p>GB fixture: solid argument!</p>' where id='${I}302'" state
neg canary-grade-corrupted "update public.grades set points_earned=6 where id='${I}601'" prot
neg canary-certificate-touched "update public.certificates set issued_at=issued_at + interval '1 second' where id='${I}701'" prot
neg immutable-body-changed "update public.assignment_submissions set body='<p>rewritten</p>' where id='${I}302'" prot
neg immutable-body-relocated-to-url "update public.assignment_submissions set url=body, body=null where id='${I}302'" prot
neg extra-notification "insert into public.notifications (user_id, title, message, type, link, course_id) values ('e2e00000-0000-4000-8000-000000000003', 'Assignment graded: Points GB7', 'Your submission was graded.', 'assignment_graded', '/x', '${I}001')" state
neg wrong-recipient-same-suffix "insert into auth.users (id, email) values ('f2e00000-0000-4000-8000-000000000003', 'gb-same-suffix@example.invalid'); update public.notifications set user_id='f2e00000-0000-4000-8000-000000000003' where id = (select id from public.notifications where course_id='${I}001' and type='assignment_graded' and title='Assignment graded: Points GB7' limit 1)" state
neg canary-notification-read "update public.notifications set is_read = true where id = '${I}801'" prot
neg enrollment-removed "delete from public.enrollments where course_id='${I}001'" prot
# Controls on the contract itself: a corruption that ERRORS, and a corruption that breaks witness acquisition, are INVALID.
neg control-corruption-sql-error "update public.assignment_submissions set no_such_column = 1" state invalid
neg control-witness-unacquirable "drop table public.notifications cascade" state invalid
P -f "$HERE/seed.sql" > "$OUT/seed-on-used-stack.txt" 2>&1; st=$?
R='GRADEBOOK FIXTURE REFUSED: [0-5] of 6 fixture submissions are pristine \(a used stack'
if [ $st -ne 0 ] && grep -qE "$R" "$OUT/seed-on-used-stack.txt"; then
  ok "N-seed-reuse refused for the used-stack reason: $(grep -oE 'GRADEBOOK FIXTURE REFUSED: [0-5] of 6 fixture submissions are pristine' "$OUT/seed-on-used-stack.txt" | head -1)"
else no "N-seed-reuse exit $st without the specific used-stack refusal"; fi
echo "== LOCAL SQL rehearsal [$COMP] (plain PostgreSQL; no GoTrue, PostgREST or browser): $pass PASS, $fail FAIL"
[ $fail -eq 0 ]
