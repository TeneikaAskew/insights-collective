#!/usr/bin/env bash
# ABOUTME: #159 narrow-reads SQL tier for the DISPOSABLE loopback stack only (after stage-pre and bootstrap). Pins every
# ABOUTME: file, then: ledger, catalog S0, committed baseline, row hash, OLD matrix, apply, NEW, rollback, OLD, reapply, NEW.
# Usage: SUPABASE_DB_URL=<loopback dsn> tier.sh        tier.sh --selftest   (synthetic outputs, no database)
#   The DSN is read from the environment ONLY (never argv). Every psql call goes through nr-psql.mjs, which plans it with the
#   qualified private-psql planPsql: strict in-process loopback check, -X -q -At -w and plain -h/-p/-U/-d argv, PG* and
#   secret env stripped, a fresh private 0600 passfile, HOME = the private dir, SQL on stdin.
# Output: fixed lines ONLY, "STAGE <NAME> <PASS|FAIL> status=<n> category=<CATEGORY> count=<n>", then "TIER <PASS|FAIL> stages=<n>".
#   Raw psql stdout/stderr and classifier text stay in a private 0700 dir, removed by this script's own EXIT trap (absence
#   checked and reported as STAGE CLEANUP). No observed value, policy text, error text or DSN part is ever printed.
# Exit: 0 only when every stage holds; 1 otherwise.
# Never: a hosted project, db-migrate.yml, apply_migration, supabase db push, a glob over migrations.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
MIG="supabase/migrations/20261102000000_narrow_quiz_feedback_blog_settings_reads.sql"
RB="scripts/local-stack/narrow-reads/rollback.sql"
VERSION=20261102000000
# path | git blob | sha256
PINS=(
"supabase/migrations/20261102000000_narrow_quiz_feedback_blog_settings_reads.sql|3fa6eca80a88c408de6e9e6e3d986194387ab5a9|a389c2ec14b7ee5d18dabeb6889a7ca84818ba290d5184c754b321287ce99bd4"
"scripts/local-stack/narrow-reads/matrix.sql|227bd1bac90a6042fe07471b2b0f290bc94441a2|bf1577aeb4ffeca9ef5690b43cc6bc0635fdc7d3060a854dd4896aa58359713a"
"scripts/local-stack/narrow-reads/baseline.sql|9eafb37351f3a9df9665d6661b6b81d4834e077b|895d1b3f45089c71939eef34e3e679a637b746b37089898292ad0e9b84d55f65"
"scripts/local-stack/narrow-reads/rowhash.sql|75e7f663172c0e0e9649366887b90171b96a7349|4199aad77c08a35e6a8a42408ecf2657cb6e2ab863e223592632cbcd04abd6a2"
"scripts/local-stack/narrow-reads/catalog.sql|24dda1a260a09ee733d441397eea88bd96218a9b|5ec15365ea15de15938c1905d9d765e371757a7081312c388b1384bb31b5e8b0"
"scripts/local-stack/narrow-reads/rollback.sql|e07700e9a181187cf93d2614b824dbac1cf2ba40|3b87fd80939900579e9beab8a5bf701267941be5156f7c13b818a6a79c0fea8a"
"scripts/local-stack/narrow-reads/ledger.sql|164ac4cf97d438c7f789275a8bd9194176d75202|396065e5444c684e040a1676720c55fbe06bcf846b3ddf3e0d5e6ecf8c29d3a2"
"scripts/local-stack/narrow-reads/nr-psql.mjs|3d6dc989803303d5777d2f1e317d3eb47f265623|1c077645c3570bee95e56288d7c118cdba66bd1a83d993c8dba98b949eff0276"
"scripts/gradebook-fixture/journey/private-psql.mjs|8077eccfc6f6bc85cd391bc13efff071f3b9f27a|69de4cb08bc6054de86f865f2c7925d4329e2f8892d5b33958f1970a25b7d6ed"
"scripts/local-db/assert-local-dsn.mjs|9632c7b40dc7a7a739f97342592085f975c58913|34a3579975a6f8a26d2f147e4d2fb10fe5ba6a3e023678f504fd7876e838ac70"
"scripts/local-stack/t09/sql-tier.sh|9b13335af15522713334902691a07ae4bf63d1dd|3b345c141966826f2b92a5d64b6c9d4177b2908bbee767f6a8eb0238d47f6502"
)
# The exact case inventory of matrix.sql (id:kind). The vitest control derives it from the matrix source and compares.
CASES="B01:closed B02:closed B03:kept B04:kept B05:kept B06:kept B07:kept F01:kept F02:closed F03:closed F04:kept F05:kept F06:kept F07:kept F08:kept Q01:kept Q02:closed Q03:kept Q04:kept Q05:closed Q06:kept Q07:kept Q08:closed Q09:kept Q10:closed Q11:kept"
CLOSED_COUNT=8; CHECKS_LINE="CHECKS 26 closed 8"
OLD_SET='blog_settings|ALL|public|PERMISSIVE|Admins can manage blog settings;blog_settings|SELECT|public|PERMISSIVE|Anyone can view blog settings;career_quiz_attempts|INSERT|public|PERMISSIVE|Users can insert their own quiz attempts;career_quiz_attempts|SELECT|public|PERMISSIVE|Users can view their own quiz attempts;user_feedback|INSERT|authenticated|PERMISSIVE|Users can insert feedback;user_feedback|SELECT|authenticated|PERMISSIVE|Users can view feedback;user_feedback|UPDATE|authenticated|PERMISSIVE|Users can update their own feedback'
NEW_SET='blog_settings|ALL|public|PERMISSIVE|Admins can manage blog settings;blog_settings|SELECT|authenticated|PERMISSIVE|Blog authors can view blog settings;career_quiz_attempts|INSERT|public|PERMISSIVE|Users can insert their own quiz attempts;career_quiz_attempts|SELECT|public|PERMISSIVE|Users can view their own quiz attempts;user_feedback|INSERT|authenticated|PERMISSIVE|Users can insert feedback;user_feedback|SELECT|authenticated|PERMISSIVE|Users can view feedback;user_feedback|UPDATE|authenticated|PERMISSIVE|Users can update their own feedback'

