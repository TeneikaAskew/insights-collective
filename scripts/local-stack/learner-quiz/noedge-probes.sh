#!/usr/bin/env bash
# ABOUTME: No-Edge job probes, read-only. `absent <before|after> <evidence file>`: a SUCCESSFUL docker listing that shows this
# ABOUTME: stack and no edge-runtime container. `port-free <port>`: a SUCCESSFUL ss listing with no listener on that port.
# A probe's stderr is captured privately and never printed or staged (byte count only); a failed or implausible probe is a fixed
# FAIL line, never "absent". Only the fixed PASS line is written to the evidence file. Exit 0 pass, 1 fail, 2 usage.
set -u
umask 077
E=$(mktemp); O=$(mktemp); trap 'rm -f "$E" "$O"' EXIT
withheld() { echo "($(wc -c < "$E" | tr -d ' ') bytes of stderr withheld)"; }
case "${1:-}" in
  absent)
    PHASE="${2:-}"; EV="${3:-}"
    case "$PHASE" in before|after) ;; *) echo "FAIL no-edge: usage: absent <before|after> <evidence file>"; exit 2 ;; esac
    [ -n "$EV" ] || { echo "FAIL no-edge: usage: absent <before|after> <evidence file>"; exit 2; }
    docker ps -a --format '{{.Names}}' > "$O" 2> "$E"; st=$?
    [ $st -eq 0 ] || { echo "FAIL no-edge ($PHASE): docker listing failed (exit $st) $(withheld); absence NOT established"; exit 1; }
    if grep -qvE '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$' "$O"; then echo "FAIL no-edge ($PHASE): docker listing has an unparsable line $(withheld); absence NOT established"; exit 1; fi
    grep -qE '^supabase_db_[a-z0-9]+$' "$O" || { echo "FAIL no-edge ($PHASE): the listing does not show this stack's database container $(withheld); absence NOT established"; exit 1; }
    if grep -qE '^supabase_edge_runtime_' "$O"; then echo "FAIL no-edge ($PHASE): an edge-runtime container exists in the no-Edge job"; exit 1; fi
    msg="PASS no-edge ($PHASE): successful docker listing shows this stack and no edge-runtime container"
    echo "$msg" > "$EV" || { echo "FAIL no-edge ($PHASE): cannot write evidence"; exit 1; }
    echo "$msg $(withheld)" ;;
  port-free)
    P="${2:-}"; [[ "$P" =~ ^[0-9]{1,5}$ ]] || { echo "FAIL port: usage: port-free <port>"; exit 2; }
    ss -Hltn "sport = :$P" > "$O" 2> "$E"; st=$?
    [ $st -eq 0 ] || { echo "FAIL port $P: ss failed (exit $st) $(withheld); a free port is NOT established"; exit 1; }
    [ -s "$O" ] && { echo "FAIL port $P: a listener is present that this job did not launch"; exit 1; }
    echo "PASS port $P: successful ss listing shows no listener $(withheld)" ;;
  *) echo "FAIL usage: noedge-probes.sh absent <before|after> <evidence file> | port-free <port>"; exit 2 ;;
esac
