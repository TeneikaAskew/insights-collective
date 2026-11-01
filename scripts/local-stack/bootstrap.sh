#!/usr/bin/env bash
# ABOUTME: Applies the sanitized schema snapshot onto an AUTHENTIC local Supabase stack (`supabase start`)
# ABOUTME: whose database has the real managed roles, GoTrue/Storage objects and ownership. Loopback only.
# ABOUTME: Every psql process status is propagated; any DDL error or identity mismatch fails the run.
# ABOUTME: Inverse of scripts/local-db/build-from-snapshot.sh (which REFUSES managed objects and installs shims).
# Usage: scripts/local-stack/bootstrap.sh <loopback libpq DSN of the local stack database>
set -u
PGURL="${1:?loopback DSN required}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; SNAP="$ROOT/scripts/local-stack/schema"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGURL" || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
LOG=$(mktemp -d); trap 'rm -rf "$LOG"' EXIT
# q: run one query, propagate psql's exit status explicitly (never infer success from output).
q() { local out; out=$(psql "$PGURL" -Atq -v ON_ERROR_STOP=1 -c "$1" 2>"$LOG/q.err"); local st=$?; if [ $st -ne 0 ]; then echo "psql exit $st on probe: $(head -c 300 "$LOG/q.err")" >&2; exit 2; fi; printf '%s' "$out"; }
if ! psql "$PGURL" -Atc "select 1" >/dev/null 2>"$LOG/conn.err"; then echo "cannot connect to the local stack database: $(head -c 300 "$LOG/conn.err")" >&2; exit 2; fi

# ---- Authenticity: the real managed objects, checked by OBJECT identity and ownership ----
# Known from the official init scripts (supabase/postgres, supabase/auth, supabase/storage): the auth
# and storage SCHEMAS are created AUTHORIZATION supabase_admin, while GoTrue's tables and functions are
# owned by supabase_auth_admin and Storage's by supabase_storage_admin, each service keeping its own
# migration ledger table. These checks were written from that documentation and from the shim's
# simulation; they have NOT yet been executed against a real `supabase start` database (PG15). If the
# first real run disagrees, the CHECK is corrected, never relaxed to a role-name-only test.
roles=$(q "select count(*) from pg_roles where rolname in ('supabase_admin','supabase_auth_admin','supabase_storage_admin','authenticator','anon','authenticated','service_role')")
[ "$roles" = "7" ] || { echo "refusing: expected the 7 managed roles, found $roles; not an authentic local stack (for plain PostgreSQL use scripts/local-db/build-from-snapshot.sh)" >&2; exit 2; }
check_owner() { # schema.table expected_owner
  local got; got=$(q "select coalesce((select c.relowner::regrole::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=split_part('$1','.',1) and c.relname=split_part('$1','.',2)), 'MISSING')")
  [ "$got" = "$2" ] || { echo "refusing: $1 is owned by '$got', expected '$2'; not an authentic local stack" >&2; exit 2; }
}
check_owner auth.users supabase_auth_admin
check_owner auth.identities supabase_auth_admin
check_owner auth.schema_migrations supabase_auth_admin
check_owner storage.buckets supabase_storage_admin
check_owner storage.objects supabase_storage_admin
check_owner storage.migrations supabase_storage_admin
fnowner=$(q "select coalesce((select p.proowner::regrole::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' and p.proname='uid'),'MISSING')")
[ "$fnowner" = "supabase_auth_admin" ] || { echo "refusing: auth.uid() owner is '$fnowner', expected supabase_auth_admin" >&2; exit 2; }
[ "$(q "select count(*) from pg_tables where schemaname='public'")" = "0" ] || { echo "refusing: public schema is not empty" >&2; exit 2; }
if grep -rqE "[a-z]{20}\.supabase\.co" "$SNAP"; then echo "refusing: snapshot artifact embeds a hosted project host" >&2; exit 2; fi

