#!/usr/bin/env bash
# ABOUTME: Env-only selftest for the gradebook-roles strict local binding: every non-local or ambiguous configuration is
# ABOUTME: refused, and the Playwright config refuses at LOAD time (no setup ran, no session file written). No network.
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; cd "$ROOT"; pass=0; fail=0
DSN='postgresql://postgres@127.0.0.1:54322/postgres'
base() { env -i PATH="$PATH" HOME="$HOME" VITE_SUPABASE_URL=http://127.0.0.1:54321 E2E_BASE_URL=http://127.0.0.1:8080 VITE_SUPABASE_ANON_KEY=fake-anon SUPABASE_DB_URL="$DSN" "$@"; }
check() { # label want(0|3) env-overrides...
  local label="$1" want="$2"; shift 2
  out=$(base "$@" node e2e/gradebook-roles/local-binding.mjs 2>&1); st=$?
  if [ $st -eq "$want" ]; then echo "PASS $label (exit $st) :: $out"; pass=$((pass+1)); else echo "FAIL $label: exit $st want $want :: $out"; fail=$((fail+1)); fi
}
check B0-local-ok 0
check B1-hosted-api 3 VITE_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co
check B2-api-userinfo 3 VITE_SUPABASE_URL=http://u@127.0.0.1:54321
check B3-api-no-port 3 VITE_SUPABASE_URL=http://127.0.0.1
check B4-api-path 3 VITE_SUPABASE_URL=http://127.0.0.1:54321/rest
check B5-api-non-loopback 3 VITE_SUPABASE_URL=http://10.1.0.4:54321
check B6-app-non-loopback 3 E2E_BASE_URL=http://example.test:8080
check B7-isolated-hosted-ref 3 E2E_ISOLATED_TARGET_REF=abcdefghijklmnopqrst
check B8-production-override 3 E2E_ALLOW_PRODUCTION_TARGET=abcdefghijklmnopqrst
check B9-relay-mode 3 E2E_USE_RELAY=1
check B10-relay-target-differs 3 E2E_RELAY_TARGET=http://127.0.0.1:54399
check B11-relay-target-same-ok 0 E2E_RELAY_TARGET=http://127.0.0.1:54321
check B12-db-non-loopback 3 SUPABASE_DB_URL=postgresql://postgres@db.example.test:5432/postgres
check B13-no-anon 3 VITE_SUPABASE_ANON_KEY=
check B14-two-anon-keys 3 VITE_SUPABASE_PUBLISHABLE_KEY=other
# Config-load refusal: Playwright must fail while loading the config, before globalSetup could sign anyone in.
rm -rf .playwright-sessions/gradebook-roles
out=$(base VITE_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH=/bin/true npx --no-install playwright test -c playwright.gradebook-roles.config.ts 2>&1); st=$?
if [ $st -ne 0 ] && grep -q 'gradebook-roles refused: VITE_SUPABASE_URL' <<<"$out" && [ ! -e .playwright-sessions/gradebook-roles ]; then echo "PASS C1 config refuses at load with a hosted API; no session directory was created"; pass=$((pass+1)); else echo "FAIL C1 exit $st"; fail=$((fail+1)); fi
code() { grep -vE '^\s*//' "$1"; }   # code lines only: comments may NAME what is excluded
code playwright.gradebook-roles.config.ts | grep -qE "globalTeardown\s*:" && { echo "FAIL C2 config declares a globalTeardown"; fail=$((fail+1)); } || { echo "PASS C2 no globalTeardown declared"; pass=$((pass+1)); }
code playwright.gradebook-roles.config.ts | grep -qE "global-setup|global-teardown|from './playwright.config'|webServer\s*:" && { echo "FAIL C3 config inherits base setup/teardown/webServer"; fail=$((fail+1)); } || { echo "PASS C3 no base setup, teardown or webServer referenced"; pass=$((pass+1)); }
code e2e/gradebook-roles/session-setup.ts | grep -qiE "\.delete\(|sweep|setE2EPassword|admin-users|method: *'(DELETE|PATCH|PUT)'" && { echo "FAIL C4 session setup can delete or bootstrap"; fail=$((fail+1)); } || { echo "PASS C4 session setup has no delete, sweep or password bootstrap"; pass=$((pass+1)); }
echo "== gradebook-roles binding selftest (env only, no network): $pass PASS, $fail FAIL"
[ $fail -eq 0 ]
