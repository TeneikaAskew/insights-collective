#!/usr/bin/env bash
# ABOUTME: Learner-quiz mode only, read-only: the edge-runtime delta over the T09 stack shape. Exactly one edge-runtime container,
# ABOUTME: attached only to the owned network, publishing NO host port; every other stack container is from the T09 allowlist.
# Usage: edge-runtime-check.sh <owned network name>
# Run AFTER `supabase functions serve` is ready (serve may recreate the container). Complements, never replaces, the shared
# checks that run in the same step: stack-net.mjs verify/listeners and stack-checks.sh ports.
# Container names carry the CLI project id (the production ref, the guard's deny identity); printed names are redacted.
# Every docker probe's exit status is checked before parsing; stderr is never printed (byte count only). Exit 0 or 1.
set -u
NET="${1:-}"; [ -n "$NET" ] || { echo "FAIL edge: usage: edge-runtime-check.sh <owned network>"; exit 1; }
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
echo "PASS edge: $n stack containers; exactly one edge runtime ($(redact <<<"${edge[0]}")), on $NET only, no published host port, SUPABASE_URL -> $(redact <<<"$host")"
echo "NOTE edge: outbound access of the runtime is NOT restricted by this check (bridge network); module downloads are declared in functions-subset.txt (decision E1)"
