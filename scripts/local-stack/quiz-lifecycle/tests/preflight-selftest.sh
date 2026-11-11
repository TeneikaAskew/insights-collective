#!/usr/bin/env bash
# ABOUTME: MOCKED self-test of preflight.mjs: a FAKE `ss` on PATH and a fake loopback HTTP server prove every refuse path
# ABOUTME: (non-loopback bind, relay, missing/garbled probe, bad config, wrong ports, functions down, app not this build).
# MOCKED: no Supabase stack, no edge runtime, no browser. It proves the checks refuse; it says nothing about a real stack.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
T=$(mktemp -d); SRV=; trap '[ -n "$SRV" ] && kill "$SRV" 2>/dev/null; rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/dist/assets"
PORT=$((55100 + RANDOM % 400)); APIP=$PORT; APPP=$PORT; DBP=$((PORT + 1))   # one fake server serves API and app
API="http://127.0.0.1:$APIP"
printf '<!doctype html><div id="root"></div>' > "$T/dist/index.html"
printf 'const u="%s";' "$API" > "$T/dist/assets/app.js"
# Fake ss: prints $T/ss.out, or fails when $T/ss.fail exists.
cat > "$T/bin/ss" <<EOF
#!/usr/bin/env bash
[ -e "$T/ss.fail" ] && { echo "boom" >&2; exit 1; }
cat "$T/ss.out"
EOF
chmod +x "$T/bin/ss"
# Fake server: OPTIONS /functions/v1/score-quiz -> 200 ok (or 500 when $T/fn.500 exists); GET / -> dist index (or other).
cat > "$T/srv.mjs" <<'EOF'
import http from 'node:http'; import fs from 'node:fs';
const [port, dir] = process.argv.slice(2);
http.createServer((req, res) => {
  if (req.method === 'OPTIONS' && req.url === '/functions/v1/score-quiz') {
    if (fs.existsSync(`${dir}/fn.500`)) { res.writeHead(500); return res.end('no'); }
    res.writeHead(200); return res.end('ok');
  }
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200);
    return res.end(fs.existsSync(`${dir}/app.other`) ? 'other' : fs.readFileSync(`${dir}/dist/index.html`));
  }
  res.writeHead(404); res.end();
}).listen(Number(port), '127.0.0.1');
EOF
node "$T/srv.mjs" "$PORT" "$T" & SRV=$!
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 1 "$API/" && break; sleep 0.2; done

good_ss() { printf 'LISTEN 0 4096 127.0.0.1:%s 0.0.0.0:*\nLISTEN 0 4096 127.0.0.1:%s 0.0.0.0:*\nLISTEN 0 4096 [::1]:%s [::]:*\n' "$APIP" "$DBP" "$APIP" > "$T/ss.out"; }
reset() { rm -f "$T/ss.fail" "$T/fn.500" "$T/app.other"; good_ss; }
base_env() {
  env -i PATH="$T/bin:$PATH" HOME="$T" \
    VITE_SUPABASE_URL="$API" E2E_BASE_URL="http://127.0.0.1:$APPP" E2E_RELAY_TARGET="$API" \
    SUPABASE_DB_URL="postgresql://postgres@127.0.0.1:$DBP/postgres" \
    VITE_SUPABASE_ANON_KEY=local-anon VITE_SUPABASE_PUBLISHABLE_KEY=local-anon E2E_RELAY_PORT=$((PORT + 2)) "$@"
}
PF=(node "$HERE/preflight.mjs" --dist "$T/dist" --expect-ports "$APIP,$DBP,$APPP" --deadline 3)
pass=0; fail=0
# expect <want exit> <grep for in output> <description> -- <env overrides...>
expect() {
  local want="$1" pat="$2" desc="$3"; shift 4
  local out st; out=$(base_env "$@" "${PF[@]}" 2>&1); st=$?
  if [ "$st" = "$want" ] && grep -qE "$pat" <<<"$out"; then echo "PASS $desc"; pass=$((pass + 1));
  else echo "FAIL $desc (exit $st)"; sed 's/^/    /' <<<"$out"; fail=$((fail + 1)); fi
}
reset; expect 0 '== PREFLIGHT: ALL PASS' "all loopback, no relay, functions ok, app is this build" --
reset; printf 'LISTEN 0 4096 0.0.0.0:%s 0.0.0.0:*\nLISTEN 0 4096 127.0.0.1:%s 0.0.0.0:*\n' "$APIP" "$DBP" > "$T/ss.out"
       expect 1 'FAIL listeners: API port .* non-loopback' "API bound on 0.0.0.0 refused" --