# classify: copied VERBATIM from scripts/local-stack/t09/sql-tier.sh (the selftest proves the bytes are equal). Its text
# names raw lines, so it only ever goes to the private log; the tier uses its exit status and first word.
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

CATEGORIES=" OK PIN TARGET TRANSPORT EXIT INVALID EXPECTATION GRAMMAR INVENTORY CONTRACT MISMATCH CLEANUP INTERNAL "
# stage <NAME> <PASS|FAIL> <status> <CATEGORY> <count>: the ONLY output format. Anything outside the grammar prints INTERNAL.
stage() {
  if [[ "${1:-}" =~ ^[A-Z][A-Z0-9_]{0,39}$ ]] && [[ "${2:-}" =~ ^(PASS|FAIL)$ ]] && [[ "${3:-}" =~ ^-?[0-9]{1,3}$ ]] \
     && [[ "${4:-}" =~ ^[A-Z]{2,12}$ ]] && [[ "$CATEGORIES" == *" ${4} "* ]] && [[ "${5:-}" =~ ^[0-9]{1,4}$ ]]; then
    printf 'STAGE %s %s status=%s category=%s count=%s\n' "$1" "$2" "$3" "$4" "$5"
  else
    printf 'STAGE INTERNAL FAIL status=0 category=INTERNAL count=0\n'; return 1
  fi
}

