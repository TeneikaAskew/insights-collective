#!/usr/bin/env bash
# ABOUTME: Read-only runner checks for the T-09 runtime job: published ports are loopback-only and expected, GoTrue mail goes
# ABOUTME: only to the local catcher, nothing is left after `supabase stop --no-backup`, and evidence carries no credential.
# Usage: stack-checks.sh ports | mail | leftovers | redact-scan <file or dir>...
# Never changes Docker, network, firewall, role or ownership state. Container names carry the CLI project id, which is
# the production ref used as the guard's deny identity, so every printed name has that suffix replaced by <project>.
set -u
refuse() { echo "FAIL $*"; exit 1; }
redact() { sed -E 's/(supabase_[a-z_-]+_)[a-z0-9]{20}/\1<project>/g'; }
stack_containers() { docker ps --format '{{.Names}}' | grep -E '^supabase_[a-z_-]+_[a-z0-9]+$'; }

case "${1:-}" in
ports)
  # Every host binding of a stack container must be 127.0.0.1 or ::1, on a port from the expected local set.
  # config.toml fixes api 54321, db 54322, studio 54323 (excluded at start), mail 54324; the shadow db 54320 is not
  # started by `supabase start`. Anything else, or any wildcard/non-loopback address, fails: no exception is made here.
  EXPECTED='^(54321|54322|54324)$'
  n=0; bad=0
  while IFS=$'\t' read -r name ports; do
    n=$((n + 1))
    [ -z "$ports" ] && continue
    IFS=',' read -ra binds <<<"$ports"
    for b in "${binds[@]}"; do
      b="${b# }"; [[ "$b" == *"->"* ]] || continue        # unpublished container port: not reachable from the host
      host="${b%%->*}"; addr="${host%:*}"; port="${host##*:}"
      if [[ "$addr" != "127.0.0.1" && "$addr" != "[::1]" && "$addr" != "::1" ]]; then
        echo "BLOCKER ports: $(redact <<<"$name") publishes $port on '$addr' (not loopback)"; bad=1
      elif ! [[ "$port" =~ $EXPECTED ]]; then
        echo "BLOCKER ports: $(redact <<<"$name") publishes unexpected host port $port"; bad=1
      else
        echo "ok ports: $(redact <<<"$name") $addr:$port"
      fi
    done
  done < <(docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E '^supabase_')
  [ "$n" -gt 0 ] || refuse "ports: no stack containers running"
  [ $bad -eq 0 ] || refuse "ports: non-loopback or unexpected published port (recorded above; no network setting is changed to pass)"
  echo "PASS ports: $n stack containers, every published port loopback and expected"
  ;;
mail)
  # GoTrue's SMTP target must be the local catcher container on its in-network SMTP port; only these two keys are read,
  # and only the host's role (not its suffix) is printed. No other GoTrue variable is ever printed.
  auth=$(stack_containers | grep -E '^supabase_auth_' | head -1); [ -n "$auth" ] || refuse "mail: auth container not running"
  catcher=$(stack_containers | grep -E '^supabase_(inbucket|mailpit)_' | head -1); [ -n "$catcher" ] || refuse "mail: local mail catcher not running"
  envs=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$auth" | grep -E '^GOTRUE_SMTP_(HOST|PORT)=')
  host=$(sed -n 's/^GOTRUE_SMTP_HOST=//p' <<<"$envs"); port=$(sed -n 's/^GOTRUE_SMTP_PORT=//p' <<<"$envs")
  [ "$host" = "$catcher" ] || refuse "mail: GOTRUE_SMTP_HOST is '$(redact <<<"$host")', expected the local catcher $(redact <<<"$catcher")"
  [ "$port" = 1025 ] || refuse "mail: GOTRUE_SMTP_PORT is '$port', expected the catcher's 1025"
  # The catcher itself must not relay: Mailpit relays only when MP_SMTP_RELAY_* is configured.
  relay=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$catcher" | grep -cE '^MP_SMTP_RELAY_(HOST|CONFIG)=.+')
  [ "$relay" -eq 0 ] || refuse "mail: the local catcher has a relay configured"
  echo "PASS mail: GoTrue SMTP -> $(redact <<<"$catcher"):1025 (local catcher, no relay); edge functions are not served in this job"
  ;;
leftovers)
  c=$(docker ps -a --format '{{.Names}}' | grep -cE '^supabase_'); v=$(docker volume ls --format '{{.Name}}' | grep -cE '^supabase_')
  nw=$(docker network ls --format '{{.Name}}' | grep -cE '^supabase_network_')
  l=$(ss -ltnH 2>/dev/null | awk '{print $4}' | grep -cE ':(54320|54321|54322|54323|54324)$')
  echo "leftovers: containers $c, volumes $v, networks $nw, listeners on 54320-54324: $l"
  [ "$c" -eq 0 ] && [ "$v" -eq 0 ] && [ "$nw" -eq 0 ] && [ "$l" -eq 0 ] || refuse "leftovers: stack not fully removed"
  echo "PASS leftovers: nothing remains"
  ;;
redact-scan)
  shift; [ $# -gt 0 ] || refuse "redact-scan: no paths"
  # JWT-shaped tokens (the CLI's local anon/service keys and any persona token), new-style secret keys, the run's
  # synthetic password, and Authorization headers. A hit fails BEFORE upload; the hit itself is never printed.
  pat='eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.|sb_secret_[A-Za-z0-9_-]{8,}|[Aa]uthorization: *[Bb]earer +[^ <]'
  [ -n "${E2E_TEST_PASSWORD:-}" ] && pat="$pat|$(printf '%s' "$E2E_TEST_PASSWORD" | sed 's/[][\.*^$|+?(){}]/\\&/g')"
  hits=$(grep -rlE -- "$pat" "$@" 2>/dev/null | wc -l)
  [ "$hits" -eq 0 ] || { grep -rlE -- "$pat" "$@" 2>/dev/null | sed 's/^/  credential-shaped content in: /'; refuse "redact-scan: $hits file(s) carry credential-shaped content"; }
  echo "PASS redact-scan: $(find "$@" -type f | wc -l) file(s), no credential-shaped content"
  ;;
*) echo "usage: $0 ports | mail | leftovers | redact-scan <path>..." >&2; exit 2 ;;
esac
