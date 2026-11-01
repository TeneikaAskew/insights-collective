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
# dsn user pw rest: credential-bearing test DSNs are assembled here so no tracked line carries a
# scheme://user:password@host literal (the repository secret scan flags that shape even for placeholders).
dsn() { printf '%s//%s:%s@%s' 'postgresql:' "$1" "$2" "$3"; }
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
  "$(dsn "postgres" "x" "db.${PROD}.supabase.co:5432/postgres")"
  "$(dsn "postgres.${PROD}" "x" "aws-0-us-east-1.pooler.supabase.com:6543/postgres")"
  "postgresql://u@localhost,db.${PROD}.supabase.co:5432/postgres"
  "postgresql://u@localhost/db?hostaddr=203.0.113.9"
  "postgresql:///db?host=db.${PROD}.supabase.co"
  "host=localhost hostaddr=203.0.113.9 dbname=postgres"
  "host=remote.example password=x\\ host=localhost"
  "host=remote.example dbname=x\\ host=localhost"
  "host=localhost\\ hostaddr=203.0.113.9"
  "host=remote.example password='x host=localhost'"
  "host=localhost host=remote.example"
  "hostaddr=203.0.113.9 host=localhost"
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
LOOP_API="http://localhost:54321"
check "seed.sh ← unset targets"                 env -u VITE_SUPABASE_URL -u SUPABASE_DB_URL -u E2E_RELAY_TARGET "$ROOT/scripts/e2e/seed.sh"
check "seed.sh ← production targets"            env VITE_SUPABASE_URL="https://${PROD}.supabase.co" SUPABASE_DB_URL="$(dsn "postgres" "x" "db.${PROD}.supabase.co:5432/postgres")" E2E_RELAY_TARGET="https://${PROD}.supabase.co" "$ROOT/scripts/e2e/seed.sh"
check "seed.sh ← production + every former opt-in string" env E2E_ALLOW_PRODUCTION_TARGET="$PROD" E2E_ISOLATED_TARGET_REF="$PROD" VITE_SUPABASE_URL="https://${PROD}.supabase.co" SUPABASE_DB_URL="$(dsn "postgres" "x" "db.${PROD}.supabase.co:5432/postgres")" E2E_RELAY_TARGET="https://${PROD}.supabase.co" "$ROOT/scripts/e2e/seed.sh"
check "seed.sh ← look-alike host"               env VITE_SUPABASE_URL="https://${PROD}.supabase.co.attacker.example" SUPABASE_DB_URL="$(dsn "postgres" "x" "localhost.attacker.example:5432/postgres")" E2E_RELAY_TARGET="http://localhost:1" "$ROOT/scripts/e2e/seed.sh"
check "seed.sh ← isolated ref declared but DB url is production" env E2E_ISOLATED_TARGET_REF=abcdefghijklmnopqrst VITE_SUPABASE_URL="https://abcdefghijklmnopqrst.supabase.co" SUPABASE_DB_URL="$(dsn "postgres" "x" "db.${PROD}.supabase.co:5432/postgres")" E2E_RELAY_TARGET="https://abcdefghijklmnopqrst.supabase.co" "$ROOT/scripts/e2e/seed.sh"
# libpq redirection through SUPABASE_DB_URL while the API targets are loopback (the reviewer's bypass)
SEED_DSNS=(
  "postgresql://u@localhost:5432/db?hostaddr=203.0.113.9"
  "postgresql://u@localhost:5432/db?host=remote.example"
  "postgresql://u@localhost:5432/db?service=production"
  "postgresql://u@localhost:5432/db#?host=remote.example"
  "postgresql://u@localhost:5432/db#?hostaddr=203.0.113.9"
  "postgresql://u@localhost/db%3F?host=remote.example"
  "postgresql://a@b@localhost/db"
  "postgresql://u@localhost,remote.example/db"
  "host=localhost hostaddr=203.0.113.9 dbname=db"
  "postgresql://127.0.0.1@remote.example/db"
  "postgresql:///db"
  "postgresql://u@localhost/db?options=-c%20x"
  "postgresql://u@localhost/db?passfile=/tmp/pgpass"
  "${DSNS[@]}"
)
for d in "${SEED_DSNS[@]}"; do
  check "seed.sh ← SUPABASE_DB_URL=$d" env VITE_SUPABASE_URL="$LOOP_API" E2E_RELAY_TARGET="$LOOP_API" SUPABASE_DB_URL="$d" "$ROOT/scripts/e2e/seed.sh"
