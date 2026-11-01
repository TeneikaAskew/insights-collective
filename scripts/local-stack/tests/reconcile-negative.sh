#!/usr/bin/env bash
# ABOUTME: No-database regressions for reconcile-table-acl.sh: every input or capture failure must stop BEFORE psql
# ABOUTME: starts (a fake psql on PATH records each invocation), the loopback guard still runs first, and broken
# ABOUTME: text tools (sed/awk/sort/grep/cut exiting 19) can no longer empty the capture.
# Optional: RECONCILE_SH points at another copy of the script (used for the before/after control).
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; R="${RECONCILE_SH:-$ROOT/scripts/local-stack/reconcile-table-acl.sh}"
G="$ROOT/scripts/local-stack/schema/05_triggers_grants.sql"; DSN="postgresql://postgres@127.0.0.1:54329/none"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT; mkdir -p "$W/bin" "$W/brokentools"
cat > "$W/bin/psql" <<'P'
#!/usr/bin/env bash
n=$(ls "$FAKE_DIR"/call.* 2>/dev/null | wc -l); printf '%s\n' "$@" > "$FAKE_DIR/call.$n.args"; cat > "$FAKE_DIR/call.$n.stdin"
printf '%b' "${FAKE_PSQL_OUT-END}"; exit "${FAKE_PSQL_EXIT:-0}"
P
chmod +x "$W/bin/psql"
for t in sed awk sort grep cut; do printf '#!/usr/bin/env bash\nexit 19\n' > "$W/brokentools/$t"; chmod +x "$W/brokentools/$t"; done
npass=0; nfail=0; rc=0
say() { if [ "$2" -eq 0 ]; then echo "PASS $1"; npass=$((npass+1)); else echo "FAIL $1"; nfail=$((nfail+1)); rc=1; fi; }
calls() { ls "$W/fake"/call.*.args 2>/dev/null | wc -l; }
run() { rm -rf "$W/fake"; mkdir -p "$W/fake"; FAKE_DIR="$W/fake" PATH="$W/bin:$PATH" "$@" > "$W/out" 2>&1; echo $? > "$W/st"; }
refuse() { # name, then the reconcile arguments: must exit non-zero with ZERO psql invocations
  local name="$1"; shift; run "$R" "$@"; local st; st=$(cat "$W/st"); local c; c=$(calls)
  [ "$st" -ne 0 ] && [ "$c" = "0" ]; say "$name (exit $st, psql calls $c)" $?
}
EXPECTED=$(env -i bash -c 'n=0; while IFS= read -r l; do [[ "$l" =~ ^grant\ ([A-Z, ]+)\ on\ public\. ]] || continue; IFS=, read -ra p <<< "${BASH_REMATCH[1]// /}"; n=$((n+${#p[@]})); done < "$1"; echo $n' _ "$G")

# Inputs that must stop before psql
refuse "missing grant file"             "$DSN" "$W/nope.sql"
: > "$W/empty.sql"; refuse "empty grant file" "$DSN" "$W/empty.sql"
echo "-- no grants here" > "$W/nogrant.sql"; refuse "file with no table grant lines" "$DSN" "$W/nogrant.sql"
{ cat "$G"; echo 'grant SELECT on public."Odd Table" to anon;'; } > "$W/odd.sql"; refuse "unparseable grant line" "$DSN" "$W/odd.sql"
{ cat "$G"; echo 'grant SELECTX on public.courses to anon;'; } > "$W/badpriv.sql"; refuse "unknown privilege word" "$DSN" "$W/badpriv.sql"
{ cat "$G"; echo 'grant SELECT on public.courses to postgres;'; } > "$W/badrole.sql"; refuse "grant to a role outside the three API roles" "$DSN" "$W/badrole.sql"
refuse "broken-live list that is not identifiers" "$DSN" "$G" "x');drop table y;--"
refuse "non-loopback DSN (loopback guard runs first)" "postgresql://postgres@db.example.com:5432/postgres" "$G"
if [ "$(id -u)" = "0" ] && command -v setpriv >/dev/null; then
  cp "$G" "$W/unreadable.sql"; chmod 000 "$W/unreadable.sql"; chmod 755 "$W" "$W/bin"; chmod 777 "$W/fake" 2>/dev/null
  rm -rf "$W/fake"; mkdir -p "$W/fake"; chmod 777 "$W/fake"
  FAKE_DIR="$W/fake" PATH="$W/bin:$PATH" setpriv --reuid=1000 --regid=1000 --clear-groups "$R" "$DSN" "$W/unreadable.sql" > "$W/out" 2>&1; st=$?; c=$(calls)
  [ "$st" -ne 0 ] && [ "$c" = "0" ]; say "unreadable grant file (uid 1000; exit $st, psql calls $c)" $?
else echo "SKIP unreadable grant file (needs root + setpriv to drop to uid 1000)"; fi

# Broken text tools cannot empty the capture: psql receives exactly the expected privileges
run env PATH="$W/bin:$W/brokentools:$PATH" "$R" "$DSN" "$G" quiz_analytics; st=$(cat "$W/st")
rows=$(env -i bash -c 'n=0; on=0; while IFS= read -r l; do [ "$l" = "copy cap from stdin;" ] && { on=1; continue; }; [ "$l" = "\\." ] && break; [ $on = 1 ] && n=$((n+1)); done < "$1"; echo $n' _ "$W/fake/call.0.stdin" 2>/dev/null)
[ "$st" -eq 0 ] && [ "$(calls)" = "1" ] && [ "$rows" = "$EXPECTED" ] && [ "$EXPECTED" -gt 0 ]
say "sed/awk/sort/grep/cut all exiting 19: capture still complete ($rows of $EXPECTED privileges sent, one psql call)" $?

# psql failures are fatal
FAKE_PSQL_EXIT=3 run "$R" "$DSN" "$G" quiz_analytics; st=$(cat "$W/st"); [ "$st" -eq 2 ]; say "psql exit 3 is fatal (exit $st)" $?
FAKE_PSQL_OUT='' run "$R" "$DSN" "$G" quiz_analytics; st=$(cat "$W/st"); [ "$st" -eq 2 ] && grep -q "no END marker" "$W/out"; say "psql output without the END marker is fatal (exit $st)" $?
FAKE_PSQL_OUT='MISSING\tquiz_questions\tauthenticated\tSELECT\nEND' run "$R" "$DSN" "$G" quiz_analytics; st=$(cat "$W/st"); [ "$st" -eq 1 ]; say "a MISSING row fails the reconcile (exit $st)" $?
echo "reconcile-negative: $npass PASS, $nfail FAIL; exit $rc"; exit $rc
