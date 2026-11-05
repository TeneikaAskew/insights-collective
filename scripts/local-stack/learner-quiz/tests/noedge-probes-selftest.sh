#!/usr/bin/env bash
# ABOUTME: MOCKED self-test for noedge-probes.sh: fake docker and ss on PATH. Failed probes never establish absence, and DSN and
# ABOUTME: Bearer markers written to a probe's stderr never reach stdout, stderr or the evidence (staging) directory.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; PR="$HERE/noedge-probes.sh"
pass=0; fail=0; ok() { echo "PASS $1"; pass=$((pass+1)); }; no() { echo "FAIL $1: $2"; fail=$((fail+1)); }
mkdir -p "$T/bin" "$T/stage/checks"
for t in docker ss; do printf '#!/usr/bin/env bash\nprintf "%%b" "${FAKE_OUT:-}"; printf "%%b" "${FAKE_ERR:-}" >&2; exit "${FAKE_RC:-0}"\n' > "$T/bin/$t"; chmod +x "$T/bin/$t"; done
export PATH="$T/bin:$PATH"
M1='postgresql://postgres:DSNMARK7f3@127.0.0.1:54322/postgres'; M2='Authorization: Bearer eyJBEARERMARK9c1'
MERR="error: $M1\n$M2\n"; STACK='supabase_db_abcdefghijklmnopqrst\nsupabase_kong_abcdefghijklmnopqrst\n'
leak() { grep -rqE 'DSNMARK7f3|BEARERMARK9c1' "$T/out" "$T/err" "$T/stage" 2>/dev/null; }
run() { "$@" > "$T/out" 2> "$T/err"; }
for ph in before after; do
  EV="$T/stage/checks/no-edge-$ph.txt"
  FAKE_OUT="$STACK" run "$PR" absent $ph "$EV"; st=$?
  [ $st = 0 ] && grep -q "^PASS no-edge ($ph)" "$EV" && ok "A1-$ph successful listing, stack present, no edge: PASS and evidence" || no "A1-$ph" "exit $st"; rm -f "$EV"
  FAKE_OUT="${STACK}supabase_edge_runtime_abcdefghijklmnopqrst\n" run "$PR" absent $ph "$EV"; st=$?
  [ $st = 1 ] && [ ! -e "$EV" ] && ok "A2-$ph edge-runtime container present: FAIL, no evidence" || no "A2-$ph" "exit $st"
  FAKE_RC=1 FAKE_ERR="$MERR" FAKE_OUT="$STACK" run "$PR" absent $ph "$EV"; st=$?
  [ $st = 1 ] && [ ! -e "$EV" ] && grep -q "absence NOT established" "$T/out" && ! leak && ok "A3-$ph docker fails with DSN/Bearer stderr: fixed FAIL, markers absent from logs and staging" || no "A3-$ph" "exit $st"
  FAKE_ERR="$MERR" FAKE_OUT="$STACK" run "$PR" absent $ph "$EV"; st=$?
  [ $st = 0 ] && ! leak && ok "A4-$ph docker succeeds with marker stderr: stderr withheld (byte count only)" || no "A4-$ph" "exit $st"; rm -f "$EV"
  FAKE_OUT="" run "$PR" absent $ph "$EV"; st=$?
  [ $st = 1 ] && [ ! -e "$EV" ] && ok "A5-$ph empty listing (no stack shown): FAIL, absence not established" || no "A5-$ph" "exit $st"
  FAKE_OUT="${STACK}bad name with spaces\n" run "$PR" absent $ph "$EV"; st=$?
  [ $st = 1 ] && [ ! -e "$EV" ] && ok "A6-$ph unparsable listing line: FAIL" || no "A6-$ph" "exit $st"
done
FAKE_OUT="" run "$PR" port-free 8080; st=$?; [ $st = 0 ] && ok "P1 ss success, no listener: PASS" || no P1 "exit $st"
FAKE_OUT='LISTEN 0 511 127.0.0.1:8080 0.0.0.0:*\n' run "$PR" port-free 8080; st=$?; [ $st = 1 ] && ok "P2 listener present: FAIL" || no P2 "exit $st"
FAKE_RC=1 FAKE_ERR="$MERR" run "$PR" port-free 8080; st=$?; [ $st = 1 ] && grep -q "NOT established" "$T/out" && ! leak && ok "P3 ss fails with DSN/Bearer stderr: fixed FAIL, markers withheld" || no P3 "exit $st"
FAKE_ERR="$MERR" run "$PR" port-free 8080; st=$?; [ $st = 0 ] && ! leak && ok "P4 ss succeeds with marker stderr: withheld" || no P4 "exit $st"
FAKE_ERR="$MERR" run docker; leak && ok "C1 causal: the leak detector sees markers when a probe's stderr is NOT withheld" || no C1 "detector blind"; : > "$T/out"; : > "$T/err"
run "$PR" absent sometime "$T/x"; st=$?; [ $st = 2 ] && ok "U1 bad phase: usage (exit 2)" || no U1 "exit $st"
echo "== noedge-probes selftest (MOCKED docker/ss): $pass PASS, $fail FAIL"; [ $fail = 0 ]
