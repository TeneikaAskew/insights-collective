#!/usr/bin/env bash
# ABOUTME: #159 narrow-reads SQL tier for the DISPOSABLE loopback stack only (after stage-pre and bootstrap). Pins every
# ABOUTME: file, then: catalog S0, committed baseline, row hash, OLD matrix (exactly the 8 closed checks fail), apply,
# ABOUTME: NEW matrix, rollback (catalog back to S0, OLD reproduced), re-apply (NEW again). Fixed verdict lines only.
# Usage: tier.sh <loopback db url>      tier.sh --selftest   (synthetic outputs, no database)
# Exit: 0 only when every step matches; 1 on any mismatch or INVALID result; 2 on setup errors.
# Never: a hosted project, db-migrate.yml, apply_migration, supabase db push, a glob over migrations.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
MIG="supabase/migrations/20261102000000_narrow_quiz_feedback_blog_settings_reads.sql"
VERSION=20261102000000
# path | git blob | sha256
PINS=(
"supabase/migrations/20261102000000_narrow_quiz_feedback_blog_settings_reads.sql|3fa6eca80a88c408de6e9e6e3d986194387ab5a9|a389c2ec14b7ee5d18dabeb6889a7ca84818ba290d5184c754b321287ce99bd4"
"scripts/local-stack/narrow-reads/matrix.sql|2644805d1ff1d096abcfa1733d28a1c881788375|18ea41e3427406556342c2fec80c070974bfc42d3c33fa2dbff23d74d71162aa"
"scripts/local-stack/narrow-reads/baseline.sql|9eafb37351f3a9df9665d6661b6b81d4834e077b|895d1b3f45089c71939eef34e3e679a637b746b37089898292ad0e9b84d55f65"
"scripts/local-stack/narrow-reads/rowhash.sql|75e7f663172c0e0e9649366887b90171b96a7349|4199aad77c08a35e6a8a42408ecf2657cb6e2ab863e223592632cbcd04abd6a2"
"scripts/local-stack/narrow-reads/catalog.sql|24dda1a260a09ee733d441397eea88bd96218a9b|5ec15365ea15de15938c1905d9d765e371757a7081312c388b1384bb31b5e8b0"
"scripts/local-stack/narrow-reads/rollback.sql|e07700e9a181187cf93d2614b824dbac1cf2ba40|3b87fd80939900579e9beab8a5bf701267941be5156f7c13b818a6a79c0fea8a"
"scripts/local-stack/t09/sql-tier.sh|9b13335af15522713334902691a07ae4bf63d1dd|3b345c141966826f2b92a5d64b6c9d4177b2908bbee767f6a8eb0238d47f6502"
)
CLOSED_COUNT=8; CHECKS_LINE="CHECKS 26 closed 8"
OLD_SET='blog_settings|ALL|public|PERMISSIVE|Admins can manage blog settings;blog_settings|SELECT|public|PERMISSIVE|Anyone can view blog settings;career_quiz_attempts|INSERT|public|PERMISSIVE|Users can insert their own quiz attempts;career_quiz_attempts|SELECT|public|PERMISSIVE|Users can view their own quiz attempts;user_feedback|INSERT|authenticated|PERMISSIVE|Users can insert feedback;user_feedback|SELECT|authenticated|PERMISSIVE|Users can view feedback;user_feedback|UPDATE|authenticated|PERMISSIVE|Users can update their own feedback'
NEW_SET='blog_settings|ALL|public|PERMISSIVE|Admins can manage blog settings;blog_settings|SELECT|authenticated|PERMISSIVE|Blog authors can view blog settings;career_quiz_attempts|INSERT|public|PERMISSIVE|Users can insert their own quiz attempts;career_quiz_attempts|SELECT|public|PERMISSIVE|Users can view their own quiz attempts;user_feedback|INSERT|authenticated|PERMISSIVE|Users can insert feedback;user_feedback|SELECT|authenticated|PERMISSIVE|Users can view feedback;user_feedback|UPDATE|authenticated|PERMISSIVE|Users can update their own feedback'

