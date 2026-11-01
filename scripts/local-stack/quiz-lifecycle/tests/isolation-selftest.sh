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

reset; out=$(E2E_TEST_PASSWORD="$LEARNER_PW" SUPABASE_DB_URL="$DSN" run "$HERE/fixture.sh" --no-target-guard); st=$?
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
