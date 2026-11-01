#!/usr/bin/env bash
# ABOUTME: MOCKED egress self-test wrapper: a loopback "app" and a NON-loopback "external" server on this machine, then the
# ABOUTME: egress self-test in a real Chromium with the mode's own options; requires every case to pass and 0 external hits.
# A third loopback port (NOT approved) runs a sink that counts hits: approved -> 302 -> that port must never reach it.
# Nothing here probes link-local or metadata addresses.
set -u
HERE="$(cd "$(dirname "$0")/../../../.." && pwd)"
EXT_IP=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -vE '^(127\.|$)' | grep -E '^[0-9.]+$' | head -1)
[ -n "$EXT_IP" ] || { echo "REFUSED no non-loopback IPv4 address on this machine to stand in for an external host"; exit 2; }
T=$(mktemp -d); P1=; P2=; P3=; trap '[ -n "$P1" ] && kill $P1 2>/dev/null; [ -n "$P2" ] && kill $P2 2>/dev/null; [ -n "$P3" ] && kill $P3 2>/dev/null; rm -rf "$T"' EXIT
APP=$((55600 + RANDOM % 300)); EXTP=$((APP + 1)); LOOPP=$((APP + 2))
cat > "$T/servers.mjs" <<'JS'
import http from 'node:http'; import fs from 'node:fs';
const [mode, host, port, ext, hits, loop, applog] = process.argv.slice(2);
http.createServer((req, res) => {
  if (mode === 'loop') { fs.appendFileSync(hits, `${req.method} ${req.url}\n`); res.writeHead(200, { 'access-control-allow-origin': '*' }); return res.end('loop sink'); }
  if (req.url === '/redirect-loopback') { fs.appendFileSync(applog, '302 /redirect-loopback\n'); res.writeHead(302, { location: `${loop}/hit` }); return res.end(); }
  if (mode === 'ext') { fs.appendFileSync(hits, `${req.method} ${req.url}\n`); res.writeHead(200, { 'access-control-allow-origin': '*' }); return res.end('external'); }
  if (req.url === '/redirect') { res.writeHead(302, { location: `${ext}/hit` }); return res.end(); }
  if (req.url === '/ok') { res.writeHead(200); return res.end('ok'); }
  if (req.url === '/sw.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(`fetch('${ext}/sw-hit')`); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>app</title><div id="root">app</div>');
}).listen(Number(port), host);
JS
: > "$T/hits"; : > "$T/loophits"; : > "$T/applog"
node "$T/servers.mjs" app 127.0.0.1 "$APP" "http://$EXT_IP:$EXTP" "$T/hits" "http://127.0.0.1:$LOOPP" "$T/applog" & P1=$!
node "$T/servers.mjs" ext "$EXT_IP" "$EXTP" "" "$T/hits" "" "" & P2=$!
node "$T/servers.mjs" loop 127.0.0.1 "$LOOPP" "" "$T/loophits" "" "" & P3=$!
for i in $(seq 1 25); do curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$APP/ok" && curl -s -o /dev/null --noproxy '*' --max-time 1 "http://$EXT_IP:$EXTP/probe" && curl -s -o /dev/null --noproxy '*' --max-time 1 "http://127.0.0.1:$LOOPP/probe" && break; sleep 0.2; done
grep -q "/probe" "$T/hits" || { echo "FAIL the external stand-in is not reachable outside the browser, so a 0-hit result would prove nothing"; exit 1; }
grep -q "/probe" "$T/loophits" || { echo "FAIL the third-port loopback sink is not reachable outside the browser, so a 0-hit result would prove nothing"; exit 1; }
: > "$T/hits"; : > "$T/loophits"
cd "$HERE"
# Browser pin: the exact Playwright headless shell (the fixture resolves the same pin), or refuse before any launch. A full
# Chrome is never used: its own background services generate refused requests (measured), which the gate counts.
node scripts/local-stack/quiz-lifecycle/headless-shell.mjs receipt || { echo "FAIL headless shell pin refused (no browser launched)"; exit 1; }
env E2E_BASE_URL="http://127.0.0.1:$APP" VITE_SUPABASE_URL="http://127.0.0.1:$APP" QLC_EXT_URL="http://$EXT_IP:$EXTP" QLC_EVIDENCE_DIR="$T/ev" \
    QLC_LOOP_URL="http://127.0.0.1:$LOOPP" QLC_LOOP_HITS="$T/loophits" QLC_APP_LOG="$T/applog" \
  npx playwright test -c scripts/local-stack/quiz-lifecycle/tests/playwright.egress-selftest.config.ts ${QLC_SELFTEST_GREP:+--grep "$QLC_SELFTEST_GREP"}
st=$?
hits=$(wc -l < "$T/hits" | tr -d ' '); loophits=$(wc -l < "$T/loophits" | tr -d ' '); served=$(grep -c '^302 /redirect-loopback$' "$T/applog")
# Counted above for the mode run; control A below is EXPECTED to hit the sink.
node scripts/local-stack/quiz-lifecycle/tests/egress-causal-control.mjs "http://127.0.0.1:$APP" "$T/loophits"; cc=$?
echo "external stand-in hits from the browser: $hits"
echo "third-port loopback sink hits from the browser: $loophits (app served the 302 to that port $served times)"
[ "$hits" = 0 ] || { echo "FAIL the browser reached the external stand-in"; sed 's/^/  /' "$T/hits"; exit 1; }
[ "$loophits" = 0 ] || { echo "FAIL the browser reached the unapproved loopback port"; sed 's/^/  /' "$T/loophits"; exit 1; }
[ "$served" -ge 2 ] || { echo "FAIL the redirect-to-loopback path was not exercised (fetch and navigation)"; exit 1; }
[ "$st" = 0 ] || { echo "FAIL egress self-test cases (exit $st)"; exit 1; }
[ "$cc" = 0 ] || { echo "FAIL causal control (exit $cc)"; exit 1; }
echo "== MOCKED egress-selftest: all cases passed, 0 external hits, 0 third-port loopback hits (real Chromium, local stand-in servers; not a stack)"
