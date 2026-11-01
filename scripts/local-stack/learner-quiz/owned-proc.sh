#!/usr/bin/env bash
# ABOUTME: Starts background servers as OWNED process groups and records their identity at launch; stops only those groups and
# ABOUTME: then proves the given ports have no listener. Replaces any pattern-based pkill. Fails on any inspection error.
#
#   owned-proc.sh start <state dir> <name> <log file> -- <command...>
#       setsid makes the child the leader of a new process group (pgid == pid). Before returning, it writes
#       <state dir>/<name>.own = "<pid> <starttime>", where starttime is field 22 of /proc/<pid>/stat (kernel boot ticks).
#       The record is written at launch, so a later readiness failure still leaves an owned record for the stop step.
#   owned-proc.sh stop <state dir> <port>...
#       For each record: if /proc/<pid> exists and its starttime equals the record, SIGTERM the process GROUP, wait up to 20 s,
#       then SIGKILL the group and wait up to 5 s more. If the pid is gone, or its starttime differs (a reused pid), it signals
#       nothing for that record. Then every port must have no TCP listener (ss). Exit 0 ok; 1 group still alive, or a listener
#       present; 2 usage; 3 inspection error (unreadable record, /proc or ss failure).
set -uo pipefail
die() { echo "OWNED-PROC $1"; exit "$2"; }
starttime() { # pid -> field 22 of /proc/pid/stat; comm (field 2) may contain spaces, so cut after the last ')'
  local s; s=$(cat "/proc/$1/stat" 2>/dev/null) || return 1
  s=${s##*) }; set -- $s; echo "${20}"
}
group_alive() { # pgid -> 0 if any live (non-zombie) process is in the group
  local want=$1 p s
  for p in /proc/[0-9]*; do
    s=$(cat "$p/stat" 2>/dev/null) || continue; s=${s##*) }
    set -- $s
    [ "$3" = "$want" ] && [ "$1" != Z ] && return 0
  done
  return 1
}
case "${1:-}" in
  start)
    [ $# -ge 6 ] && [ "$5" = "--" ] || die "usage: start <state dir> <name> <log> -- <command...>" 2
    dir=$2 name=$3 log=$4; shift 5
    [[ "$name" =~ ^[a-z][a-z0-9-]{0,30}$ ]] || die "bad name" 2
    mkdir -p "$dir" || die "state dir not writable" 3
    [ -e "$dir/$name.own" ] && die "record $name already exists" 2
    setsid "$@" > "$log" 2>&1 < /dev/null &
    pid=$!
    st=$(starttime "$pid") || die "cannot read /proc for launched $name" 3
    echo "$pid $st" > "$dir/$name.own" || die "cannot write record" 3
    echo "OWNED-PROC started $name (owned process group recorded)"
    ;;
  stop)
    [ $# -ge 3 ] || die "usage: stop <state dir> <port>..." 2
    dir=$2; shift 2
    fail=0
    shopt -s nullglob
    for rec in "$dir"/*.own; do
      name=$(basename "$rec" .own)
      read -r pid st < "$rec" || die "unreadable record $name" 3
      [[ "$pid" =~ ^[0-9]+$ && "$st" =~ ^[0-9]+$ ]] || die "malformed record $name" 3
      if [ ! -d "/proc/$pid" ] && ! group_alive "$pid"; then echo "OWNED-PROC $name: already exited"; continue; fi
      if [ -d "/proc/$pid" ]; then
        now=$(starttime "$pid") || die "cannot read /proc for $name" 3
        if [ "$now" != "$st" ]; then echo "OWNED-PROC $name: pid reused by another process; not signalled"; continue; fi
      fi
      kill -TERM -- "-$pid" 2>/dev/null
      for _ in $(seq 1 40); do group_alive "$pid" || break; sleep 0.5; done
      if group_alive "$pid"; then
        kill -KILL -- "-$pid" 2>/dev/null
        for _ in $(seq 1 10); do group_alive "$pid" || break; sleep 0.5; done
      fi
      if group_alive "$pid"; then echo "OWNED-PROC $name: process group still alive"; fail=1; else echo "OWNED-PROC $name: owned group stopped"; fi
    done
    for port in "$@"; do
      [[ "$port" =~ ^[0-9]{1,5}$ ]] || die "bad port" 2
      out=$(ss -Hltn "sport = :$port" 2>/dev/null) || die "ss failed for port $port" 3
      if [ -n "$out" ]; then echo "OWNED-PROC port $port: a listener is still present"; fail=1; else echo "OWNED-PROC port $port: no listener"; fi
    done
    exit $fail
    ;;
  *) die "usage: owned-proc.sh start|stop ..." 2 ;;
esac
