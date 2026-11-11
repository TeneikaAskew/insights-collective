#!/usr/bin/env bash
# ABOUTME: READ-ONLY auth null-state booleans for the EXACT quiz-lifecycle synthetic learner (learner-auth-state.sql), behind
# ABOUTME: the same strict-local-DSN contract as fixture.sh. Prints one validated line of key=boolean pairs or a fixed failure.
# Usage: learner-auth-state.sh            reads SUPABASE_DB_URL from the environment (never from argv)
# Secrets: the DB password is exported as PGPASSWORD inside a subshell that execs psql; nothing secret is in any argv.
# psql output goes to a private temp file. Only a line matching the fixed boolean grammar is printed; anything else is
# withheld behind a fixed message. The SQL runs in a READ ONLY transaction and ends with ROLLBACK.
set -u
umask 077
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
SRC="$HERE/learner-auth-state.sql"
DB="${SUPABASE_DB_URL:-}"
[ $# -eq 0 ] || { echo "auth-state refused: unexpected argument"; exit 2; }
[ -n "$DB" ] || { echo "auth-state refused: no database URL"; exit 2; }
[ -f "$SRC" ] && [ -r "$SRC" ] && [ -s "$SRC" ] || { echo "auth-state refused: learner-auth-state.sql is not readable"; exit 4; }
SPLIT=$(printf '%s' "$DB" | node "$HERE/local-dsn.mjs" split 2>/dev/null) || { echo "auth-state refused: not a strict local DSN"; exit 2; }
CONN=${SPLIT%%$'\n'*}; DBPW=${SPLIT#*$'\n'}; unset SPLIT
# Same owned-target guard as the fixture (read-only here, but the target contract is not relaxed).
node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating >/dev/null 2>&1 || { echo "auth-state refused: target guard failed"; exit 3; }
OUT=$(mktemp); trap 'rm -f "$OUT"' EXIT
(
  unset PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGPORT PGPASSFILE
  export PGPASSWORD="$DBPW"
  exec psql "$CONN" -X -q -A -t -v ON_ERROR_STOP=1 -f "$SRC" >"$OUT" 2>&1
)
st=$?
unset DBPW
bytes=$(wc -c < "$OUT" | tr -d ' ')
[ "$st" -eq 0 ] || { echo "FAIL auth-state [S01]: psql exit $st; $bytes bytes of output withheld"; exit 1; }
B='(true|false|absent)'
RE="^auth-state user_row=$B email_matches=$B instance_id_null=$B aud_authenticated=$B role_authenticated=$B password_hash_present=$B email_confirmed=$B created_at_null=$B updated_at_null=$B confirmation_token_null=$B recovery_token_null=$B email_change_token_new_null=$B email_change_null=$B email_change_token_current_null=$B phone_change_null=$B phone_change_token_null=$B reauthentication_token_null=$B banned=$B deleted=$B identity_rows=(zero|one|many)\$"
line=$(grep -E "$RE" "$OUT" | head -n 1)
[ -n "$line" ] || { echo "FAIL auth-state [S02]: no line in the fixed boolean grammar; $bytes bytes withheld"; exit 1; }
phase="${LQ_AUTH_PROBE_PHASE:-unlabelled}"; [[ "$phase" =~ ^[a-z][a-z0-9-]{0,23}$ ]] || phase=unlabelled
echo "$line phase=$phase"
echo "PASS auth-state (read-only; booleans only)"