reset; printf 'LISTEN 0 4096 127.0.0.1:%s 0.0.0.0:*\nLISTEN 0 4096 [::]:%s [::]:*\n' "$APIP" "$DBP" > "$T/ss.out"
       expect 1 'FAIL listeners: DB port .* non-loopback' "DB bound on [::] refused" --
reset; printf 'LISTEN 0 4096 127.0.0.1:%s 0.0.0.0:*\n' "$APIP" > "$T/ss.out"
       expect 1 'FAIL listeners: DB port .* no listener' "missing DB listener refused" --
reset; expect 1 'FAIL relay: E2E_USE_RELAY is set' "E2E_USE_RELAY=1 refused" -- E2E_USE_RELAY=1
reset; printf 'LISTEN 0 4096 127.0.0.1:%s 0.0.0.0:*\n' "$((PORT + 2))" >> "$T/ss.out"
       expect 1 'FAIL relay: relay port .* listening' "listening relay port refused" --
reset; expect 1 'FAIL relay: E2E_RELAY_PORT does not parse' "unparseable relay port refused" -- E2E_RELAY_PORT=abc
reset; touch "$T/ss.fail"; expect 1 'FAIL listeners: ss .* failed .*stderr withheld' "failing ss probe refused, stderr withheld" --
reset; echo 'garbage' > "$T/ss.out"; expect 1 'FAIL listeners: .*does not parse' "garbled ss line refused" --
reset; expect 1 'FAIL config: VITE_SUPABASE_URL host is not loopback' "non-loopback API URL refused" -- VITE_SUPABASE_URL=http://db.example.com:54321
reset; expect 1 'FAIL config: E2E_BASE_URL does not parse' "unparseable app URL refused" -- E2E_BASE_URL=::nope
reset; expect 1 'FAIL config: VITE_SUPABASE_URL carries userinfo' "URL with userinfo refused" -- VITE_SUPABASE_URL="http://u:p@127.0.0.1:$APIP"
reset; expect 1 'FAIL config: SUPABASE_DB_URL is unset' "missing DB URL refused" -- SUPABASE_DB_URL=
reset; expect 1 'FAIL config: assert-local-dsn' "non-loopback DB URL refused" -- SUPABASE_DB_URL=postgresql://postgres@db.example.com:5432/postgres
reset; expect 1 'FAIL config: check-local-target' "differing anon keys refused (check-local-target env)" -- VITE_SUPABASE_PUBLISHABLE_KEY=other
reset; touch "$T/fn.500"; expect 1 'FAIL functions: score-quiz did not answer' "functions answering 500 refused" --
reset; touch "$T/app.other"; expect 1 'FAIL app: served index.html differs' "app not serving this build refused" --
out=$(base_env node "$HERE/preflight.mjs" --expect-ports 1,2 2>&1); st=$?
if [ "$st" = 2 ] && grep -q '^usage' <<<"$out"; then echo "PASS malformed --expect-ports is a usage error (exit 2)"; pass=$((pass + 1));
else echo "FAIL malformed --expect-ports (exit $st)"; fail=$((fail + 1)); fi
echo "== MOCKED preflight-selftest: $pass passed, $fail failed (FAKE ss + fake loopback HTTP; not a stack)"
[ "$fail" -eq 0 ]