# matrix_check <OLD|NEW> <psql status> <stdout file> <stderr file> <private log>: prints "<CATEGORY> <count>" (consumed
# internally, never printed as is). Returns 0 only when the stage holds:
#   1. the qualified classifier: NEW must exit 0 with no FAIL; OLD must end in exactly one closing assertion (exit 3);
#   2. stdout grammar: only blank lines, case lines and one CHECKS line; anything else is GRAMMAR (count = such lines);
#   3. inventory: the observed case ids are exactly CASES, each once, with its kind; one CHECKS line equal to CHECKS_LINE;
#      no missing, duplicate or unknown id (INVENTORY, count = problems). A claimed count is never trusted on its own;
#   4. contract, per case: NEW closed = "PASS closed old=DIFF", NEW kept = "PASS kept old=MATCH",
#      OLD closed = "FAIL closed old=MATCH", OLD kept = "PASS kept old=MATCH" (CONTRACT, count = cases that differ).
matrix_check() {
  local mode="$1" st="$2" outf="$3" errf="$4" log="$5" want cl crc line id n_gram=0 n_inv=0 n_checks=0 n_bad=0 e k req
  local -A seen=()
  want=$([ "$mode" = NEW ] && echo pass || echo fail)
  cl=$(classify "matrix-$mode" "$want" "$st" "$(cat -- "$outf" "$errf")"); crc=$?
  printf '%s\n' "$cl" >> "$log"
  if [ "$crc" -ne 0 ]; then [ "${cl%% *}" = INVALID ] && echo "INVALID 0" || echo "EXPECTATION 0"; return 1; fi
  while IFS= read -r line || [ -n "$line" ]; do
    [ -z "$line" ] && continue
    if [[ "$line" =~ ^CHECKS\ [0-9]{1,4}\ closed\ [0-9]{1,4}$ ]]; then
      n_checks=$((n_checks + 1)); [ "$line" = "$CHECKS_LINE" ] || n_inv=$((n_inv + 1)); continue
    fi
    if [[ "$line" =~ ^(PASS|FAIL)\ ([QFB][0-9]{2})\ (closed|kept)\ old=(MATCH|DIFF)$ ]]; then
      id="${BASH_REMATCH[2]}"
      if [ -n "${seen[$id]:-}" ]; then n_inv=$((n_inv + 1)); else seen[$id]="${BASH_REMATCH[1]} ${BASH_REMATCH[3]} ${BASH_REMATCH[4]}"; fi
      continue
    fi
    n_gram=$((n_gram + 1))
  done < "$outf"
  if [ "$n_gram" -gt 0 ]; then echo "GRAMMAR $n_gram"; return 1; fi
  [ "$n_checks" -eq 1 ] || n_inv=$((n_inv + 1))
  for e in $CASES; do
    id="${e%%:*}"; k="${e#*:}"
    if [ -z "${seen[$id]:-}" ]; then n_inv=$((n_inv + 1)); continue; fi
    [ "$(cut -d' ' -f2 <<<"${seen[$id]}")" = "$k" ] || n_inv=$((n_inv + 1))
  done
  for id in "${!seen[@]}"; do [[ " $CASES " == *" $id:"* ]] || n_inv=$((n_inv + 1)); done
  if [ "$n_inv" -gt 0 ]; then echo "INVENTORY $n_inv"; return 1; fi
  for e in $CASES; do
    id="${e%%:*}"; k="${e#*:}"
    case "$mode:$k" in
      NEW:closed) req="PASS closed DIFF" ;; NEW:kept|OLD:kept) req="PASS kept MATCH" ;; OLD:closed) req="FAIL closed MATCH" ;;
    esac
    [ "${seen[$id]}" = "$req" ] || n_bad=$((n_bad + 1))
  done
  if [ "$n_bad" -gt 0 ]; then echo "CONTRACT $n_bad"; return 1; fi
  echo "OK ${#seen[@]}"
}

# Grammar of the other producers (stdout, blank lines ignored). Returns 0 when every line is known and each key appears once.
catalog_grammar() {
  local f="$1" key re n=0
  for key in POLICYSET POLICYBODIES OTHERPOLICIES GRANTS COLUMNS TRIGGERS; do
    case "$key" in
      POLICYSET) re='^POLICYSET [a-z_]+\|[A-Z]+\|[a-z_,]+\|(PERMISSIVE|RESTRICTIVE)\|[A-Za-z ]+(;[a-z_]+\|[A-Z]+\|[a-z_,]+\|(PERMISSIVE|RESTRICTIVE)\|[A-Za-z ]+)*$' ;;
      OTHERPOLICIES) re='^OTHERPOLICIES [0-9]{1,6} [0-9a-f]{32}$' ;;
      *) re="^$key [0-9a-f]{32}\$" ;;
    esac
    [ "$(grep -cE "$re" "$f")" = 1 ] || return 1
  done
  [ "$(grep -c . "$f")" = 6 ]
}
rowhash_grammar() {
  local f="$1" t
  for t in career_quiz_attempts user_feedback blog_settings; do [ "$(grep -cE "^ROWHASH $t [0-9]{1,9} [0-9a-f]{32}\$" "$f")" = 1 ] || return 1; done
  [ "$(grep -c . "$f")" = 3 ]
}

