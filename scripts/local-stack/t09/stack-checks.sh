#!/usr/bin/env bash
# ABOUTME: Read-only runner checks for the T-09 runtime job: loopback-only expected ports, GoTrue mail to the local catcher
# ABOUTME: only, nothing left after `supabase stop --no-backup`, and an exact, credential-free evidence upload manifest.
# Usage: stack-checks.sh ports | mail | leftovers | stage-evidence [--require-all] <dest> <expected receipt>... -- <root>... | redact
#   stage-evidence: scans every regular file under the roots, copies them to <dest> (the ONLY uploaded path) and writes
#                   <dest>/MANIFEST.sha256; with --require-all every expected receipt must exist and be non-empty.
#   redact:         stdin -> stdout with credential shapes replaced (used to print CLI output and error tails).
# Every probe (docker, ss, find, grep, sha256sum, cp) is run on its own with its exit status checked BEFORE any parsing:
# a failed probe is a FAIL, never an empty result. Never changes Docker, network, firewall, role or ownership state.
# Container names carry the CLI project id (the production ref, the guard's deny identity), so every printed name has
# that suffix replaced by <project>. A matched credential is never printed: only the file and the pattern class.
set -u
refuse() { echo "FAIL $*"; exit 1; }
redact_names() { sed -E 's/(supabase_[a-z_-]+_)[a-z0-9]{20}/\1<project>/g'; }
# probe <var> <cmd...>: runs the command, stores stdout in <var>; a non-zero exit fails. The probe's stderr is NEVER
# emitted (not even redacted): a pattern-based redactor can miss a credential shape, so only the exit status and the
# stderr byte count are printed. The failure itself is preserved (exit 1).
probe() {
  local __v="$1"; shift; local __o __e __st
  __e=$(mktemp); __o=$("$@" 2>"$__e"); __st=$?
  if [ $__st -ne 0 ]; then
    echo "FAIL probe '$1 ${2:-}' exited $__st (stderr withheld: $(wc -c < "$__e") bytes)"; rm -f "$__e"; exit 1
  fi
  rm -f "$__e"; printf -v "$__v" '%s' "$__o"
}
# Credential shapes. JWTs (local anon/service keys, persona tokens), new-style secret keys, Bearer headers, any URL
# with userinfo (postgres://user:pass@..., https://user:pass@...), PGPASSWORD= / password= assignments.
CRED_RE='eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*|sb_(secret|publishable)_[A-Za-z0-9_-]{8,}|[Aa]uthorization: *[Bb]earer +[^[:space:]<]+|[a-z][a-z0-9+.-]*://[^/@[:space:]:]+:[^@/[:space:]]+@|PGPASSWORD=[^[:space:]]+|(^|[^a-z_])(password|passwd|secret)=[^[:space:]<]+'
pw_re() { [ -n "${E2E_TEST_PASSWORD:-}" ] && printf '%s' "$E2E_TEST_PASSWORD" | sed 's/[][\.*^$|+?(){}]/\\&/g'; }

case "${1:-}" in
ports)
  EXPECTED='^(54321|54322|54324)$'
  probe PS docker ps --format '{{.Names}}\t{{.Ports}}'
  n=0; bad=0
  while IFS=$'\t' read -r name ports; do
    [[ "$name" =~ ^supabase_ ]] || continue
    n=$((n + 1)); [ -z "$ports" ] && continue
    IFS=',' read -ra binds <<<"$ports"
    for b in "${binds[@]}"; do
      b="${b# }"; [[ "$b" == *"->"* ]] || continue        # unpublished container port: not reachable from the host
      host="${b%%->*}"; addr="${host%:*}"; port="${host##*:}"
      if [[ "$addr" != "127.0.0.1" && "$addr" != "[::1]" && "$addr" != "::1" ]]; then
        echo "BLOCKER ports: $(redact_names <<<"$name") publishes $port on '$addr' (not loopback)"; bad=1
      elif ! [[ "$port" =~ $EXPECTED ]]; then
        echo "BLOCKER ports: $(redact_names <<<"$name") publishes unexpected host port $port"; bad=1
      else
        echo "ok ports: $(redact_names <<<"$name") $addr:$port"
      fi
    done
  done <<<"$PS"
  [ "$n" -gt 0 ] || refuse "ports: docker ps succeeded but no stack container is running"
  [ $bad -eq 0 ] || refuse "ports: non-loopback or unexpected published port (recorded above; no network setting is changed to pass)"
  echo "PASS ports: $n stack containers, every published port loopback and expected"
  ;;
mail)
  probe NAMES docker ps --format '{{.Names}}'
  auth=$(grep -E '^supabase_auth_[a-z0-9]+$' <<<"$NAMES" | head -1); [ -n "$auth" ] || refuse "mail: auth container not running"
  catcher=$(grep -E '^supabase_(inbucket|mailpit)_[a-z0-9]+$' <<<"$NAMES" | head -1); [ -n "$catcher" ] || refuse "mail: local mail catcher not running"
  # Only two GoTrue keys are read and nothing else from either environment is ever printed.
  probe AENV docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$auth"
  [ -n "$AENV" ] || refuse "mail: auth container inspect returned no environment"
  host=$(sed -n 's/^GOTRUE_SMTP_HOST=//p' <<<"$AENV"); port=$(sed -n 's/^GOTRUE_SMTP_PORT=//p' <<<"$AENV")
  [ "$host" = "$catcher" ] || refuse "mail: GOTRUE_SMTP_HOST is '$(redact_names <<<"$host")', expected the local catcher $(redact_names <<<"$catcher")"
  [ "$port" = 1025 ] || refuse "mail: GOTRUE_SMTP_PORT is '$port', expected the catcher's 1025"
  probe CENV docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$catcher"
  [ -n "$CENV" ] || refuse "mail: catcher inspect returned no environment (cannot prove there is no relay)"
  relay=$(grep -cE '^MP_SMTP_RELAY_(HOST|CONFIG|ALL|MATCHING)=.+' <<<"$CENV")
  [ "$relay" -eq 0 ] || refuse "mail: the local catcher has a relay configured"
  echo "PASS mail: GoTrue SMTP -> $(redact_names <<<"$catcher"):1025 (local catcher, no relay); edge functions are not served in this job"
  ;;
