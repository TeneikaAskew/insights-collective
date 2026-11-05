#!/usr/bin/env bash
# ABOUTME: Runs exactly the eight pinned T-09 SQL test files (07 excluded) and classifies each result. NEW must exit 0 with
# ABOUTME: PASS lines and no FAIL. OLD failures count only as assertion failures; any infrastructure error is INVALID.
# Usage: sql-tier.sh <loopback db url> OLD|NEW
# Exit: 0 when every file matches its expectation for the mode, 1 on any mismatch or INVALID result, 2 on setup errors.
set -u
# classify <file> <want: pass|fail> <psql exit> <psql output>; prints one verdict line, returns 0 only on a match.
# A expected-pass file must exit 0 with PASS lines, no FAIL line and no error.
# An expected-fail (OLD) file must exit 3 (psql ON_ERROR_STOP) through EXACTLY one recognised closing assertion
# "<n> ... check(s) failed" whose n equals its non-zero FAIL-line count, with no other error. Anything else is either
# FAIL (a clean mismatch) or INVALID (infrastructure, or output that cannot be trusted as a behavioural result).
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

if [ "${1:-}" = "--selftest" ]; then
  # Synthetic outputs, no database. Each case states the verdict the classifier must give.
  RC=0; A='psql:/x/02_y.sql:9: ERROR:  2 guard check(s) failed'
  t() { local id="$1" want="$2" st="$3" out="$4" expect="$5" line; line=$(classify "$id" "$want" "$st" "$out"); 
        if [[ "$line" == "$expect"* ]]; then echo "PASS selftest $id -> $line"; else echo "FAIL selftest $id: wanted '$expect', got '$line'"; RC=1; fi; }
  t old-valid-negative fail 3 $'PASS a\nFAIL b\nFAIL c\n'"$A" 'PASS old-valid-negative'
  t old-exit0-with-FAIL fail 0 $'PASS a\nFAIL b\nFAIL c' 'INVALID old-exit0-with-FAIL (FAIL lines but exit 0'
  t old-exit0-clean fail 0 $'PASS a\nPASS b' 'FAIL old-exit0-clean: expected fail, got pass'
  t old-count-mismatch fail 3 $'FAIL b\n'"$A" 'INVALID old-count-mismatch (assertion count 2 != FAIL lines 1)'
  t old-infra-error fail 3 $'psql:/x/02_y.sql:4: ERROR:  function public.start_quiz_attempt(uuid) does not exist' 'INVALID old-infra-error (infrastructure'
  t old-infra-plus-assert fail 3 $'FAIL b\nFAIL c\npsql:/x:3: ERROR:  permission denied for table t\n'"$A" 'INVALID old-infra-plus-assert (infrastructure'
  t old-nonzero-no-assert fail 1 $'PASS a\nFAIL b' 'INVALID old-nonzero-no-assert (non-zero exit without'
  t old-assert-wrong-exit fail 1 $'FAIL b\nFAIL c\n'"$A" 'INVALID old-assert-wrong-exit (closing assertion but exit 1'
  t old-two-asserts fail 3 $'FAIL b\nFAIL c\n'"$A"$'\n'"$A" 'INVALID old-two-asserts (2 closing assertions'
  t old-no-lines fail 3 "$A" 'INVALID old-no-lines (no assertion lines'
  t old-connection fail 2 'psql: error: connection to server failed: FATAL:  password authentication failed' 'INVALID old-connection (infrastructure'
  t old-tainted-fail-line fail 3 $'FAIL x (refused: function public.f(uuid) does not exist, expected allowed)\n'"${A/2 guard/1 guard}" 'INVALID old-tainted-fail-line (FAIL line caused by a missing object'
  t new-valid pass 0 $'PASS a\nPASS b' 'PASS new-valid'
  t new-behavioural-fail pass 3 $'PASS a\nFAIL b\npsql:/x:9: ERROR:  1 guard check(s) failed' 'FAIL new-behavioural-fail: expected pass, got fail'
  t new-exit0-with-FAIL pass 0 $'PASS a\nFAIL b' 'INVALID new-exit0-with-FAIL'
  t new-no-lines pass 0 '' 'INVALID new-no-lines'
  echo "== sql-tier classifier selftest: $([ $RC -eq 0 ] && echo ALL PASS || echo FAILURES)"; exit $RC
