#!/usr/bin/env bash
# ABOUTME: MOCKED no-Edge guard self-test wrapper: a loopback app and a loopback API SINK (the approved API origin) that logs every
# ABOUTME: request. Runs the self-test ACTIVE (QLC_NO_EDGE=1, zero forbidden sink calls) and INACTIVE (same requests reach it).
# Also a static check: the spec never calls route.continue() (every forwarding path is the context route or forwardApproved).
set -u
HERE="$(cd "$(dirname "$0")/../../../.." && pwd)"
T=$(mktemp -d); P1=; P2=; trap '[ -n "$P1" ] && kill $P1 2>/dev/null; [ -n "$P2" ] && kill $P2 2>/dev/null; rm -rf "$T"' EXIT
APP=$((55900 + RANDOM % 300)); SINKP=$((APP + 1))
cat > "$T/servers.mjs" <<'JS'
import http from 'node:http'; import fs from 'node:fs';
const [mode, port, hits] = process.argv.slice(2);
http.createServer((req, res) => {
  if (mode === 'sink') {
    fs.appendFileSync(hits, `${req.method} ${req.url}\n`);
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' };
    if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
    res.writeHead(200, { ...h, 'content-type': 'application/json' }); return res.end('[]');
  }
  if (req.url === '/ok') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>app</title><div id="root">app</div>');
}).listen(Number(port), '127.0.0.1');
JS
: > "$T/sinkhits"
node "$T/servers.mjs" app "$APP" "" & P1=$!
node "$T/servers.mjs" sink "$SINKP" "$T/sinkhits" & P2=$!
for i in $(seq 1 25); do curl -s -o /dev/null --noproxy '*' --max-time 1 "http://127.0.0.1:$APP/ok" && curl -s -o /dev/null --noproxy '*' --max-time 1 "http://127.0.0.1:$SINKP/probe" && break; sleep 0.2; done
grep -q "/probe" "$T/sinkhits" || { echo "FAIL the API sink is not reachable outside the browser, so a 0-call result would prove nothing"; exit 1; }
: > "$T/sinkhits"
cd "$HERE"
if grep -n 'route\.continue(' e2e/quiz-lifecycle/lifecycle.isolated.ts; then echo "FAIL a spec route handler calls route.continue(), which bypasses the preventive guard"; exit 1; fi
echo "static: no route.continue() in the spec (every forwarding path is the context route or forwardApproved)"
if [ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ] && ! [ -x "$(node -e "console.log(require('playwright').chromium.executablePath().replace('chromium-', 'chromium_headless_shell-').replace('chrome-linux64/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell'))" 2>/dev/null)" ]; then
  export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$(ls /opt/pw-browsers/chromium_headless_shell-*/*/chrome-headless-shell 2>/dev/null | sort | tail -1)
fi
COMMON=(E2E_BASE_URL="http://127.0.0.1:$APP" VITE_SUPABASE_URL="http://127.0.0.1:$SINKP" QLC_SINK_HITS="$T/sinkhits" QLC_EVIDENCE_DIR="$T/ev")
env "${COMMON[@]}" QLC_NO_EDGE=1 npx playwright test -c scripts/local-stack/quiz-lifecycle/tests/playwright.noedge-selftest.config.ts; a=$?
fa=$(grep -cE 'probe=(RF|FF)[0-9]+$' "$T/sinkhits"); pa=$(grep -cE 'probe=(RA|FA)[0-9]+$' "$T/sinkhits")
env -u QLC_NO_EDGE "${COMMON[@]}" npx playwright test -c scripts/local-stack/quiz-lifecycle/tests/playwright.noedge-selftest.config.ts; b=$?
ic=$(grep -cE 'probe=IC[0-9]+$' "$T/sinkhits")
echo "ACTIVE: forbidden sink calls $fa (must be 0); allowed sink calls $pa (must be > 0)"
echo "INACTIVE control: the same forbidden requests reached the sink $ic times (must be > 0)"
[ "$a" = 0 ] || { echo "FAIL active cases (exit $a)"; exit 1; }
[ "$b" = 0 ] || { echo "FAIL inactive control cases (exit $b)"; exit 1; }
[ "$fa" = 0 ] || { echo "FAIL a forbidden request reached the API sink"; grep -E 'probe=(RF|FF)' "$T/sinkhits" | sed 's/^/  /'; exit 1; }
[ "$pa" -gt 0 ] && [ "$ic" -gt 0 ] || { echo "FAIL positive or inactive control did not reach the sink"; exit 1; }
echo "== MOCKED noedge-selftest: refusals before forwarding with 0 forbidden sink calls; positives and inactive control reach the sink (real Chromium, loopback stand-ins; not a stack)"
