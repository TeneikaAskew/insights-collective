#!/usr/bin/env bash
# ABOUTME: Learner-quiz mode only, read-only: the edge-runtime delta over the T09 stack shape. Exactly one edge-runtime container,
# ABOUTME: attached only to the owned network, publishing NO host port; every other stack container is from the T09 allowlist.
# Usage: edge-runtime-check.sh <owned network name> [--record-id FILE] [--exclude-id FILE] [--expect-id FILE]
#   --record-id FILE   write the checked container's full ID to FILE (only on PASS)
#   --exclude-id FILE  FAIL if the checked container's ID equals the one in FILE (it is not a new serve generation)
#   --expect-id FILE   FAIL if the checked container's ID differs from the one in FILE (it was replaced)
# The job uses these to bind the checks to container generations: the start generation is recorded before bootstrap; the
# pre-readiness check accepts only a DIFFERENT container (the one functions serve created) and records it; the post-readiness
# check requires that same ID, so a later replacement fails. Complements, never replaces, stack-net.mjs verify/listeners and
# stack-checks.sh ports.
# Container names carry the CLI project id (the production ref, the guard's deny identity); printed names are redacted.
# Every docker probe's exit status is checked before parsing; stderr is never printed (byte count only). Exit 0 or 1.
set -u
NET="${1:-}"; [ -n "$NET" ] || { echo "FAIL edge: usage: edge-runtime-check.sh <owned network> [--record-id F] [--exclude-id F] [--expect-id F]"; exit 1; }
shift; REC="" EXC="" EXP=""
while [ $# -gt 0 ]; do case "$1" in
  --record-id) REC="${2:-}"; shift 2 ;; --exclude-id) EXC="${2:-}"; shift 2 ;; --expect-id) EXP="${2:-}"; shift 2 ;;
  *) echo "FAIL edge: unknown option"; exit 1 ;; esac; done
readid() { # var file: sets var or exits (runs in the main shell, never in a substitution)
  local __t; __t=$(cat "$2" 2>/dev/null) || { echo "FAIL edge: id file unreadable"; exit 1; }
  [[ "$__t" =~ ^[0-9a-f]{64}$ ]] || { echo "FAIL edge: id file malformed"; exit 1; }; printf -v "$1" '%s' "$__t"; }
redact() { sed -E 's/(supabase_[a-z_-]+_)[a-z0-9]{20}/\1<project>/g'; }
probe() { local __v="$1"; shift; local __e __o __st; __e=$(mktemp); __o=$("$@" 2>"$__e"); __st=$?
  if [ $__st -ne 0 ]; then echo "FAIL edge: probe '$1 ${2:-}' exited $__st (stderr withheld: $(wc -c < "$__e") bytes)"; rm -f "$__e"; exit 1; fi
  rm -f "$__e"; printf -v "$__v" '%s' "$__o"; }
# Services the T09 jobs start with `-x studio,imgproxy,logflare,vector,supavisor,edge-runtime`, plus the one delta.
BASE_RE='^supabase_(db|kong|auth|rest|realtime|storage|inbucket|mailpit|pg_meta)_[a-z0-9]+$'
EDGE_RE='^supabase_edge_runtime_[a-z0-9]+$'
probe PS docker ps --format '{{.Names}}\t{{.Ports}}'
n=0; edge=(); bad=0
while IFS=$'\t' read -r name ports; do
  [[ "$name" =~ ^supabase_ ]] || continue; n=$((n+1))
  if [[ "$name" =~ $EDGE_RE ]]; then edge+=("$name")
    if [[ "$ports" == *"->"* ]]; then echo "BLOCKER edge: $(redact <<<"$name") publishes a host port"; bad=1; fi
  elif ! [[ "$name" =~ $BASE_RE ]]; then echo "BLOCKER edge: unexpected stack container $(redact <<<"$name")"; bad=1; fi
done <<<"$PS"
[ "${#edge[@]}" -eq 1 ] || { echo "FAIL edge: expected exactly one edge-runtime container, found ${#edge[@]}"; exit 1; }
probe NETS docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "${edge[0]}"
nets=$(grep -c . <<<"$NETS"); [ "$nets" = 1 ] && [ "$(grep . <<<"$NETS")" = "$NET" ] \
  || { echo "FAIL edge: edge runtime is on $nets network(s), expected only the owned network"; exit 1; }
# Only SUPABASE_URL is read from the runtime's environment, and only its host is printed: it must be the in-network gateway.
probe ENV docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${edge[0]}"
url=$(sed -n 's/^SUPABASE_URL=//p' <<<"$ENV" | head -1); host=$(sed -E 's|^https?://([^/:]+).*|\1|' <<<"$url")
[[ "$host" == kong || "$host" =~ ^supabase_kong_[a-z0-9]+$ ]] || { echo "FAIL edge: runtime SUPABASE_URL host is not the in-network gateway"; exit 1; }
[ $bad -eq 0 ] || { echo "FAIL edge: see BLOCKER lines (no network or port setting is changed to pass)"; exit 1; }
probe CID docker inspect --format '{{.Id}}' "${edge[0]}"
[[ "$CID" =~ ^[0-9a-f]{64}$ ]] || { echo "FAIL edge: container id unreadable"; exit 1; }
gen="any"
if [ -n "$EXC" ]; then readid XID "$EXC"; [ "$CID" != "$XID" ] || { echo "FAIL edge: still the earlier container generation (not the serve generation)"; exit 1; }; gen="new (differs from the excluded generation)"; fi
if [ -n "$EXP" ]; then readid BID "$EXP"; [ "$CID" = "$BID" ] || { echo "FAIL edge: container was replaced after it was bound (id differs from the bound generation)"; exit 1; }; gen="bound (same as the recorded generation)"; fi
if [ -n "$REC" ]; then ( umask 077; printf '%s' "$CID" > "$REC.tmp" ) && mv "$REC.tmp" "$REC" || { echo "FAIL edge: cannot record id"; exit 1; }; fi
echo "PASS edge: $n stack containers; exactly one edge runtime ($(redact <<<"${edge[0]}")), on $NET only, no published host port, SUPABASE_URL -> $(redact <<<"$host"); generation: $gen; id sha256 $(printf '%s' "$CID" | sha256sum | cut -c1-12)"
echo "NOTE edge: outbound access of the runtime is NOT restricted by this check (bridge network); decision E1 is BLOCKED"
