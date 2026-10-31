#!/usr/bin/env bash
# ABOUTME: Verifies every function, policy, trigger, RLS flag and grant of a bootstrapped local stack
# ABOUTME: against the live identity manifest (md5 of definitions), reporting live-broken omissions
# ABOUTME: explicitly. Exit 1 on any unexplained difference. Loopback only.
set -u
PGURL="${1:?loopback DSN}"; ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; SNAP="$ROOT/scripts/local-stack/schema"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGURL" >/dev/null || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
. "$SNAP/manifest.env"
LOCAL=$(mktemp); LIVE=$(mktemp)
psql "$PGURL" -Atq -f "$ROOT/scripts/local-db/identities.sql" | sort > "$LOCAL"; sort "$SNAP/identities.tsv" > "$LIVE"
FILTER='^$'; [ -n "${VIEWS_BROKEN_LIVE:-}" ] && FILTER="^(table_grant)	($(echo "$VIEWS_BROKEN_LIVE" | tr ',' '|'))→"
omitted=$(comm -23 "$LIVE" "$LOCAL" | grep -E "$FILTER" | cut -f1,2 || true)
missing=$(comm -23 "$LIVE" "$LOCAL" | grep -vE "$FILTER" || true); extra=$(comm -13 "$LIVE" "$LOCAL" || true)
[ -n "$omitted" ] && { echo "note: omitted (live-broken objects):"; echo "$omitted" | sed 's/^/   /'; }
if [ -n "$missing" ] || [ -n "$extra" ]; then
  echo "IDENTITY MISMATCH (server $(psql "$PGURL" -Atc 'show server_version')):"
  [ -n "$missing" ] && { echo "  live but not reproduced / definition differs:"; echo "$missing" | cut -f1,2 | sed 's/^/   /' | head -30; }
  [ -n "$extra" ] && { echo "  local but not live / definition differs:"; echo "$extra" | cut -f1,2 | sed 's/^/   /' | head -30; }
  exit 1
fi
echo "identities OK: $(wc -l < "$LOCAL") objects match the live manifest ($(echo "$omitted" | grep -c .) omitted for live-broken objects)"
