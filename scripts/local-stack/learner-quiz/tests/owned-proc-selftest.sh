#!/usr/bin/env bash
# ABOUTME: LOCAL self-test for owned-proc.sh with real throwaway processes, and a MOCKED ss on PATH for the port checks.
# ABOUTME: Shows that only owned groups are signalled, that a reused pid and look-alike processes survive, and fail-closed exits.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; T=$(mktemp -d); OP="$HERE/owned-proc.sh"
pass=0; fail=0; KEEP=()
cleanup() { for p in "${KEEP[@]}"; do kill -KILL "$p" 2>/dev/null; done; rm -rf "$T"; }; trap cleanup EXIT
ok() { echo "PASS $1"; pass=$((pass+1)); }; no() { echo "FAIL $1: $2"; fail=$((fail+1)); }
mkdir "$T/bin"; printf '#!/usr/bin/env bash\n[ -n "${FAKE_SS_FAIL:-}" ] && exit 1\nprintf "%%b" "${FAKE_SS:-}"\n' > "$T/bin/ss"; chmod +x "$T/bin/ss"
export PATH="$T/bin:$PATH"
# Zombies are excluded: a container without a reaping init leaves killed children as <defunct> entries.
live_group() { ps -eo pgid=,stat= | awk -v g="$1" '$1==g && $2 !~ /^Z/ {f=1} END {exit !f}'; }
alive() { kill -0 "$1" 2>/dev/null && [ "$(awk '{print $3}' "/proc/$1/stat" 2>/dev/null)" != Z ]; }

# O1: an owned group (parent plus child) is stopped; the port is free.
S="$T/o1"; bash "$OP" start "$S" functions "$T/o1.log" -- bash -c 'sleep 300 & sleep 300; wait' >/dev/null
read -r P1 _ < "$S/functions.own"; sleep 0.3
bash "$OP" stop "$S" 8080 > "$T/out"; st=$?
if [ $st = 0 ] && ! alive "$P1" && ! live_group "$P1" && grep -q "owned group stopped" "$T/out" && grep -q "port 8080: no listener" "$T/out"; then ok "O1 owned group stopped, 8080 free (exit 0)"; else no O1 "exit $st $(cat "$T/out")"; fi

# O2: a look-alike process with the same command line (what pkill -f would have hit) is NOT signalled.
bash -c 'exec -a "vite preview --outDir /x" sleep 300' & LA=$!; KEEP+=("$LA")
S="$T/o2"; bash "$OP" start "$S" preview "$T/o2.log" -- bash -c 'exec -a "vite preview --outDir /served" sleep 300' >/dev/null; sleep 0.3
bash "$OP" stop "$S" 8080 > "$T/out"; st=$?
if [ $st = 0 ] && alive "$LA"; then ok "O2 look-alike 'vite preview --outDir' process survives (exit 0)"; else no O2 "exit $st"; fi

# O3: a reused pid (record starttime differs) is not signalled.
sleep 300 & R=$!; KEEP+=("$R"); S="$T/o3"; mkdir -p "$S"; echo "$R 1" > "$S/preview.own"
bash "$OP" stop "$S" 8080 > "$T/out"; st=$?
if [ $st = 0 ] && alive "$R" && grep -q "pid reused" "$T/out"; then ok "O3 reused pid not signalled (exit 0)"; else no O3 "exit $st $(cat "$T/out")"; fi

# O4: a group that ignores SIGTERM is escalated to SIGKILL and stopped.
S="$T/o4"; bash "$OP" start "$S" functions "$T/o4.log" -- bash -c 'trap "" TERM; sleep 300 & trap "" TERM; while :; do sleep 1; done' >/dev/null; sleep 0.3
read -r P4 _ < "$S/functions.own"; bash "$OP" stop "$S" 8080 > "$T/out"; st=$?
if [ $st = 0 ] && ! live_group "$P4"; then ok "O4 TERM-ignoring group killed (exit 0)"; else no O4 "exit $st $(cat "$T/out")"; fi

# O5: the record exists at launch, so a readiness failure right after start still stops the server.
S="$T/o5"; bash "$OP" start "$S" preview "$T/o5.log" -- sleep 300 >/dev/null; [ -s "$S/preview.own" ] && rec=1 || rec=0
read -r P5 _ < "$S/preview.own"; bash "$OP" stop "$S" 8080 > /dev/null; st=$?
if [ $rec = 1 ] && [ $st = 0 ] && ! alive "$P5"; then ok "O5 record written at launch; stopped after a simulated readiness failure"; else no O5 "rec $rec exit $st"; fi

# O6: a listener still on 8080 fails the step.
S="$T/o6"; mkdir -p "$S"; FAKE_SS='LISTEN 0 511 127.0.0.1:8080 0.0.0.0:*\n' bash "$OP" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 1 ] && grep -q "listener is still present" "$T/out" && ok "O6 listener on 8080 fails (exit 1)" || no O6 "exit $st"

# O7: an inspection error (ss fails) fails closed.
FAKE_SS_FAIL=1 bash "$OP" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 3 ] && ok "O7 ss failure is an inspection error (exit 3)" || no O7 "exit $st"

# O8: a malformed record fails closed and signals nothing.
S="$T/o8"; mkdir -p "$S"; echo "x y" > "$S/bad.own"; bash "$OP" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 3 ] && ok "O8 malformed record (exit 3)" || no O8 "exit $st"

# O9: a duplicate start for the same name is refused (no record overwrite).
S="$T/o9"; bash "$OP" start "$S" preview "$T/o9.log" -- sleep 300 >/dev/null; read -r P9 _ < "$S/preview.own"; KEEP+=("$P9")
bash "$OP" start "$S" preview "$T/o9b.log" -- sleep 300 > "$T/out"; st=$?
[ $st = 2 ] && grep -q "already exists" "$T/out" && ok "O9 duplicate record refused (exit 2)" || no O9 "exit $st"
bash "$OP" stop "$S" 8080 >/dev/null

echo "== owned-proc selftest (LOCAL processes, MOCKED ss): $pass PASS, $fail FAIL"; [ $fail = 0 ]
