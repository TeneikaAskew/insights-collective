#!/usr/bin/env bash
# ABOUTME: MOCKED isolation self-test with a FAKE psql on PATH: secrets never reach argv or printed output (fixture.sh), and
# ABOUTME: every bad DSN/template/scratch case refuses with zero (or only read-only) psql calls (fixture.sh, sql-selftest.sh).
# MOCKED: no database is contacted. The fake psql records each call's argv, its PGPASSWORD and its stdin, and echoes
# its argv AND stdin to stderr (as a real psql error can echo the failing statement), so a leak would be visible.
set -u
umask 077
HERE="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin"
cat > "$T/bin/psql" <<EOF
#!/usr/bin/env bash
n=\$(( \$(ls "$T"/call.* 2>/dev/null | wc -l) + 1 ))
printf '%s\n' "\$*" > "$T/call.\$n.argv"
printf '%s' "\${PGPASSWORD:-}" > "$T/call.\$n.pgpw"
stdin=""; for a in "\$@"; do [ "\$a" = "-" ] && stdin=\$(cat); done
printf '%s' "\$stdin" > "$T/call.\$n.stdin"
echo "psql: echo argv: \$*" >&2
echo "psql: echo stdin: \$stdin" >&2
[ -n "\${FAKE_PSQL_STDERR:-}" ] && echo "psql:<stdin>:9: \$FAKE_PSQL_STDERR" >&2
if [ -n "\${FAKE_PSQL_EXISTS:-}" ] && grep -q "from pg_database" <<<"\$stdin"; then echo 1; exit 0; fi
if [ -n "\${FAKE_PSQL_TPL_OK:-}" ] && grep -q "from pg_database" <<<"\$stdin"; then
  grep -q ":'tpl'" <<<"\$stdin" && echo 1 || echo 0; exit 0
fi
exit "\${FAKE_PSQL_EXIT:-0}"
EOF
chmod +x "$T/bin/psql"
LEARNER_PW="MARKER-learner-$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
DB_PW="MARKERdb$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
DSN="postgresql://postgres:$DB_PW@127.0.0.1:54399/postgres"
pass=0; fail=0
ok()  { echo "PASS $*"; pass=$((pass + 1)); }
bad() { echo "FAIL $*"; fail=$((fail + 1)); }
calls() { ls "$T"/call.*.argv 2>/dev/null | wc -l | tr -d ' '; }
reset() { rm -f "$T"/call.*; }
run() { env PATH="$T/bin:$PATH" "$@" 2>&1; }

# ---- fixture.sh
reset; out=$(FAKE_PSQL_EXIT=3 E2E_TEST_PASSWORD="$LEARNER_PW" SUPABASE_DB_URL="$DSN" run "$HERE/fixture.sh" --no-target-guard); st=$?
[ "$st" = 1 ] && ok "fixture.sh: psql failure is a FAIL (exit 1)" || bad "fixture.sh: psql failure exit $st"
grep -q "$LEARNER_PW" <<<"$out" && bad "fixture.sh: learner password leaked into output" || ok "fixture.sh: learner password not in output although psql echoed it"
grep -q "$DB_PW" <<<"$out" && bad "fixture.sh: DB password leaked into output" || ok "fixture.sh: DB password not in output"
grep -q "psql: echo" <<<"$out" && bad "fixture.sh: raw psql stderr forwarded" || ok "fixture.sh: raw psql stderr withheld"