leftovers)
  probe C docker ps -a --format '{{.Names}}'; probe V docker volume ls --format '{{.Name}}'
  probe N docker network ls --format '{{.Name}}'; probe L ss -ltnH
  c=$(grep -cE '^supabase_' <<<"$C"); v=$(grep -cE '^supabase_' <<<"$V"); nw=$(grep -cE '^supabase_network_' <<<"$N")
  l=$(awk '{print $4}' <<<"$L" | grep -cE ':(54320|54321|54322|54323|54324)$')
  echo "leftovers: containers $c, volumes $v, networks $nw, listeners on 54320-54324: $l"
  [ "$c" -eq 0 ] && [ "$v" -eq 0 ] && [ "$nw" -eq 0 ] && [ "$l" -eq 0 ] || refuse "leftovers: stack not fully removed"
  echo "PASS leftovers: nothing remains"
  ;;
stage-evidence)
  shift; REQUIRE_ALL=0; [ "${1:-}" = --require-all ] && { REQUIRE_ALL=1; shift; }
  DEST="${1:?dest}"; shift; EXPECT=(); while [ $# -gt 0 ] && [ "$1" != -- ]; do EXPECT+=("$1"); shift; done
  [ "${1:-}" = -- ] || refuse "stage-evidence: missing -- before the roots"; shift; ROOTS=("$@")
  [ "${#ROOTS[@]}" -gt 0 ] || refuse "stage-evidence: no roots"
  [ ! -e "$DEST" ] || refuse "stage-evidence: destination exists (never reused): $DEST"
  # Receipts: every expected one is listed as present or MISSING; after a successful job all must be present, non-empty.
  missing=0
  for e in "${EXPECT[@]}"; do
    if [ -f "$e" ] && [ -r "$e" ] && [ -s "$e" ]; then echo "receipt present: $e"; else echo "receipt MISSING or empty: $e"; missing=$((missing + 1)); fi
  done
  [ $REQUIRE_ALL -eq 0 ] || [ $missing -eq 0 ] || refuse "stage-evidence: $missing expected receipt(s) missing on a successful job"
  for r in "${ROOTS[@]}"; do [ -e "$r" ] && [ -r "$r" ] || refuse "stage-evidence: root missing or unreadable: $r"; done
  probe NONREG find "${ROOTS[@]}" ! -type f ! -type d
  [ -z "$NONREG" ] || refuse "stage-evidence: non-regular file(s) (links, devices) under the roots"
  probe FILES find "${ROOTS[@]}" -type f
  [ -n "$FILES" ] || refuse "stage-evidence: no files under the roots"
  pat="$CRED_RE"; p=$(pw_re); [ -n "$p" ] && pat="$pat|$p"
  hits=0
  while IFS= read -r f; do
    [ -r "$f" ] || refuse "stage-evidence: unreadable: $f"
    grep -qE -- "$pat" "$f"; st=$?
    case $st in
      0) echo "  credential-shaped content in: $f"; hits=$((hits + 1)) ;;
      1) ;;
      *) refuse "stage-evidence: grep failed ($st) on $f" ;;
    esac
  done <<<"$FILES"
  [ $hits -eq 0 ] || refuse "stage-evidence: $hits file(s) carry credential-shaped content; nothing staged for upload"
  mkdir -p "$DEST" || refuse "stage-evidence: cannot create $DEST"
  while IFS= read -r f; do
    mkdir -p "$DEST/$(dirname "$f")" && cp -p -- "$f" "$DEST/$f" || refuse "stage-evidence: copy failed: $f"
  done <<<"$FILES"
  probe SUMS bash -c 'cd "$1" && find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum' _ "$DEST"
  printf '%s\n' "$SUMS" > "$DEST/MANIFEST.sha256" || refuse "stage-evidence: manifest write failed"
  # The staged copy is scanned again, so the upload is exactly what was scanned.
  grep -rqE -- "$pat" "$DEST"; st=$?; [ $st -eq 1 ] || refuse "stage-evidence: staged copy re-scan returned $st"
  echo "PASS stage-evidence: $(wc -l <<<"$FILES") file(s) scanned and staged, $missing receipt(s) missing, manifest $DEST/MANIFEST.sha256"
  ;;
redact)
  pat="$CRED_RE"; p=$(pw_re); [ -n "$p" ] && pat="$pat|$p"
  sed -E "s#$pat#<redacted>#g" | redact_names
  ;;
*) echo "usage: $0 ports | mail | leftovers | stage-evidence [--require-all] <dest> <receipt>... -- <root>... | redact" >&2; exit 2 ;;
esac
