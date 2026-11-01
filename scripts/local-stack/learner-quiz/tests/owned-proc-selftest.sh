#!/usr/bin/env bash
# ABOUTME: LOCAL self-test for owned-proc.mjs: real throwaway processes, a MOCKED ss on PATH, and a FAKE /proc root for fault
# ABOUTME: injection. Only verified owned groups are signalled; every inspection failure is an error, never "absent".
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; T=$(mktemp -d); OP=(node "$HERE/owned-proc.mjs")
pass=0; fail=0; KEEP=()
cleanup() { for p in "${KEEP[@]}"; do kill -KILL "$p" 2>/dev/null; done; rm -rf "$T"; }; trap cleanup EXIT
ok() { echo "PASS $1"; pass=$((pass+1)); }; no() { echo "FAIL $1: $2"; fail=$((fail+1)); }
mkdir "$T/bin"; printf '#!/usr/bin/env bash\n[ -n "${FAKE_SS_FAIL:-}" ] && exit 1\nprintf "%%b" "${FAKE_SS:-}"\n' > "$T/bin/ss"; chmod +x "$T/bin/ss"
export PATH="$T/bin:$PATH"
# Zombies are excluded: this container has no reaping init, so killed children stay <defunct>.
live_group() { ps -eo pgid=,stat= | awk -v g="$1" '$1==g && $2 !~ /^Z/ {f=1} END {exit !f}'; }
alive() { kill -0 "$1" 2>/dev/null && [ "$(awk '{print $3}' "/proc/$1/stat" 2>/dev/null)" != Z ]; }
fakestat() { # dir pid pgid sid start
  mkdir -p "$1/$2"; echo "$2 (fake proc) S 1 $3 $4 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 $5 0 0" > "$1/$2/stat"; }

S="$T/o1"; "${OP[@]}" start "$S" functions "$T/o1.log" -- bash -c 'sleep 300 & sleep 300; wait' > "$T/out"; st=$?
read -r P1 _ < "$S/functions.own"; sleep 0.3
grep -q "handshake verified" "$T/out" && [ $st = 0 ] && ok "O0 launch handshake verified (own session and group) before the record" || no O0 "exit $st $(cat "$T/out")"
"${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
if [ $st = 0 ] && ! live_group "$P1" && grep -q "port 8080: no listener" "$T/out"; then ok "O1 owned group stopped, 8080 free (exit 0)"; else no O1 "exit $st $(cat "$T/out")"; fi

bash -c 'exec -a "vite preview --outDir /x" sleep 300' & LA=$!; KEEP+=("$LA")
S="$T/o2"; "${OP[@]}" start "$S" preview "$T/o2.log" -- bash -c 'exec -a "vite preview --outDir /served" sleep 300' >/dev/null; sleep 0.3
"${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 0 ] && alive "$LA" && ok "O2 look-alike 'vite preview --outDir' process survives" || no O2 "exit $st"

sleep 300 & R=$!; KEEP+=("$R"); S="$T/o3"; mkdir -p "$S"; echo "$R 1 $R $R" > "$S/preview.own"
"${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 0 ] && alive "$R" && grep -q "pid reused" "$T/out" && ok "O3 reused leader pid (starttime differs) not signalled" || no O3 "exit $st $(cat "$T/out")"

S="$T/o4"; "${OP[@]}" start "$S" functions "$T/o4.log" -- bash -c 'trap "" TERM; sleep 300 & while :; do sleep 1; done' >/dev/null; sleep 0.3
read -r P4 _ < "$S/functions.own"; "${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 0 ] && ! live_group "$P4" && ok "O4 TERM-ignoring group escalated to KILL after re-proving ownership" || no O4 "exit $st $(cat "$T/out")"