NOTICE_OK="NOTICE:  quiz-lifecycle fixture: learner, course, 23 quizzes, 0 attempts"
reset; out=$(E2E_TEST_PASSWORD="$LEARNER_PW" SUPABASE_DB_URL="$DSN" run "$HERE/fixture.sh" --no-target-guard); st=$?
[ "$st" = 1 ] && grep -q "FAIL fixture \[F07\]" <<<"$out" && ok "fixture.sh: psql exit 0 without the completion notice is a FAIL (F07)" || bad "fixture.sh: missing notice accepted (exit $st)"
reset; out=$(FAKE_PSQL_STDERR="$NOTICE_OK" E2E_TEST_PASSWORD="$LEARNER_PW" SUPABASE_DB_URL="$DSN" run "$HERE/fixture.sh" --no-target-guard); st=$?
argv=$(cat "$T"/call.*.argv 2>/dev/null)
[ "$(calls)" = 1 ] && ok "fixture.sh: exactly one psql call" || bad "fixture.sh: psql calls $(calls)"
grep -q "$LEARNER_PW" <<<"$argv" && bad "fixture.sh: learner password in psql argv" || ok "fixture.sh: learner password not in psql argv"
grep -q "$DB_PW" <<<"$argv" && bad "fixture.sh: DB password in psql argv" || ok "fixture.sh: DB password not in psql argv"
[ "$(cat "$T"/call.1.pgpw 2>/dev/null)" = "$DB_PW" ] && ok "fixture.sh: DB password reaches psql only via PGPASSWORD" || bad "fixture.sh: PGPASSWORD not set as expected"
grep -q "$LEARNER_PW" "$T"/call.1.stdin 2>/dev/null && ok "fixture.sh: learner password reaches psql only via stdin" || bad "fixture.sh: learner password not on stdin"
grep -q "PASS fixture" <<<"$out" || bad "fixture.sh: success path did not report PASS"
reset; out=$(SUPABASE_DB_URL="$DSN" E2E_TEST_PASSWORD="$LEARNER_PW" run "$HERE/fixture.sh" --no-target-guard "$DSN"); st=$?
[ "$st" = 2 ] && [ "$(calls)" = 0 ] && ok "fixture.sh: a DSN passed as an argument is refused" || bad "fixture.sh: positional DSN accepted (exit $st)"

for case in "non-loopback|postgresql://postgres@db.example.com:5432/postgres" \
            "keyword form|host=127.0.0.1 port=5432 dbname=postgres user=postgres" \
            "query override|postgresql://postgres@127.0.0.1:5432/postgres?host=db.example.com" \
            "no port|postgresql://postgres@127.0.0.1/postgres"; do
  reset; out=$(E2E_TEST_PASSWORD="$LEARNER_PW" SUPABASE_DB_URL="${case#*|}" run "$HERE/fixture.sh" --no-target-guard); st=$?
  [ "$st" = 2 ] && [ "$(calls)" = 0 ] && ok "fixture.sh: ${case%%|*} DSN refused before any psql call" || bad "fixture.sh: ${case%%|*} (exit $st, calls $(calls))"
done

# Fixed failure messages: a marker after the fixture's own prefix never prints, and the failure is still reported.
MK="MARKERmsg$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
reset; out=$(FAKE_PSQL_EXIT=3 FAKE_PSQL_STDERR="ERROR:  quiz-lifecycle fixture: $MK unexpected" E2E_TEST_PASSWORD="$LEARNER_PW" SUPABASE_DB_URL="$DSN" run "$HERE/fixture.sh" --no-target-guard); st=$?
[ "$st" = 1 ] && grep -q "FAIL fixture \[F00\]" <<<"$out" && ! grep -q "$MK" <<<"$out" && ok "fixture.sh: unknown prefixed error -> fixed F00, marker absent, failure kept" || bad "fixture.sh: prefixed marker (exit $st): $out"
reset; out=$(FAKE_PSQL_EXIT=3 FAKE_PSQL_STDERR="ERROR:  quiz-lifecycle fixture: the learner already holds attempts; $MK" E2E_TEST_PASSWORD="$LEARNER_PW" SUPABASE_DB_URL="$DSN" run "$HERE/fixture.sh" --no-target-guard); st=$?
[ "$st" = 1 ] && grep -q "FAIL fixture \[F02\]" <<<"$out" && ! grep -q "$MK" <<<"$out" && ok "fixture.sh: known error with a marker suffix -> fixed F02 text, marker absent" || bad "fixture.sh: F02 marker (exit $st): $out"
reset; out=$(FAKE_PSQL_STDERR="NOTICE:  quiz-lifecycle fixture: learner, course, 23 quizzes, 0 attempts $MK" E2E_TEST_PASSWORD="$LEARNER_PW" SUPABASE_DB_URL="$DSN" run "$HERE/fixture.sh" --no-target-guard); st=$?
[ "$st" = 0 ] && grep -q "PASS fixture" <<<"$out" && ! grep -q "$MK" <<<"$out" && ok "fixture.sh: success notice with a marker suffix -> fixed line, marker absent" || bad "fixture.sh: notice marker (exit $st): $out"