if [ "${1:-}" = "--selftest" ]; then
  [ $# -eq 1 ] || { echo "usage: tier.sh --selftest"; exit 2; }
  RC=0; T=$(mktemp -d) || exit 2; trap 'rm -rf -- "${T:?}"' EXIT
  ok() { if [ "$2" = 0 ]; then echo "PASS selftest $1"; else echo "FAIL selftest $1"; RC=1; fi; }
  diff <(awk '/^classify\(\) \{/,/^\}/' "$ROOT/scripts/local-stack/t09/sql-tier.sh") <(awk '/^classify\(\) \{/,/^\}/' "$0") >/dev/null; ok "classify equals sql-tier.sh" $?
  # Synthetic matrix outputs built from CASES. line <id:kind> <PASS|FAIL> <MATCH|DIFF>
  gen() { # gen <OLD|NEW>: the exact correct stdout for that state
    local e id k; for e in $CASES; do id="${e%%:*}"; k="${e#*:}"
      if [ "$k" = kept ]; then echo "PASS $id kept old=MATCH"; elif [ "$1" = OLD ]; then echo "FAIL $id closed old=MATCH"; else echo "PASS $id closed old=DIFF"; fi
    done; echo; echo "$CHECKS_LINE"; }
  A8='psql:<stdin>:9: ERROR:  8 narrow-read check(s) failed'
  # v <OLD|NEW> <status> <stdout> <stderr> <expected "CATEGORY count"> : 0 when matrix_check returns exactly that
  v() { printf '%s\n' "$3" > "$T/o"; printf '%s\n' "$4" > "$T/e"; local r; r=$(matrix_check "$1" "$2" "$T/o" "$T/e" "$T/log"); [ "$r" = "$5" ] && echo 0 || echo 1; }
  OLDO=$(gen OLD); NEWO=$(gen NEW)
  ok "OLD exact: 8 closed FAIL old=MATCH, 18 kept PASS, assertion 8" "$(v OLD 3 "$OLDO" "$A8" "OK 26")"
  ok "NEW exact: 26 PASS, closed old=DIFF" "$(v NEW 0 "$NEWO" "" "OK 26")"
  # Finding 4: the r1 want(OLD)=p_old matrix printed 26 PASS on the snapshot; the driver must refuse it.
  ok "OLD all 26 PASS (r1 want(OLD)=p_old) is refused" "$(v OLD 0 "$(sed 's/^FAIL \(.*\) closed old=MATCH/PASS \1 closed old=MATCH/' <<<"$OLDO")" "" "EXPECTATION 0")"
  # Finding 5: claimed counts never stand in for the inventory.
  ok "NEW one PASS line plus a claimed CHECKS 26 is refused" "$(v NEW 0 "$(head -n 1 <<<"$NEWO")"$'\n'"$CHECKS_LINE" "" "INVENTORY 25")"
  ok "OLD 8 closed FAIL, zero kept lines, claimed CHECKS 26 is refused" "$(v OLD 3 "$(grep '^FAIL ' <<<"$OLDO")"$'\n'"$CHECKS_LINE" "$A8" "INVENTORY 18")"
  ok "a duplicated case is refused" "$(v NEW 0 "$NEWO"$'\n'"PASS Q01 kept old=MATCH" "" "INVENTORY 1")"
  ok "an unknown case id is refused" "$(v NEW 0 "$(sed 's/^PASS Q11 kept/PASS Q99 kept/' <<<"$NEWO")" "" "INVENTORY 2")"
  ok "a case with the wrong kind is refused" "$(v NEW 0 "$(sed 's/^PASS Q01 kept old=MATCH/PASS Q01 closed old=MATCH/' <<<"$NEWO")" "" "INVENTORY 1")"
  ok "a missing CHECKS line is refused" "$(v NEW 0 "$(grep -v '^CHECKS' <<<"$NEWO")" "" "INVENTORY 1")"
  ok "a wrong CHECKS line is refused" "$(v NEW 0 "$(sed 's/^CHECKS 26/CHECKS 25/' <<<"$NEWO")" "" "INVENTORY 1")"
  ok "an extra free-text line is refused (GRAMMAR)" "$(v NEW 0 "$NEWO"$'\n'"PASS Q01 kept old=MATCH HOSTILE-MARKER-NR" "" "GRAMMAR 1")"
  ok "OLD closed case in a third state (old=DIFF) is refused" "$(v OLD 3 "$(sed 's/^FAIL Q02 closed old=MATCH/FAIL Q02 closed old=DIFF/' <<<"$OLDO")" "$A8" "CONTRACT 1")"
  ok "NEW closed case reporting old=MATCH is refused" "$(v NEW 0 "$(sed 's/^PASS Q02 closed old=DIFF/PASS Q02 closed old=MATCH/' <<<"$NEWO")" "" "CONTRACT 1")"
  ok "NEW where a kept case fails is refused" "$(v NEW 3 "$(sed 's/^PASS Q01 kept old=MATCH/FAIL Q01 kept old=MATCH/' <<<"$NEWO")" "${A8/8 narrow/1 narrow}" "EXPECTATION 0")"
  ok "OLD where a kept case also fails is refused" "$(v OLD 3 "$(sed 's/^PASS Q01 kept old=MATCH/FAIL Q01 kept old=MATCH/' <<<"$OLDO")" "${A8/8 narrow/9 narrow}" "CONTRACT 1")"
  ok "an infrastructure error is INVALID" "$(v OLD 3 "$OLDO" "psql:<stdin>:3: ERROR:  unrecognized configuration parameter \"request.headers\""$'\n'"$A8" "INVALID 0")"
  ok "NEW perfect bytes but exit 19 is INVALID" "$(v NEW 19 "$NEWO" "" "INVALID 0")"
  ok "the classifier text never reaches stdout" "$(r=$(v OLD 3 "$OLDO" "psql:<stdin>:3: ERROR:  HOSTILE-MARKER-NR"$'\n'"$A8" "INVALID 0"); [ "$r" = 0 ] && ! grep -q HOSTILE <<<"$r" && grep -q HOSTILE-MARKER-NR "$T/log" && echo 0 || echo 1)"
  ok "stage refuses free text in a name" "$([ "$(stage 'S0 x' PASS 0 OK 0)" = 'STAGE INTERNAL FAIL status=0 category=INTERNAL count=0' ] && echo 0 || echo 1)"
  ok "stage refuses an unknown or compound category" "$([ "$(stage S0 PASS 0 'OK PIN' 0)" = 'STAGE INTERNAL FAIL status=0 category=INTERNAL count=0' ] && [ "$(stage S0 PASS 0 BOGUS 0)" = 'STAGE INTERNAL FAIL status=0 category=INTERNAL count=0' ] && echo 0 || echo 1)"
  ok "stage prints the fixed grammar" "$([ "$(stage S0_CATALOG PASS 0 OK 6)" = 'STAGE S0_CATALOG PASS status=0 category=OK count=6' ] && echo 0 || echo 1)"
  printf 'POLICYSET %s\nPOLICYBODIES %s\nOTHERPOLICIES 3 %s\nGRANTS %s\nCOLUMNS %s\nTRIGGERS %s\n' "$OLD_SET" "$(printf a%.0s {1..32})" "$(printf b%.0s {1..32})" "$(printf c%.0s {1..32})" "$(printf d%.0s {1..32})" "$(printf e%.0s {1..32})" > "$T/c"
  ok "catalog grammar accepts the six keys" "$(catalog_grammar "$T/c"; echo $?)"
  ok "catalog grammar refuses an extra line" "$( (cat "$T/c"; echo 'NOTICE HOSTILE') > "$T/c2"; catalog_grammar "$T/c2"; [ $? -ne 0 ] && echo 0 || echo 1)"
  ok "catalog grammar refuses a duplicated key" "$( (cat "$T/c"; grep '^GRANTS' "$T/c") > "$T/c3"; catalog_grammar "$T/c3"; [ $? -ne 0 ] && echo 0 || echo 1)"
  printf 'ROWHASH career_quiz_attempts 2 %s\nROWHASH user_feedback 2 %s\nROWHASH blog_settings 1 %s\n' "$(printf a%.0s {1..32})" "$(printf b%.0s {1..32})" "$(printf c%.0s {1..32})" > "$T/h"
  ok "rowhash grammar accepts three tables" "$(rowhash_grammar "$T/h"; echo $?)"
  ok "rowhash grammar refuses a missing table" "$(head -n 2 "$T/h" > "$T/h2"; rowhash_grammar "$T/h2"; [ $? -ne 0 ] && echo 0 || echo 1)"
  echo "== narrow-reads tier selftest: $([ $RC -eq 0 ] && echo ALL PASS || echo FAILURES)"; exit $RC