FAKE_SS='LISTEN 0 511 127.0.0.1:8080 0.0.0.0:*\n' "${OP[@]}" stop "$T/none" 8080 > "$T/out"; st=$?
[ $st = 1 ] && grep -q "listener is still present" "$T/out" && ok "O5 listener on 8080 fails (exit 1)" || no O5 "exit $st"
FAKE_SS_FAIL=1 "${OP[@]}" stop "$T/none" 8080 > "$T/out"; st=$?
[ $st = 3 ] && ok "O6 ss failure is an inspection error (exit 3)" || no O6 "exit $st"
S="$T/o7"; mkdir -p "$S"; echo "x y" > "$S/bad.own"; "${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 3 ] && ok "O7 malformed record (exit 3)" || no O7 "exit $st"
S="$T/o8"; "${OP[@]}" start "$S" preview "$T/o8.log" -- sleep 300 >/dev/null; read -r P8 _ < "$S/preview.own"; KEEP+=("$P8")
"${OP[@]}" start "$S" preview "$T/o8b.log" -- sleep 300 > "$T/out"; st=$?
[ $st = 2 ] && grep -q "already exists" "$T/out" && ok "O8 duplicate record refused (exit 2)" || no O8 "exit $st"
"${OP[@]}" stop "$S" 8080 >/dev/null

# New controls (18:33Z batch).
S="$T/o9"; "${OP[@]}" start "$S" preview "$T/o9.log" -- /nonexistent/command-o9 > "$T/out"; st=$?
[ $st = 3 ] && [ ! -e "$S/preview.own" ] && grep -qE "spawn failed|handshake failed" "$T/out" && ok "O9 child never verified (spawn failure): nothing recorded, nothing signalled (exit 3)" || no O9 "exit $st $(cat "$T/out")"
S="$T/o10"; OWNED_PROC_FAIL_RECORD_WRITE=1 "${OP[@]}" start "$S" functions "$T/o10.log" -- bash -c 'exec -a o10-marker-child sleep 300' > "$T/out"; st=$?
sleep 0.3; left=$(ps -eo stat=,args= | awk '$1 !~ /^Z/ && /o10-marker-child/ && !/awk/' | wc -l)
[ $st = 3 ] && [ "$left" = 0 ] && [ ! -e "$S/functions.own" ] && [ ! -e "$S/functions.own.tmp" ] && grep -q "verified child group rolled back" "$T/out" && ok "O10 record write failure rolls back ONLY the verified child (exit 3)" || no O10 "exit $st $(cat "$T/out")"
F="$T/procfile"; : > "$F"; S="$T/o11"; mkdir -p "$S"; echo "4190001 100 4190001 4190001" > "$S/x.own"
OWNED_PROC_PROC_ROOT="$F" "${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 3 ] && grep -q "cannot read stat" "$T/out" && ok "O11 /proc unreadable: inspection error, not 'absent' (exit 3)" || no O11 "exit $st $(cat "$T/out")"
FP="$T/fp12"; mkdir -p "$FP/4190001/stat"; OWNED_PROC_PROC_ROOT="$FP" "${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 3 ] && ok "O12 stat read error other than ENOENT (EISDIR): inspection error (exit 3)" || no O12 "exit $st $(cat "$T/out")"
FP="$T/fp13"; mkdir -p "$FP"; fakestat "$FP" 4190002 4190001 999 200
OWNED_PROC_PROC_ROOT="$FP" "${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 1 ] && grep -q "REFUSED, nothing signalled" "$T/out" && ok "O13 leader gone, reused PGID member from another session: REFUSED, nothing signalled (exit 1)" || no O13 "exit $st $(cat "$T/out")"
FP="$T/fp14"; mkdir -p "$FP"; fakestat "$FP" 4190002 4190001 4190001 50
OWNED_PROC_PROC_ROOT="$FP" "${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 1 ] && grep -q "REFUSED" "$T/out" && ok "O14 leader gone, member started BEFORE the leader (not ours): REFUSED (exit 1)" || no O14 "exit $st $(cat "$T/out")"
FP="$T/fp15"; mkdir -p "$FP/4190002"; echo "garbage" > "$FP/4190002/stat"
OWNED_PROC_PROC_ROOT="$FP" "${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
[ $st = 3 ] && grep -q "unparsable stat" "$T/out" && ok "O15 unparsable stat during group enumeration: inspection error (exit 3)" || no O15 "exit $st $(cat "$T/out")"
# CHANGED 18:57Z (user batch item 1): a leaderless remainder is REFUSED, no longer signalled on same sid/pgid + later start.
S="$T/o16"; "${OP[@]}" start "$S" functions "$T/o16.log" -- bash -c 'exec -a o16-orphan sleep 300 & sleep 1; exit 0' >/dev/null; read -r P16 _ < "$S/functions.own"; sleep 1.5
"${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
o16=$(ps -eo pid=,stat=,args= | awk '$2 !~ /^Z/ && /o16-orphan/ && !/awk/ {print $1}'); for p in $o16; do KEEP+=("$p"); done
[ $st = 1 ] && [ -n "$o16" ] && grep -q "leader gone .* REFUSED, nothing signalled" "$T/out" && ok "O16 leader exited, a later-start member of the same session remains: REFUSED visibly, not signalled (exit 1)" || no O16 "exit $st $(cat "$T/out")"