# Full child chain: every execve of fixture.sh and all its descendants, traced. No password in any argv.
if command -v strace >/dev/null; then
  reset; strace -f -qq -e trace=execve -s 65535 -o "$T/trace" env PATH="$T/bin:$PATH" E2E_TEST_PASSWORD="$LEARNER_PW" SUPABASE_DB_URL="$DSN" \
    FAKE_PSQL_STDERR="NOTICE:  quiz-lifecycle fixture: learner, course, 23 quizzes, 0 attempts" "$HERE/fixture.sh" --no-target-guard >/dev/null 2>&1
  n=$(grep -c 'execve(' "$T/trace"); grep -q 'execve("[^"]*/psql"' "$T/trace" && ok "chain trace: $n execve calls captured, including psql" || bad "chain trace did not capture psql"
  # The trace's first line is the launcher (strace's own `env ... SUPABASE_DB_URL=...` argv, test harness only); judge the chain after it.
  tail -n +2 "$T/trace" | grep -q "$DB_PW" && bad "chain trace: DB password in some descendant argv" || ok "chain trace: DB password in no argv of fixture.sh or any descendant"
  tail -n +2 "$T/trace" | grep -q "$LEARNER_PW" && bad "chain trace: learner password in some descendant argv" || ok "chain trace: learner password in no argv of fixture.sh or any descendant"
  [ "$(cat "$T"/call.1.pgpw 2>/dev/null)" = "$DB_PW" ] && ok "chain trace: psql still received the DB password (process environment)" || bad "chain trace: psql did not receive PGPASSWORD"
  # Causal control: the detector sees an `env VAR=secret` argv (the 989c22f pattern).
  strace -f -qq -e trace=execve -s 65535 -o "$T/trace2" bash -c 'env PGPASSWORD="$1" true' _ "$DB_PW" >/dev/null 2>&1
  tail -n +2 "$T/trace2" | grep -q "env.*PGPASSWORD=$DB_PW" && ok "chain trace control: an env-argv password IS detected" || bad "chain trace control: detector missed an env-argv password"
else
  bad "strace unavailable: full child chain not traced"
fi

# ---- revoke-access.sh (T-62)
for case in "bad key|21" "injection key|20;drop" "empty key|"; do
  reset; out=$(SUPABASE_DB_URL="$DSN" run "$HERE/revoke-access.sh" "${case#*|}" --no-target-guard); st=$?
  [ "$st" = 2 ] && [ "$(calls)" = 0 ] && ok "revoke-access: ${case%%|*} refused before any psql call" || bad "revoke-access: ${case%%|*} (exit $st, calls $(calls))"
