#!/usr/bin/env bash
# ABOUTME: LOCAL-SHIM end-to-end order on a plain PostgreSQL using the SAME stage scripts as CI: fanout source inventory,
# ABOUTME: stage-pre (guard, queue-only verify, net.* sentinels), then stage-app. NOT pg_net acceptance.
# Usage: local-shim-run.sh <loopback maintenance url, e.g. postgresql://postgres@127.0.0.1:54329/postgres> <template db> OLD|NEW [api]
#   api: also runs personas + API controls against tests/mock-stack.mjs, a MOCKED GoTrue and PostgREST-shaped HTTP layer
#        over the real local database (real RLS, triggers and roles; HTTP layer mocked; authentic Kong/PostgREST/GoTrue NOT run).
# DISPOSABLE ONLY: drops and recreates the database t09r_<mode>. Never point it at an existing or shared stack.
# Difference from CI, stated: the template already holds the snapshot, so here the application schema exists during
# stage-pre; in CI stage-pre runs before bootstrap.sh creates it. Stage-pre reads neither, so the order is the same.
set -u
BASE="${1:?maintenance url}"; TEMPLATE="${2:?template}"; MODE="${3:?OLD or NEW}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$BASE" || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
DB_NAME="t09r_$(tr 'A-Z' 'a-z' <<<"$MODE")"; DB="${BASE%/*}/$DB_NAME"
die() { echo "FAIL $*"; exit 1; }
"$HERE/fanout-inventory.sh" || die "fanout inventory"
psql "$BASE" -qc "drop database if exists $DB_NAME" -qc "create database $DB_NAME template $TEMPLATE" >/dev/null 2>&1 || die "clone"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/pgnet-queue-shim.sql" >/dev/null 2>&1 || die "shim"
# A fresh `supabase start` vault holds none of the frozen names; the template is brought to the same state.
psql "$DB" -v ON_ERROR_STOP=1 -qc "delete from vault.secrets" >/dev/null || die "vault reset"
echo "-- STAGE PRE (LOCAL-SHIM)"; "$HERE/stage-pre.sh" "$DB" 1 || die "stage pre"
# Bootstrap-equivalent, kept apart from the stages: the template already holds the snapshot, so only bootstrap's final
# file runs here, the SAME localize.sql (creates each referenced vault name once with the placeholder, unschedules cron).
echo "-- BOOTSTRAP-EQUIVALENT (LOCAL-SHIM): localize.sql, as bootstrap.sh runs it"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/local-stack/localize.sql" 2>&1 | sed 's/^.*NOTICE: */   /'; [ "${PIPESTATUS[0]}" -eq 0 ] || die "localize"
if [ "${4:-}" = api ]; then
  umask 077; K=$(mktemp -d); MOCK_PID=; trap '[ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null; rm -rf "$K"' EXIT
  export MOCK_JWT_SECRET; MOCK_JWT_SECRET=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
  eval "$(node -e 'const {createHmac}=require("crypto");const b=x=>Buffer.from(x).toString("base64url");
    const s=(p)=>{const h=b(JSON.stringify({alg:"HS256",typ:"JWT"})),q=b(JSON.stringify(p));return h+"."+q+"."+createHmac("sha256",process.env.MOCK_JWT_SECRET).update(h+"."+q).digest("base64url")};
    console.log("export MOCK_ANON_KEY="+s({role:"anon"})+" MOCK_SERVICE_KEY="+s({role:"service_role"}))')"
  printf '%s' "$MOCK_ANON_KEY" > "$K/anon"; printf '%s' "$MOCK_SERVICE_KEY" > "$K/service"; chmod 600 "$K/anon" "$K/service"
  PORT=$((54400 + RANDOM % 500))
  node "$HERE/tests/mock-stack.mjs" "$PORT" "$DB" > "$K/mock.log" 2>&1 & MOCK_PID=$!
  for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null --connect-timeout 1 --max-time 2 "http://127.0.0.1:$PORT/rest/v1/" -H "apikey: x" && break; sleep 0.5; done
  export T09_API_URL="http://127.0.0.1:$PORT" T09_ANON_KEY_FILE="$K/anon" T09_SERVICE_KEY_FILE="$K/service" T09_PERSONA_FILE="$K/personas.json"
  echo "-- API tier enabled: MOCKED GoTrue + PostgREST-shaped layer on 127.0.0.1:$PORT over the LOCAL-SHIM database"
fi
echo "-- STAGE APP $MODE (LOCAL-SHIM)"; "$HERE/stage-app.sh" "$DB" "$MODE" 1 || die "stage app"
echo "== LOCAL-SHIM run $MODE: ALL STEPS PASS (not pg_net acceptance)"
