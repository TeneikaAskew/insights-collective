#!/usr/bin/env bash
# ABOUTME: Runs exactly the eight pinned T-09 SQL test files (07 excluded) and classifies each result. NEW must exit 0 with
# ABOUTME: PASS lines and no FAIL. OLD failures count only as assertion failures; any infrastructure error is INVALID.
# Usage: sql-tier.sh <loopback db url> OLD|NEW
# Exit: 0 when every file matches its expectation for the mode, 1 on any mismatch or INVALID result, 2 on setup errors.
set -u
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
  np=$(grep -c '^PASS ' <<<"$out"); nf=$(grep -c '^FAIL ' <<<"$out")
  errs=$(grep -E '(ERROR|FATAL):' <<<"$out")
  # The only acceptable error is the file's own closing assertion: "<n> ... check(s) failed" with n == FAIL lines.
  assert_err=$(grep -iE 'ERROR: +[0-9]+ .*check\(s\) failed' <<<"$errs")
  other_err=$(grep -viE 'ERROR: +[0-9]+ .*check\(s\) failed' <<<"$errs" | grep -v '^$')
  # The count comes from the text AFTER "ERROR:", never from the psql file:line prefix.
  n_assert=$(sed -nE 's/.*ERROR: +([0-9]+) .*/\1/p' <<<"$assert_err" | head -1)
  if [ -n "$other_err" ] || { [ $st -ne 0 ] && [ -z "$assert_err" ]; } || [ "$np$nf" = "00" ]; then
    echo "INVALID $name (infrastructure, not behaviour; exit $st, PASS $np, FAIL $nf): $(head -1 <<<"${other_err:-no assertion lines}")"; RC=1; continue
  fi
  if [ -n "$assert_err" ] && [ "$n_assert" != "$nf" ]; then
    echo "INVALID $name (assertion count $n_assert != FAIL lines $nf)"; RC=1; continue
  fi
  result=$([ $st -eq 0 ] && [ "$nf" -eq 0 ] && echo pass || echo fail)
  want=$([ "$MODE" = NEW ] && echo pass || echo "$oldexp")
  label=$([ "$MODE" = NEW ] && echo "NEW required exit0" || { [ "$oldexp" = fail ] && echo "OLD expected behavioural failure" || echo "OLD expected pass"; })
  if [ "$result" = "$want" ]; then echo "PASS $name: $label (exit $st, PASS $np, FAIL $nf)"
  else echo "FAIL $name: $label, got $result (exit $st, PASS $np, FAIL $nf)"; RC=1; fi
  [ "$MODE" = OLD ] && [ "$nf" -gt 0 ] && grep '^FAIL ' <<<"$out" | sed 's/^/      old-negative: /'
done
echo "== sql-tier $MODE: $([ $RC -eq 0 ] && echo 'all files match expectation' || echo MISMATCH)"; exit $RC