fi

[ $# -eq 0 ] || { stage USAGE FAIL 2 INTERNAL 0; echo "TIER FAIL stages=0"; exit 1; }
NSTAGE=0; FAILED=0; PRIV=
pass() { stage "$1" PASS "${2:-0}" OK "${3:-0}"; NSTAGE=$((NSTAGE + 1)); }
bad() { stage "$1" FAIL "$2" "$3" "${4:-0}"; FAILED=1; exit 1; }
finish() {
  local rc=$?
  if [ -n "$PRIV" ]; then
    rm -rf -- "${PRIV:?}"
    if [ -e "$PRIV" ]; then stage CLEANUP FAIL 0 CLEANUP 0; rc=1; else stage CLEANUP PASS 0 OK 0; fi
  fi
  [ "$rc" -eq 0 ] && [ "$FAILED" -eq 0 ] && echo "TIER PASS stages=$NSTAGE" || { echo "TIER FAIL stages=$NSTAGE"; rc=1; }
  exit "$rc"
}
trap finish EXIT
trap 'exit 1' INT TERM HUP

# Pins: every file, blob AND sha256, before any other step. Each tool's status is checked, never a substituted value.
nbad=0
for pin in "${PINS[@]}"; do
  IFS='|' read -r path blob sha <<<"$pin"; f="$ROOT/$path"
  if [ ! -f "$f" ] || [ -L "$f" ]; then nbad=$((nbad + 1)); continue; fi
  gb=$(git hash-object -- "$f" 2>/dev/null) || { nbad=$((nbad + 1)); continue; }
  gs=$(sha256sum -- "$f" 2>/dev/null) || { nbad=$((nbad + 1)); continue; }
  [ "$gb" = "$blob" ] && [ "${gs%% *}" = "$sha" ] || nbad=$((nbad + 1))
done
[ "$nbad" -eq 0 ] || bad PINS 0 PIN "$nbad"
pass PINS 0 "${#PINS[@]}"
pin_sha() { local p; for p in "${PINS[@]}"; do [ "${p%%|*}" = "$1" ] && { echo "${p##*|}"; return 0; }; done; return 1; }
MIG_SHA=$(pin_sha "$MIG") || bad PINS 0 PIN 1
RB_SHA=$(pin_sha "$RB") || bad PINS 0 PIN 1

umask 077
PRIV=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/nr-priv.XXXXXXXX" 2>/dev/null) || { PRIV=; bad PRIVATE 0 TRANSPORT; }
chmod 700 -- "$PRIV" || bad PRIVATE 0 TRANSPORT
LOG="$PRIV/raw.log"

# sql <STAGE> <check|run|apply> [file] [step]: one nr-psql call. Sets RUN_ST to psql's exit status (0 for check).
# A refusal by the helper ends the tier here: exit 2 is the DSN refusal (TARGET), anything else TRANSPORT.
sql() {
  local name="$1" mode="$2" hst
  if [ "$mode" = check ]; then node "$HERE/nr-psql.mjs" "$PRIV" "$name" check >> "$LOG" 2>&1; hst=$?
  else node "$HERE/nr-psql.mjs" "$PRIV" "$name" "$mode" "$ROOT/$3" ${4:+"$4"} >> "$LOG" 2>&1; hst=$?; fi
  [ "$hst" -eq 2 ] && bad "$name" 2 TARGET
  [ "$hst" -eq 0 ] || bad "$name" "$((hst > 255 ? 255 : hst))" TRANSPORT
  if [ "$mode" = check ]; then RUN_ST=0; return 0; fi
  RUN_ST=$(head -c 16 -- "$PRIV/$name.status" 2>/dev/null) || bad "$name" 0 TRANSPORT
  RUN_ST="${RUN_ST%$'\n'}"
  [[ "$RUN_ST" =~ ^-?[0-9]{1,3}$ ]] || bad "$name" 0 TRANSPORT
}
# produce <STAGE> <run|apply> <file> [step]: the call must exit 0 BEFORE anything reads its output; the non-blank stdout
# lines then go to <STAGE>.lines (private). Every comparison below reads files written only after this check.
produce() {
  sql "$@"
  [ "$RUN_ST" = 0 ] || bad "$1" "$RUN_ST" EXIT
  grep -v '^$' -- "$PRIV/$1.out" > "$PRIV/$1.lines"; local g=$?
  [ "$g" -le 1 ] || bad "$1" 0 TRANSPORT
}
# expect <STAGE> <file with the produced lines> <expected text>: exact bytes, newline-terminated.
expect() { printf '%s\n' "$3" > "$PRIV/$1.want" || bad "$1" 0 TRANSPORT; cmp -s -- "$2" "$PRIV/$1.want" || bad "$1" 0 MISMATCH; pass "$1"; }
same_file() { cmp -s -- "$2" "$3" || bad "$1" 0 MISMATCH; pass "$1"; }
keyline() { grep -E "^$2( |\$)" -- "$1"; }
catalog() { produce "$1" run scripts/local-stack/narrow-reads/catalog.sql; catalog_grammar "$PRIV/$1.lines" || bad "$1" 0 GRAMMAR; pass "$1" 0 6; }
rowhash() { produce "$1" run scripts/local-stack/narrow-reads/rowhash.sql; rowhash_grammar "$PRIV/$1.lines" || bad "$1" 0 GRAMMAR; pass "$1" 0 3; }
matrix() { # <STAGE> <OLD|NEW>
  local r c n
  sql "$1" run scripts/local-stack/narrow-reads/matrix.sql
  r=$(matrix_check "$2" "$RUN_ST" "$PRIV/$1.out" "$PRIV/$1.err" "$LOG"); local rc=$?
  c="${r%% *}"; n="${r#* }"
  [ "$rc" -eq 0 ] || bad "$1" "$RUN_ST" "$c" "$n"
  pass "$1" "$RUN_ST" "$n"
}
apply() { # <STAGE> <file> <step>
  produce "$1" apply "$2" "$3"
  [ ! -s "$PRIV/$1.lines" ] || bad "$1" 0 GRAMMAR
  pass "$1"
}
stable() { grep -E '^(OTHERPOLICIES|GRANTS|COLUMNS|TRIGGERS) ' -- "$1" > "$2" || bad "$3" 0 TRANSPORT; }
policyset() { keyline "$1" POLICYSET | sed 's/^POLICYSET //' > "$2" || bad "$3" 0 TRANSPORT; }

sql TARGET check; pass TARGET
produce LEDGER_INIT run scripts/local-stack/narrow-reads/ledger.sql
expect LEDGER_INIT "$PRIV/LEDGER_INIT.lines" "LEDGER NONE"
catalog S0_CATALOG
policyset "$PRIV/S0_CATALOG.lines" "$PRIV/S0.set" S0_POLICYSET; expect S0_POLICYSET "$PRIV/S0.set" "$OLD_SET"
produce BASELINE run scripts/local-stack/narrow-reads/baseline.sql
expect BASELINE "$PRIV/BASELINE.lines" "BASELINE 2 2 1"
rowhash H0_ROWHASH
matrix MATRIX_OLD_1 OLD
apply APPLY "$MIG" apply
catalog S1_CATALOG
policyset "$PRIV/S1_CATALOG.lines" "$PRIV/S1.set" S1_POLICYSET; expect S1_POLICYSET "$PRIV/S1.set" "$NEW_SET"
stable "$PRIV/S0_CATALOG.lines" "$PRIV/S0.stable" S1_STABLE; stable "$PRIV/S1_CATALOG.lines" "$PRIV/S1.stable" S1_STABLE
same_file S1_STABLE "$PRIV/S1.stable" "$PRIV/S0.stable"
rowhash H1_ROWHASH; same_file H1_SAME "$PRIV/H1_ROWHASH.lines" "$PRIV/H0_ROWHASH.lines"
matrix MATRIX_NEW_1 NEW
apply ROLLBACK "$RB" rollback
catalog S2_CATALOG; same_file S2_EQUALS_S0 "$PRIV/S2_CATALOG.lines" "$PRIV/S0_CATALOG.lines"
rowhash H2_ROWHASH; same_file H2_SAME "$PRIV/H2_ROWHASH.lines" "$PRIV/H0_ROWHASH.lines"
matrix MATRIX_OLD_2 OLD
apply REAPPLY "$MIG" reapply
catalog S3_CATALOG; same_file S3_EQUALS_S1 "$PRIV/S3_CATALOG.lines" "$PRIV/S1_CATALOG.lines"
rowhash H3_ROWHASH; same_file H3_SAME "$PRIV/H3_ROWHASH.lines" "$PRIV/H0_ROWHASH.lines"
matrix MATRIX_NEW_2 NEW
produce LEDGER_FINAL run scripts/local-stack/narrow-reads/ledger.sql
expect LEDGER_FINAL "$PRIV/LEDGER_FINAL.lines" "LEDGER apply:$VERSION:$MIG_SHA,rollback:$VERSION:$RB_SHA,reapply:$VERSION:$MIG_SHA"
exit 0