# New controls (18:57Z batch).
FP="$T/fp17"; mkdir -p "$FP"; fakestat "$FP" 4190003 4190001 4190001 500; SPYF="$T/spy17"; : > "$SPYF"
S17="$T/o17"; mkdir -p "$S17"; echo "4190001 100 4190001 4190001" > "$S17/x.own"
OWNED_PROC_PROC_ROOT="$FP" OWNED_PROC_SIGNAL_SPY="$SPYF" "${OP[@]}" stop "$S17" 8080 > "$T/out"; st=$?
[ $st = 1 ] && [ ! -s "$SPYF" ] && grep -q "REFUSED, nothing signalled" "$T/out" && ok "O17 SPY: old session gone, later child with the SAME sid/pgid, replacement leader absent: ZERO signals, refused (exit 1)" || no O17 "exit $st spy=$(wc -l < "$SPYF") $(cat "$T/out")"
FP="$T/fp17b"; mkdir -p "$FP"; fakestat "$FP" 4190001 4190001 4190001 100; fakestat "$FP" 4190003 4190001 4190001 500; : > "$SPYF"
OWNED_PROC_PROC_ROOT="$FP" OWNED_PROC_SIGNAL_SPY="$SPYF" timeout 30 "${OP[@]}" stop "$S17" 8080 > "$T/out"; st=$?
grep -qx -- "-4190001 SIGTERM" "$SPYF" && grep -qx -- "-4190001 SIGKILL" "$SPYF" && [ $st = 1 ] && ok "O17b SPY positive: verified live leader (recorded starttime) -> TERM then KILL to its group; fake group stays, so exit 1" || no O17b "exit $st spy=$(tr '\n' ' ' < "$SPYF")"
OWNED_PROC_SIGNAL_SPY="$SPYF" "${OP[@]}" stop "$S17" 8080 > "$T/out"; st=$?
[ $st = 2 ] && grep -q "signal spy refused" "$T/out" && ok "O17c signal spy without a fake /proc root is refused (exit 2)" || no O17c "exit $st"
S="$T/o18"; "${OP[@]}" start "$S" functions "$T/o18.log" -- bash -c '(trap "" TERM; exec -a o18-term-ignorer sleep 300) & sleep 300' >/dev/null; sleep 0.5
"${OP[@]}" stop "$S" 8080 > "$T/out"; st=$?
o18=$(ps -eo pid=,stat=,args= | awk '$2 !~ /^Z/ && /o18-term-ignorer/ && !/awk/ {print $1}'); for p in $o18; do KEEP+=("$p"); done
[ $st = 1 ] && [ -n "$o18" ] && grep -q "leader exited during stop .* REFUSED, not escalated" "$T/out" && ok "O18 leader died on TERM, TERM-ignoring member remains: NOT escalated to KILL, refused (exit 1)" || no O18 "exit $st $(cat "$T/out")"
S="$T/o19"; OWNED_PROC_FAIL_RECORD_WRITE=1 OWNED_PROC_FAIL_SIGNAL=1 "${OP[@]}" start "$S" functions "$T/o19.log" -- bash -c 'exec -a o19-marker-child sleep 300' > "$T/out"; st=$?
o19=$(ps -eo pid=,stat=,args= | awk '$2 !~ /^Z/ && /o19-marker-child/ && !/awk/ {print $1}'); for p in $o19; do KEEP+=("$p"); done
[ $st = 3 ] && grep -q "rollback signal failed (EPERM); child NOT rolled back" "$T/out" && ! grep -q "group rolled back" "$T/out" && ok "O19 rollback signal fails: no success claim, exit 3" || no O19 "exit $st $(cat "$T/out")"
echo "== owned-proc selftest (LOCAL processes, MOCKED ss, FAKE /proc for faults): $pass PASS, $fail FAIL"; [ $fail = 0 ]