# ---- Apply, propagating every psql status ----
BENIGN='already exists|multiple primary keys for table'
# The ONE tolerated "does not exist": views the manifest records as broken in the live catalog (quiz_analytics
# references itself, so neither the view nor its grants can be created). Printed, never silent; everything
# else that fails to resolve after six passes is a real error and fails the bootstrap.
VIEWS_BROKEN_LIVE=$(sed -nE 's/^VIEWS_BROKEN_LIVE=//p' "$SNAP/manifest.env" | tr -d '[:space:]')
if [ -n "$VIEWS_BROKEN_LIVE" ]; then
  BENIGN="$BENIGN|relation \"(public\\.)?($(echo "$VIEWS_BROKEN_LIVE" | tr ',' '|'))\" does not exist"
  echo "omitted (broken in the live catalog, see schema/DIVERGENCES.md): $VIEWS_BROKEN_LIVE"
fi
FAIL=0
run_strict() { # a non-zero psql status is fatal, whatever the output says
  local st; psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$1" >"$LOG/strict.out" 2>&1; st=$?
  if [ $st -ne 0 ]; then echo "FATAL in $(basename "$1") (psql exit $st):"; grep -E "ERROR|FATAL|PANIC" "$LOG/strict.out" | tail -3; FAIL=1; fi
}
run_passes() { # dependency order unknown: repeat until no real ERROR lines.
  # Process status first, text second. These passes run WITHOUT ON_ERROR_STOP, and psql then exits 0 even when
  # statements fail (3 is only possible with ON_ERROR_STOP; 1 = psql's own fatal error; 2 = connection lost).
  # So ANY non-zero status is abnormal and fatal on its own; no output text can explain it away. Only the
  # per-statement ERROR lines of a status-0 run are classified, against the exact benign set above.
  local f="$1" pass st real
  for pass in 1 2 3 4 5 6; do
    psql "$PGURL" -q -f "$f" >"$LOG/pass.out" 2>&1; st=$?
    if [ $st -ne 0 ] || grep -qE "^psql: (FATAL|error)|^(FATAL|PANIC):|server closed the connection|connection to server .* lost" "$LOG/pass.out"; then
      echo "FATAL: psql exited $st applying $(basename "$f") (process status or connection failure, not a statement error):"; tail -3 "$LOG/pass.out"; FAIL=1; return 1
    fi
    real=$(grep "ERROR" "$LOG/pass.out" | grep -vE "$BENIGN" | wc -l)
    [ "$real" = "0" ] && return 0
  done
  echo "FATAL: $(basename "$f") still has $real real error(s) after 6 passes:"; grep ERROR "$LOG/pass.out" | grep -vE "$BENIGN" | sort | uniq -c | head -10; FAIL=1; return 1
}
run_strict "$SNAP/01_types_tables.sql"
[ $FAIL -eq 0 ] && run_passes "$SNAP/03_functions.sql"
[ $FAIL -eq 0 ] && run_passes "$SNAP/02_constraints_indexes_views.sql"
[ $FAIL -eq 0 ] && run_passes "$SNAP/02_constraints_indexes_views.sql"
[ $FAIL -eq 0 ] && run_strict "$SNAP/04_rls_policies.sql"
[ $FAIL -eq 0 ] && run_passes "$SNAP/05_triggers_grants.sql"
# Exact privilege reconciliation: the GRANT lines are positive-only, so they keep any default ACLs the server adds
# (the Supabase image grants anon ALL on new public tables; first PG15 run 41266473201). Revoke exactly what the
# capture lacks, per (relation, role, privilege), and fail on any residual or missing privilege.
[ $FAIL -eq 0 ] && { "$ROOT/scripts/local-stack/reconcile-table-acl.sh" "$PGURL" "$SNAP/05_triggers_grants.sql" "$VIEWS_BROKEN_LIVE" || FAIL=1; }
[ $FAIL -eq 0 ] && run_strict "$ROOT/scripts/local-stack/localize.sql"
[ $FAIL -ne 0 ] && { echo "BOOTSTRAP FAILED: incomplete schema replay"; exit 1; }
"$ROOT/scripts/local-stack/verify-identities.sh" "$PGURL" || { echo "BOOTSTRAP FAILED: identity verification"; exit 1; }
ver=$(q 'show server_version') || { echo "BOOTSTRAP FAILED: server version probe (psql exit $?)"; exit 1; }
[ -n "$ver" ] || { echo "BOOTSTRAP FAILED: server version probe returned nothing"; exit 1; }
echo "bootstrap OK on $ver (local stack; PG15 parity and browser acceptance are separate gates)"
