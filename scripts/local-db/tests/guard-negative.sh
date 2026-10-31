#!/usr/bin/env bash
# ABOUTME: Proves every database-touching entrypoint refuses a remote or deceptive target BEFORE any
# ABOUTME: psql process starts: a fake psql on PATH records any invocation; the test fails if it ran.
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; FAKE=$(mktemp -d); MARK="$FAKE/psql-was-called"
cat > "$FAKE/psql" <<'PSQL'
#!/usr/bin/env bash
echo "$@" >> "${FAKE_MARK}"; exit 1
PSQL
chmod +x "$FAKE/psql"; export FAKE_MARK="$MARK"; export PATH="$FAKE:$PATH"
PROD=$(sed -nE 's/^\s*project_id\s*=\s*"([a-z0-9]+)".*/\1/p' "$ROOT/supabase/config.toml")
rc=0; n=0
for f in scripts/local-db/run-sql-tests.sh scripts/local-db/replay-migrations.sh scripts/local-db/build-from-snapshot.sh scripts/e2e/seed.sh; do [ -x "$ROOT/$f" ] || { echo "harness error: $ROOT/$f missing"; exit 1; }; done
check() { # name, expected-exit-nonzero, command...
  local name="$1"; shift; rm -f "$MARK"; n=$((n+1))
  "$@" >/dev/null 2>&1; local st=$?
  if [ $st -eq 0 ]; then echo "FAIL $name (exit 0; expected refusal)"; rc=1
  elif [ $st -eq 127 ] || [ $st -eq 126 ]; then echo "FAIL $name (exit $st: entrypoint not found/executable — harness error, not a refusal)"; rc=1
  elif [ -f "$MARK" ]; then echo "FAIL $name (refused, but psql WAS invoked: $(head -c 120 "$MARK"))"; rc=1
  else echo "PASS $name (refused with exit $st, psql never invoked)"; fi
}
DSNS=(
  "postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres"
  "postgresql://postgres.${PROD}:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  "postgresql://u@localhost,db.${PROD}.supabase.co:5432/postgres"
  "postgresql://u@localhost/db?hostaddr=203.0.113.9"
  "postgresql:///db?host=db.${PROD}.supabase.co"
  "host=localhost hostaddr=203.0.113.9 dbname=postgres"
  "postgresql://127.0.0.1@db.${PROD}.supabase.co/postgres"
  "postgresql://u@localhost.attacker.example/db"
  "postgresql://u@%6cocalhost/db"
  "service=production"
  "postgresql:///db"
)
for d in "${DSNS[@]}"; do
  check "run-sql-tests.sh  ← $d"       "$ROOT/scripts/local-db/run-sql-tests.sh" "$d"
  check "replay-migrations ← $d"       "$ROOT/scripts/local-db/replay-migrations.sh" "$d"
  check "build-from-snapshot ← $d"     "$ROOT/scripts/local-db/build-from-snapshot.sh" "$d" /tmp/does-not-matter
done
# env overrides with an otherwise-fine loopback DSN
check "run-sql-tests.sh  ← PGHOST override"   env PGHOST="db.${PROD}.supabase.co" "$ROOT/scripts/local-db/run-sql-tests.sh" "postgresql://postgres@127.0.0.1:54329/x"
check "build-from-snapshot ← PGHOSTADDR override" env PGHOSTADDR=203.0.113.9 "$ROOT/scripts/local-db/build-from-snapshot.sh" "postgresql://postgres@127.0.0.1:54329/x" /tmp/x
# the live seed entrypoint: production, unset, look-alike, and declared-isolated-but-mismatched
check "seed.sh ← unset targets"                 env -u VITE_SUPABASE_URL -u SUPABASE_DB_URL -u E2E_RELAY_TARGET "$ROOT/scripts/e2e/seed.sh"
check "seed.sh ← production targets"            env VITE_SUPABASE_URL="https://${PROD}.supabase.co" SUPABASE_DB_URL="postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres" E2E_RELAY_TARGET="https://${PROD}.supabase.co" "$ROOT/scripts/e2e/seed.sh"
check "seed.sh ← production + every opt-in string" env E2E_ALLOW_PRODUCTION_TARGET="$PROD" E2E_ISOLATED_TARGET_REF="$PROD" VITE_SUPABASE_URL="https://${PROD}.supabase.co" SUPABASE_DB_URL="postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres" E2E_RELAY_TARGET="https://${PROD}.supabase.co" "$ROOT/scripts/e2e/seed.sh"
check "seed.sh ← look-alike host"               env VITE_SUPABASE_URL="https://${PROD}.supabase.co.attacker.example" SUPABASE_DB_URL="postgresql://postgres:x@localhost.attacker.example:5432/postgres" E2E_RELAY_TARGET="http://localhost:1" "$ROOT/scripts/e2e/seed.sh"
check "seed.sh ← isolated ref declared but DB url is production" env E2E_ISOLATED_TARGET_REF=abcdefghijklmnopqrst VITE_SUPABASE_URL="https://abcdefghijklmnopqrst.supabase.co" SUPABASE_DB_URL="postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres" E2E_RELAY_TARGET="https://abcdefghijklmnopqrst.supabase.co" "$ROOT/scripts/e2e/seed.sh"
echo "guard-negative: $n cases, exit $rc"; rm -rf "$FAKE"; exit $rc