# classify: copied VERBATIM from scripts/local-stack/t09/sql-tier.sh (the selftest proves the bytes are equal).
classify() {
  local name="$1" want="$2" st="$3" out="$4" np nf errs assert_err n_assert other_err nassert_lines
  np=$(grep -c '^PASS ' <<<"$out"); nf=$(grep -c '^FAIL ' <<<"$out")
  errs=$(grep -E '(ERROR|FATAL):' <<<"$out")
  assert_err=$(grep -iE 'ERROR: +[0-9]+ [^:]*check\(s\) failed *$' <<<"$errs")
  nassert_lines=$(grep -c . <<<"$assert_err")
  other_err=$(grep -viE 'ERROR: +[0-9]+ [^:]*check\(s\) failed *$' <<<"$errs" | grep -v '^$')
  n_assert=$(sed -nE 's/.*ERROR: +([0-9]+) .*/\1/p' <<<"$assert_err" | head -1)   # never the psql file:line prefix
  local facts="exit $st, PASS $np, FAIL $nf"
  if [ -n "$other_err" ]; then echo "INVALID $name (infrastructure, not behaviour; $facts): $(head -1 <<<"$other_err")"; return 1; fi
  if [ "$np" -eq 0 ] && [ "$nf" -eq 0 ]; then echo "INVALID $name (no assertion lines; $facts)"; return 1; fi
  # A FAIL line whose own detail is a missing object or a syntax error is a broken fixture or schema, not behaviour.
  local tainted; tainted=$(grep -E '^FAIL .*(does not exist|syntax error)' <<<"$out" | head -1)
  if [ -n "$tainted" ]; then echo "INVALID $name (FAIL line caused by a missing object or syntax error; $facts): $tainted"; return 1; fi
  if [ "$nassert_lines" -gt 1 ]; then echo "INVALID $name ($nassert_lines closing assertions; $facts)"; return 1; fi
  if [ "$st" -eq 0 ] && [ "$nf" -gt 0 ]; then echo "INVALID $name (FAIL lines but exit 0 without the closing assertion; $facts)"; return 1; fi
  if [ "$st" -ne 0 ] && [ -z "$assert_err" ]; then echo "INVALID $name (non-zero exit without the closing assertion; $facts)"; return 1; fi
  if [ -n "$assert_err" ] && [ "$st" -ne 3 ]; then echo "INVALID $name (closing assertion but exit $st, expected 3; $facts)"; return 1; fi
  if [ -n "$assert_err" ] && [ "$n_assert" != "$nf" ]; then echo "INVALID $name (assertion count $n_assert != FAIL lines $nf)"; return 1; fi
  if [ -n "$assert_err" ] && [ "$nf" -eq 0 ]; then echo "INVALID $name (closing assertion with zero FAIL lines)"; return 1; fi
  local got; got=$([ "$st" -eq 0 ] && echo pass || echo fail)
  if [ "$got" = "$want" ]; then echo "PASS $name: expected $want ($facts)"; return 0; fi
  echo "FAIL $name: expected $want, got $got ($facts)"; return 1
}

# matrix_verdict <OLD|NEW> <psql exit> <psql output>: classify, then the exact closed/kept split.
# OLD: exactly the CLOSED_COUNT "closed" checks fail and every "kept" check passes. NEW: every check passes.
matrix_verdict() {
  local mode="$1" st="$2" out="$3" want line nclosedfail nkeptfail nkept_pass
  want=$([ "$mode" = NEW ] && echo pass || echo fail)
  line=$(classify "matrix-$mode" "$want" "$st" "$out") || { echo "$line"; return 1; }
  grep -qxF "$CHECKS_LINE" <<<"$out" || { echo "FAIL matrix-$mode: check inventory is not '$CHECKS_LINE'"; return 1; }
  nclosedfail=$(grep -c '^FAIL closed ' <<<"$out"); nkeptfail=$(grep -c '^FAIL kept ' <<<"$out")
  if [ "$mode" = OLD ]; then
    [ "$nclosedfail" -eq "$CLOSED_COUNT" ] && [ "$nkeptfail" -eq 0 ] \
      || { echo "FAIL matrix-OLD: $nclosedfail closed and $nkeptfail kept checks failed (want $CLOSED_COUNT and 0)"; return 1; }
  else
    [ "$nclosedfail" -eq 0 ] && [ "$nkeptfail" -eq 0 ] || { echo "FAIL matrix-NEW: $nclosedfail closed and $nkeptfail kept checks failed"; return 1; }
  fi
  echo "PASS matrix-$mode: $([ "$mode" = OLD ] && echo "exactly the $CLOSED_COUNT closed checks fail, every kept check passes" || echo "all 26 checks pass")"
}

