#!/usr/bin/env bash
# ABOUTME: Offline selftest for export-status.mjs with a MOCKED status file: refuses a group/world-readable file, emits every
# ABOUTME: ::add-mask:: line before GITHUB_ENV is written, never prints a value, refuses non-loopback endpoints.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; RC=0
J1=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.aaaaaaaa; J2=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.bbbbbbbb
mk() { umask 077; rm -f "$T/s"; printf 'API_URL="http://127.0.0.1:54321"\nDB_URL="postgresql://postgres:dbpw-1234@%s:54322/postgres"\nANON_KEY="%s"\nSERVICE_ROLE_KEY="%s"\nJWT_SECRET="jwt-secret-5678"\nS3_PROTOCOL_ACCESS_KEY_SECRET="s3-secret-9012"\n' "${1:-127.0.0.1}" "$J1" "$J2" > "$T/s"; : > "$T/env"; }
ok() { echo "PASS $1"; }; no() { echo "FAIL $1"; RC=1; }
mk; out=$(node "$HERE/export-status.mjs" "$T/s" "$T/env"); st=$?
masks=$(grep -c '^::add-mask::' <<<"$out")
for v in "$J1" "$J2" jwt-secret-5678 s3-secret-9012 dbpw-1234 "postgresql://postgres:dbpw-1234@127.0.0.1:54322/postgres"; do
  grep -qxF "::add-mask::$v" <<<"$out" || { no "mask-missing for a ${#v}-char value"; }
done
[ $st -eq 0 ] && [ "$masks" -ge 6 ] && ok "masks-registered ($masks)" || no "masks st=$st n=$masks"
# Apart from the ::add-mask:: commands (consumed by the runner, never shown), no value appears on stdout.
grep -v '^::add-mask::' <<<"$out" | grep -qE "eyJ|secret-|dbpw" && no "value-printed" || ok "no-value-printed"
[ "$(head -1 <<<"$out" | cut -c1-12)" = "::add-mask::" ] && ok "masks-before-summary" || no "masks-before-summary"
grep -qF 'SUPABASE_DB_URL=postgresql://' "$T/env" && ! grep -q SERVICE_ROLE "$T/env" && ! grep -q jwt-secret "$T/env" && ok "env-has-only-endpoints-and-anon" || no "env-content"
mk; chmod 644 "$T/s"; node "$HERE/export-status.mjs" "$T/s" "$T/env" >/dev/null 2>"$T/e"; [ $? -ne 0 ] && grep -q 'readable by others' "$T/e" && [ ! -s "$T/env" ] && ok "refuses-readable-status-file" || no "readable"
mk 10.0.0.5; out=$(node "$HERE/export-status.mjs" "$T/s" "$T/env" 2>"$T/e"); [ $? -ne 0 ] && grep -q 'non-loopback' "$T/e" && [ ! -s "$T/env" ] && ok "refuses-non-loopback (nothing exported)" || no "non-loopback"
echo "== export-status selftest (MOCKED status): $([ $RC -eq 0 ] && echo ALL PASS || echo FAILURES)"; exit $RC
