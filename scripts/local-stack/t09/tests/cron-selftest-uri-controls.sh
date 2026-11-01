#!/usr/bin/env bash
# ABOUTME: FAKE-psql controls for cron-state-selftest.sh: every malformed, keyword, query, fragment or non-postgres
# ABOUTME: maintenance URI must be refused with ZERO psql calls. A canonical URI must reach the (fake) psql.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; T="$HERE/cron-state-selftest.sh"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
printf '#!/usr/bin/env bash\necho "psql $*" >> "%s/psql.log"\nexit 1\n' "$W" > "$W/psql"; chmod 700 "$W/psql"
pass=0; fail=0
run() { rm -f "$W/psql.log"; PATH="$W:$PATH" bash "$T" "$1" > "$W/out" 2>&1; echo $?; }
calls() { [ -f "$W/psql.log" ] && wc -l < "$W/psql.log" || echo 0; }
U='postgresql://postgres@127.0.0.1:54329'
while IFS='|' read -r label uri; do
  st=$(run "$uri"); c=$(calls)
  if [ "$st" -ne 0 ] && [ "$c" -eq 0 ]; then echo "PASS $label refused (exit $st), psql calls 0"; pass=$((pass+1)); else echo "FAIL $label exit $st, psql calls $c"; fail=$((fail+1)); fi
done <<LIST
Q1-query-with-slash|$U/postgres?application_name=foo/bar
Q2-query-plain|$U/postgres?sslmode=disable
F1-fragment|$U/postgres#x
K1-keyword-dsn|host=127.0.0.1 port=54329 dbname=postgres user=postgres
K2-keyword-dsn-in-uri-db|$U/dbname=postgres
D1-other-database|$U/template1
D2-trailing-slash|$U/postgres/
D3-no-database|$U
D4-empty|
H1-non-loopback|postgresql://postgres@10.0.0.5:54329/postgres
S1-scheme-postgres|postgres://postgres@127.0.0.1:54329/postgres
P1-path-traversal|$U/postgres/../template1
W1-whitespace|$U/postgres x
LIST
st=$(run "$U/postgres"); c=$(calls)
if [ "$c" -ge 1 ] && grep -q "$U/postgres -c create database" "$W/psql.log"; then echo "PASS C1-canonical reaches psql (calls $c; exit $st from the failing fake)"; pass=$((pass+1)); else echo "FAIL C1-canonical calls $c"; fail=$((fail+1)); fi
echo "== cron-selftest URI controls (FAKE psql): $pass PASS, $fail FAIL"
[ $fail -eq 0 ]