# field <catalog output> <KEY>: the value after "KEY " on its one line.
field() { sed -n "s/^$2 //p" <<<"$1"; }

if [ "${1:-}" = "--selftest" ]; then
  RC=0
  ok() { if [ "$2" = 0 ]; then echo "PASS selftest $1"; else echo "FAIL selftest $1"; RC=1; fi; }
  # The classifier is the qualified one, byte for byte.
  diff <(awk '/^classify\(\) \{/,/^\}/' "$ROOT/scripts/local-stack/t09/sql-tier.sh") <(awk '/^classify\(\) \{/,/^\}/' "$0") >/dev/null; ok "classify equals sql-tier.sh" $?
  A='psql:/x/matrix.sql:9: ERROR:  8 narrow-read check(s) failed'
  K=$(for i in $(seq 18); do echo "PASS kept k$i"; done); C=$(for i in $(seq 8); do echo "FAIL closed c$i (got x, expected y)"; done)
  CP=$(for i in $(seq 8); do echo "PASS closed c$i"; done)
  v() { matrix_verdict "$1" "$2" "$3" >/dev/null 2>&1; echo $?; }
  ok "OLD exactly 8 closed fail" "$(v OLD 3 "$C"$'\n'"$K"$'\n'"$CHECKS_LINE"$'\n'"$A")"
  ok "OLD a kept check failing is refused" "$([ "$(v OLD 3 "$C"$'\n'"FAIL kept k1 (x)"$'\n'"$(tail -n 17 <<<"$K")"$'\n'"$CHECKS_LINE"$'\n'"${A/8 narrow/9 narrow}")" = 1 ] && echo 0 || echo 1)"
  ok "OLD only 7 closed fail is refused" "$([ "$(v OLD 3 "$(head -n 7 <<<"$C")"$'\n'"PASS closed c8"$'\n'"$K"$'\n'"$CHECKS_LINE"$'\n'"${A/8 narrow/7 narrow}")" = 1 ] && echo 0 || echo 1)"
  ok "OLD with nothing failing (already narrowed) is refused" "$([ "$(v OLD 0 "$CP"$'\n'"$K"$'\n'"$CHECKS_LINE")" = 1 ] && echo 0 || echo 1)"
  ok "OLD with an infrastructure error is refused" "$([ "$(v OLD 3 "$C"$'\n'"$K"$'\n'"$CHECKS_LINE"$'\n'"psql:/x:3: ERROR:  unrecognized configuration parameter \"request.headers\""$'\n'"$A")" = 1 ] && echo 0 || echo 1)"
  ok "NEW all pass" "$(v NEW 0 "$CP"$'\n'"$K"$'\n'"$CHECKS_LINE")"
  ok "NEW one closed failing is refused" "$([ "$(v NEW 3 "$(head -n 7 <<<"$CP")"$'\n'"FAIL closed c8 (x)"$'\n'"$K"$'\n'"$CHECKS_LINE"$'\n'"${A/8 narrow/1 narrow}")" = 1 ] && echo 0 || echo 1)"
  ok "NEW with a short inventory is refused" "$([ "$(v NEW 0 "$CP"$'\n'"$(head -n 17 <<<"$K")"$'\n'"CHECKS 25 closed 8")" = 1 ] && echo 0 || echo 1)"
  ok "field reads one key" "$([ "$(field $'POLICYSET a;b\nGRANTS x' GRANTS)" = x ] && echo 0 || echo 1)"
  echo "== narrow-reads tier selftest: $([ $RC -eq 0 ] && echo ALL PASS || echo FAILURES)"; exit $RC