done
check "seed.sh ← loopback DSN but PGHOSTADDR override" env PGHOSTADDR=203.0.113.9 VITE_SUPABASE_URL="$LOOP_API" E2E_RELAY_TARGET="$LOOP_API" SUPABASE_DB_URL="postgresql://postgres@127.0.0.1:54329/db" "$ROOT/scripts/e2e/seed.sh"
# the negative-test harness is itself an entrypoint (it creates/drops databases)
check "build-negative.sh ← remote PGBASE"       "$ROOT/scripts/local-db/tests/build-negative.sh" "$(dsn "postgres" "x" "db.${PROD}.supabase.co:5432")" /tmp/x
check "build-negative.sh ← PGBASE with hostaddr" "$ROOT/scripts/local-db/tests/build-negative.sh" "postgresql://postgres@127.0.0.1:54329?hostaddr=203.0.113.9" /tmp/x
check "build-negative.sh ← loopback PGBASE but PGHOSTADDR override" env PGHOSTADDR=203.0.113.9 "$ROOT/scripts/local-db/tests/build-negative.sh" "postgresql://postgres@127.0.0.1:54329" /tmp/x
check "build-negative.sh ← PGHOST override"      env PGHOST="db.${PROD}.supabase.co" "$ROOT/scripts/local-db/tests/build-negative.sh" "postgresql://postgres@127.0.0.1:54329" /tmp/x

# ---- credential-leak regressions: refusal output (CLI and the actual seed wrapper) must never echo a secret ----
SENT='SYNTHETIC_SECRET!'
leakcheck() { # name, command... → PASS iff refused, psql not invoked, and output lacks the sentinel
  local name="$1"; shift; rm -f "$MARK"; n=$((n+1))
  local out; out=$("$@" 2>&1); local st=$?
  if [ $st -eq 0 ]; then echo "FAIL $name (exit 0; expected refusal)"; rc=1
  elif [ -f "$MARK" ]; then echo "FAIL $name (psql WAS invoked)"; rc=1
  elif printf '%s' "$out" | grep -qF "$SENT"; then echo "FAIL $name (refusal output echoed the credential)"; rc=1
  else echo "PASS $name (refused with exit $st, psql never invoked, credential absent from output)"; fi
}
for d in "host=localhost password=${SENT}" "host=remote.example password=${SENT}x host=localhost" "$(dsn "u" "${SENT}" "remote.example/db")" "$(dsn "u" "${SENT}" "localhost/db?hostaddr=203.0.113.9")" "postgresql://${SENT}@remote.example/db"; do
  leakcheck "assert-local-dsn CLI ← credential-bearing refused DSN" node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$d"
  leakcheck "run-sql-tests.sh ← credential-bearing refused DSN" "$ROOT/scripts/local-db/run-sql-tests.sh" "$d"
  leakcheck "seed.sh ← credential-bearing refused SUPABASE_DB_URL" env VITE_SUPABASE_URL="$LOOP_API" E2E_RELAY_TARGET="$LOOP_API" SUPABASE_DB_URL="$d" "$ROOT/scripts/e2e/seed.sh"
done
# the E2E guard CLI prints a redacted summary for an ACCEPTED loopback DSN that carries a password
rm -f "$MARK"; out=$(env VITE_SUPABASE_URL="$LOOP_API" E2E_RELAY_TARGET="$LOOP_API" SUPABASE_DB_URL="$(dsn "postgres" "${SENT}" "127.0.0.1:54329/db")" node "$ROOT/scripts/e2e/assert-safe-target.mjs" --mutating 2>&1); n=$((n+1))
if printf '%s' "$out" | grep -qF "$SENT"; then echo "FAIL assert-safe-target CLI echoed an accepted DSN's password"; rc=1; else echo "PASS assert-safe-target CLI redacts an accepted DSN's password"; fi