fi
DB="${1:?loopback db url}"; MODE="${2:?OLD or NEW}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$DB" || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
# file | git blob | sha256 | OLD expectation -- pinned at 9cd162f (PG15-POSTGREST-PLAN-v2.md, table 2).
# OLD = snapshot + 000000 + 000100, so 01 and 03 already pass there; the other six must show assertion failures.
PINS=(
"01_cross_course_rls.sql|62da324dd9a757a14a748e062c6038175b3e34d2|88e2020f3dcc047d1ad4313fc9bbfc569ba18dca666638a236da12f9badb624f|pass"
"02_assessed_progression_guard.sql|67db88e85dff54f9e8746887a657dedac0c5058d|4446589d9aec32c44ff7fa2a3ca1e21424061cf5c16c699793b3a1c42f567c49|fail"
"03_start_quiz_attempt_authz.sql|8ddbd0d04d5e8d90f7ee1a98b54cae390008cc71|6776d9cc3e078e2ae7ba34288098076634180f46bf472b4cda1fd262e235b1a1|pass"
"04_quiz_completion_integrity.sql|911b269dc67d0bf849af46fe10fc58266388790e|f22136a62c9a07546b866fca28934d46f68f57fffb8c334c79eb4fc052128a6b|fail"
"05_identity_retarget.sql|017dd140c983524c381604c33e782532f0f4ef61|86d20823f28b04c39125f0b79b0a434d9b84fc8842622b4b70a44b22d071d345|fail"
"06_assignment_identity.sql|83b746abf61f5fda9fc5f097b41375c93ad3dc04|4c0e880dbd0e00b06f924ea386f6b3b7b23cd4e488a60b1531d3060c1d071830|fail"
"08_target_access_and_certificate_evidence.sql|cc85573b8007809d76c6fad632715f84a951328a|508f986f2a3094a8a45876435bccdcefa137a2228db40bddd96e1f8cfd840553|fail"
"09_final_submission_evidence.sql|8d55491f004d63e2b10c0375ed0c7263eef5b2e9|24bc8ad5d9cec269e38bc4869c97f258e82218331b455b2dedb19c781197c1db|fail"
)
case "$MODE" in OLD|NEW) ;; *) echo "mode must be OLD or NEW" >&2; exit 2 ;; esac
for pin in "${PINS[@]}"; do
  IFS='|' read -r name blob sha _ <<<"$pin"; f="$ROOT/scripts/local-db/tests/$name"
  [ -f "$f" ] && [ "$(git -C "$ROOT" hash-object "$f")" = "$blob" ] && [ "$(sha256sum "$f" | cut -d' ' -f1)" = "$sha" ] \
    || { echo "FAIL pin: $name does not match 9cd162f"; exit 1; }
done
echo "PASS pins: 8/8 test files match 9cd162f; mode $MODE"
RC=0
for pin in "${PINS[@]}"; do
  IFS='|' read -r name _ _ oldexp <<<"$pin"
  out=$(psql "$DB" -qAt -v ON_ERROR_STOP=1 -f "$ROOT/scripts/local-db/tests/$name" 2>&1); st=$?
  want=$([ "$MODE" = NEW ] && echo pass || echo "$oldexp")
  label=$([ "$MODE" = NEW ] && echo "NEW required exit0" || { [ "$oldexp" = fail ] && echo "OLD expected behavioural failure" || echo "OLD expected pass"; })
  line=$(classify "$name" "$want" "$st" "$out") || RC=1
  echo "${line/expected $want/$label}"
  nf=$(grep -c '^FAIL ' <<<"$out")
  [ "$MODE" = OLD ] && [ "$nf" -gt 0 ] && grep '^FAIL ' <<<"$out" | sed 's/^/      old-negative: /'
done
echo "== sql-tier $MODE: $([ $RC -eq 0 ] && echo 'all files match expectation' || echo MISMATCH)"; exit $RC