fi

DB="${1:?loopback db url}"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$DB" >/dev/null || { echo "FAIL narrow-reads: not a loopback DSN"; exit 2; }
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
for pin in "${PINS[@]}"; do
  IFS='|' read -r path blob sha <<<"$pin"; f="$ROOT/$path"
  [ -f "$f" ] && [ ! -L "$f" ] && [ "$(git -C "$ROOT" hash-object "$f")" = "$blob" ] && [ "$(sha256sum "$f" | cut -d' ' -f1)" = "$sha" ] \
    || { echo "FAIL pin: $path"; exit 1; }
done
echo "PASS pins: ${#PINS[@]}/${#PINS[@]} blob+sha256"
q() { psql "$DB" -qAt -v ON_ERROR_STOP=1 "$@" 2>&1; }
catalog() { q -f "$HERE/catalog.sql"; }
rowhash() { q -f "$HERE/rowhash.sql"; }
matrix() { local out st; out=$(q -v mode="$1" -f "$HERE/matrix.sql"); st=$?; matrix_verdict "$1" "$st" "$out"; }
apply_file() { # <ledger step> <file>: the file and its ledger row commit together or not at all
  local out
  if ! out=$(psql "$DB" -v ON_ERROR_STOP=1 --single-transaction -q -f "$ROOT/$2" \
        -c "insert into local_evidence.narrow_reads_applied (step, version, path, sha256) values ('$1', '$VERSION', '$2', '$(sha256sum "$ROOT/$2" | cut -d' ' -f1)')" 2>&1); then
    echo "FAIL $1: $(grep -oE '(ERROR|FATAL):.*' <<<"$out" | head -1)"; exit 1
  fi
  echo "PASS $1: $(basename "$2") in one transaction with its ledger row"
}
same() { [ "$2" = "$3" ] && echo "PASS $1" || { echo "FAIL $1"; exit 1; }; }
STABLE() { grep -E '^(OTHERPOLICIES|GRANTS|COLUMNS|TRIGGERS) ' <<<"$1"; }

q -c "create table if not exists local_evidence.narrow_reads_applied (seq serial primary key, step text not null, version text not null,
  path text not null, sha256 text not null, applied_at timestamptz not null default clock_timestamp())" >/dev/null || { echo "FAIL ledger table"; exit 2; }
S0=$(catalog) || { echo "FAIL catalog S0"; exit 1; }
same "S0 policy set is the snapshot's (the four names the migration drops exist)" "$(field "$S0" POLICYSET)" "$OLD_SET"
B=$(q -f "$HERE/baseline.sql") || { echo "FAIL baseline"; exit 1; }
same "committed baseline: 2 quiz, 2 feedback, 1 blog row" "$(grep '^BASELINE ' <<<"$B")" "BASELINE 2 2 1"
H0=$(rowhash) || { echo "FAIL rowhash"; exit 1; }
matrix OLD || exit 1
apply_file apply "$MIG"
S1=$(catalog) || exit 1
same "after apply: policy set is the reviewed result" "$(field "$S1" POLICYSET)" "$NEW_SET"
same "after apply: other policies, grants, columns, triggers unchanged" "$(STABLE "$S1")" "$(STABLE "$S0")"
same "after apply: row content unchanged" "$(rowhash)" "$H0"
matrix NEW || exit 1
apply_file rollback scripts/local-stack/narrow-reads/rollback.sql
same "after rollback: catalog equals S0 exactly (names, roles, bodies)" "$(catalog)" "$S0"
same "after rollback: row content unchanged" "$(rowhash)" "$H0"
matrix OLD || exit 1
apply_file reapply "$MIG"
same "after re-apply: catalog equals the first apply exactly" "$(catalog)" "$S1"
same "after re-apply: row content unchanged" "$(rowhash)" "$H0"
matrix NEW || exit 1
same "ledger: apply, rollback, reapply" "$(q -c "select string_agg(step || ':' || version, ',' order by seq) from local_evidence.narrow_reads_applied")" "apply:$VERSION,rollback:$VERSION,reapply:$VERSION"
echo "== narrow-reads tier: ALL PASS"