# ---- genuine positive controls: a valid target MUST reach the (fake) psql process ----
pos=0; posfail=0
positive() { # name, command... → PASS iff the fake psql was invoked
  local name="$1"; shift; rm -f "$MARK"; pos=$((pos+1))
  "$@" >/dev/null 2>&1 || true
  if [ -f "$MARK" ]; then echo "PASS(positive) $name (psql invoked: $(head -1 "$MARK" | cut -c1-90))"; else echo "FAIL(positive) $name (psql was NOT invoked for a valid target)"; posfail=1; rc=1; fi
}
positive "run-sql-tests.sh ← loopback DSN"      "$ROOT/scripts/local-db/run-sql-tests.sh" "postgresql://postgres@127.0.0.1:54329/ic_snapshot"
positive "replay-migrations ← loopback DSN"      "$ROOT/scripts/local-db/replay-migrations.sh" "postgresql://postgres@127.0.0.1:54329/ic_snapshot"
positive "build-from-snapshot ← loopback DSN"    "$ROOT/scripts/local-db/build-from-snapshot.sh" "postgresql://postgres@127.0.0.1:54329/ic_snapshot" /tmp/does-not-matter
positive "build-negative.sh ← loopback PGBASE"   "$ROOT/scripts/local-db/tests/build-negative.sh" "postgresql://postgres@127.0.0.1:54329" /tmp/does-not-matter
positive "run-sql-tests.sh ← keyword-form loopback DSN" "$ROOT/scripts/local-db/run-sql-tests.sh" "host=127.0.0.1 port=54329 dbname=ic_snapshot user=postgres"
positive "seed.sh ← keyword-form loopback DSN"      env VITE_SUPABASE_URL="$LOOP_API" E2E_RELAY_TARGET="$LOOP_API" SUPABASE_DB_URL="host=127.0.0.1 port=54329 dbname=db user=postgres password=plain-pw" E2E_TEST_PASSWORD=local-only "$ROOT/scripts/e2e/seed.sh"
positive "seed.sh ← loopback targets"            env VITE_SUPABASE_URL="$LOOP_API" E2E_RELAY_TARGET="$LOOP_API" SUPABASE_DB_URL="postgresql://postgres@127.0.0.1:54329/db" E2E_TEST_PASSWORD=local-only "$ROOT/scripts/e2e/seed.sh"
positive "seed.sh ← declared isolated project (pooler DSN)" env E2E_ISOLATED_TARGET_REF=abcdefghijklmnopqrst VITE_SUPABASE_URL="https://abcdefghijklmnopqrst.supabase.co" E2E_RELAY_TARGET="https://abcdefghijklmnopqrst.supabase.co" SUPABASE_DB_URL="$(dsn "postgres.abcdefghijklmnopqrst" "x" "aws-0-eu-west-1.pooler.supabase.com:6543/postgres")" E2E_TEST_PASSWORD=local-only "$ROOT/scripts/e2e/seed.sh"
positive "seed.sh ← declared isolated project (db host DSN)" env E2E_ISOLATED_TARGET_REF=abcdefghijklmnopqrst VITE_SUPABASE_URL="https://abcdefghijklmnopqrst.supabase.co" E2E_RELAY_TARGET="https://abcdefghijklmnopqrst.supabase.co" SUPABASE_DB_URL="$(dsn "postgres" "x" "db.abcdefghijklmnopqrst.supabase.co:5432/postgres")" E2E_TEST_PASSWORD=local-only "$ROOT/scripts/e2e/seed.sh"
echo "guard-negative: $n refusal cases (all must refuse before psql), $pos positive controls (all must reach psql); exit $rc"; rm -rf "$FAKE"; exit $rc