done
reset; out=$(SUPABASE_DB_URL="$DSN" run "$HERE/revoke-access.sh" 20 "$DSN"); st=$?
[ "$st" = 2 ] && [ "$(calls)" = 0 ] && ok "revoke-access: a DSN argument is refused" || bad "revoke-access: positional DSN (exit $st)"
reset; out=$(SUPABASE_DB_URL="postgresql://postgres@db.example.com:5432/postgres" run "$HERE/revoke-access.sh" 20 --no-target-guard); st=$?
[ "$st" = 2 ] && [ "$(calls)" = 0 ] && ok "revoke-access: non-loopback DSN refused before any psql call" || bad "revoke-access: non-loopback (exit $st)"
reset; out=$(FAKE_PSQL_EXIT=3 FAKE_PSQL_STDERR="ERROR:  quiz-lifecycle revoke: expected exactly one synthetic enrollment, found 0 $MK" SUPABASE_DB_URL="$DSN" run "$HERE/revoke-access.sh" 20 --no-target-guard); st=$?
[ "$st" = 1 ] && grep -q "FAIL revoke \[V01\]" <<<"$out" && ! grep -q "$MK" <<<"$out" && ! grep -q "$DB_PW" <<<"$out" && ok "revoke-access: fixed V01 failure, marker and DB password absent" || bad "revoke-access: failure output (exit $st): $out"
if command -v strace >/dev/null; then
  reset; strace -f -qq -e trace=execve -s 65535 -o "$T/trace3" env PATH="$T/bin:$PATH" SUPABASE_DB_URL="$DSN" \
    FAKE_PSQL_STDERR="NOTICE:  quiz-lifecycle revoke: one synthetic enrollment removed" "$HERE/revoke-access.sh" 20 --no-target-guard >/dev/null 2>&1
  grep -q 'execve("[^"]*/psql"' "$T/trace3" && ! tail -n +2 "$T/trace3" | grep -q "$DB_PW" && [ "$(cat "$T"/call.1.pgpw 2>/dev/null)" = "$DB_PW" ] \
    && ok "revoke-access chain trace: psql reached, DB password in no argv, delivered via environment" || bad "revoke-access chain trace"
  grep -q "9c0020" "$T"/call.1.stdin && ok "revoke-access: statement names only synthetic course 20" || bad "revoke-access: statement target"
fi

# ---- sql-selftest.sh
for case in "template injection|$DSN|tpl; drop database x" \
            "template quote|$DSN|tpl\"x" \
            "template upper-case|$DSN|Qlc_Tpl" \
            "maintenance db not postgres|postgresql://postgres@127.0.0.1:54399/other|qlc_tpl" \
            "maintenance query override|postgresql://postgres@127.0.0.1:54399/postgres?host=db.example.com|qlc_tpl" \
            "maintenance non-loopback|postgresql://postgres@db.example.com:5432/postgres|qlc_tpl"; do
  IFS='|' read -r name base tpl <<<"$case"
  reset; out=$(run "$HERE/tests/sql-selftest.sh" "$base" "$tpl"); st=$?
  [ "$st" = 2 ] && [ "$(calls)" = 0 ] && ok "sql-selftest: $name refused before any psql call" || bad "sql-selftest: $name (exit $st, calls $(calls))"
done
reset; out=$(FAKE_PSQL_EXISTS=1 run "$HERE/tests/sql-selftest.sh" "$DSN" qlc_tpl); st=$?
all=$(cat "$T"/call.*.stdin 2>/dev/null)
[ "$st" = 2 ] && grep -q "already exists; not adopting" <<<"$out" && ok "sql-selftest: existing scratch name refused (no adoption)" || bad "sql-selftest: existing scratch (exit $st)"
grep -qiE "create database|drop database" <<<"$all" && bad "sql-selftest: created or dropped although the name existed" || ok "sql-selftest: no create and no drop when the name exists"
reset; out=$(FAKE_PSQL_TPL_OK=1 FAKE_PSQL_EXIT=1 run "$HERE/tests/sql-selftest.sh" "$DSN" qlc_tpl); st=$?
all=$(cat "$T"/call.*.stdin 2>/dev/null)
grep -qi "drop database" <<<"$all" && bad "sql-selftest: dropped a database it did not create" || ok "sql-selftest: failed create leads to no drop"
grep -q "$DB_PW" "$T"/call.*.argv 2>/dev/null && bad "sql-selftest: DB password in psql argv" || ok "sql-selftest: DB password not in psql argv"

echo "== MOCKED isolation-selftest: $pass passed, $fail failed (FAKE psql; no database contacted)"
[ "$fail" -eq 0 ]
