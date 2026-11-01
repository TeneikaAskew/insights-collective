#!/usr/bin/env bash
# ABOUTME: MOCKED egress self-test wrapper: a loopback "app" and a NON-loopback "external" server on this machine, then the
# ABOUTME: egress self-test in a real Chromium with the mode's own options; requires every case to pass and 0 external hits.
set -u
HERE="$(cd "$(dirname "$0")/../../../.." && pwd)"
EXT_IP=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -vE '^(127\.|$)' | grep -E '^[0-9.]+$' | head -1)
[ -n "$EXT_IP" ] || { echo "REFUSED no non-loopback IPv4 address on this machine to stand in for an external host"; exit 2; }
T=$(mktemp -d); P1=; P2=; trap '[ -n "$P1" ] && kill $P1 2>/dev/null; [ -n "$P2" ] && kill $P2 2>/dev/null; rm -rf "$T"' EXIT
APP=$((55600 + RANDOM % 300)); EXTP=$((APP + 1))
cat > "$T/servers.mjs" <<'JS'
import http from 'node:http'; import fs from 'node:fs';
const [mode, host, port, ext, hits] = process.argv.slice(2);
http.createServer((req, res) => {
  if (mode === 'ext') { fs.appendFileSync(hits, `${req.method} ${req.url}\n`); res.writeHead(200, { 'access-control-allow-origin': '*' }); return res.end('external'); }
  if (req.url === '/redirect') { res.writeHead(302, { location: `${ext}/hit` }); return res.end(); }
  if (req.url === '/ok') { res.writeHead(200); return res.end('ok'); }
  if (req.url === '/sw.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(`fetch('${ext}/sw-hit')`); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>app</title><div id="root">app</div>');
}).listen(Number(port), host);
JS
: > "$T/hits"
node "$T/servers.mjs" app 127.0.0.1 "$APP" "http://$EXT_IP:$EXTP" "$T/hits" & P1=$!
node "$T/servers.mjs" ext "$EXT_IP" "$EXTP" "" "$T/hits" & P2=$!
for i in $(seq 1 25); do curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$APP/ok" && curl -s -o /dev/null --noproxy '*' --max-time 1 "http://$EXT_IP:$EXTP/probe" && break; sleep 0.2; done
grep -q "/probe" "$T/hits" || { echo "FAIL the external stand-in is not reachable outside the browser, so a 0-hit result would prove nothing"; exit 1; }
: > "$T/hits"
cd "$HERE"
env E2E_BASE_URL="http://127.0.0.1:$APP" VITE_SUPABASE_URL="http://127.0.0.1:$APP" QLC_EXT_URL="http://$EXT_IP:$EXTP" QLC_EVIDENCE_DIR="$T/ev" \
  npx playwright test -c scripts/local-stack/quiz-lifecycle/tests/playwright.egress-selftest.config.ts
st=$?
hits=$(wc -l < "$T/hits" | tr -d ' ')
echo "external stand-in hits from the browser: $hits"
[ "$hits" = 0 ] || { echo "FAIL the browser reached the external stand-in"; sed 's/^/  /' "$T/hits"; exit 1; }
[ "$st" = 0 ] || { echo "FAIL egress self-test cases (exit $st)"; exit 1; }
echo "== MOCKED egress-selftest: all cases passed, 0 external hits (real Chromium, local stand-in servers; not a stack)"
