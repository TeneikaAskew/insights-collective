#!/usr/bin/env bash
# ABOUTME: FAKE-ONLY negative controls for the credential boundary of personas.sh / api-http.mjs: an invalid or ambiguous origin
# ABOUTME: makes NO request anywhere; a redirect never carries a key to a second origin; no password appears in any argv or output.
# Usage: api-boundary-selftest.sh [<t09 dir under test>]   (default: this checkout's scripts/local-stack/t09)
#   Every endpoint is a loopback fake (tests/fake-http.mjs); keys are fixed fake strings; psql is a fake on PATH that logs its
#   argv and stdin. No database, no network beyond 127.0.0.1, no real credential. Passing a different t09 dir (e.g. an older
#   revision) runs the SAME controls against that code, for the causal before/after receipt.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; UNDER="${1:-$(cd "$HERE/.." && pwd)}"
W=$(mktemp -d); PIDS=()
cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; rm -rf "$W"; }
trap cleanup EXIT
umask 077
printf 'fake-anon-key-for-selftest' > "$W/anon"; printf 'fake-service-key-for-selftest' > "$W/service"; chmod 600 "$W/anon" "$W/service"
mkdir "$W/bin"
cat > "$W/bin/psql" <<EOF
#!/usr/bin/env bash
printf 'ARGV %s\n' "\$*" >> "$W/psql.log"; cat >> "$W/psql.log"; exit 0
EOF
chmod 700 "$W/bin/psql"
# argv recorders: every node or curl the code under test starts through PATH logs its full argv before exec'ing the real
# binary, so a secret passed on a command line is caught deterministically (a /proc sample at request time can miss a
# short-lived process that has already exited).
for prog in node curl; do
  real=$(command -v "$prog") || { echo "missing $prog"; exit 2; }
  printf '#!/usr/bin/env bash\nprintf "ARGV %%s\\n" "$*" >> "%s/argv.log"\nexec "%s" "$@"\n' "$W" "$real" > "$W/bin/$prog"
  chmod 700 "$W/bin/$prog"
done
DB='postgresql://postgres@127.0.0.1:1/selftest'   # parsed by the DSN guard only; the fake psql never connects
pass=0; fail=0
ok() { echo "PASS $*"; pass=$((pass + 1)); }
bad() { echo "FAIL $*"; fail=$((fail + 1)); }
port() { node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
fake() { # port log mode
  : > "$2"; node "$HERE/fake-http.mjs" "$1" "$2" "$3" & PIDS+=($!)
  for _ in $(seq 1 50); do (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && return 0; sleep 0.1; done; echo "fake on $1 did not start"; exit 2
}
P=$(port); Q=$(port)
fake "$P" "$W/p.log" count; fake "$Q" "$W/q.log" count
lines() { wc -l < "$1" | tr -d ' '; }
run_personas() { # target -> status; output kept in $W/out.txt
  rm -f "$W/personas.json" "$W/psql.log" "$W/argv.log"
  PATH="$W/bin:$PATH" timeout 60 "$UNDER/personas.sh" "$1" "$W/anon" "$W/service" "$DB" "$W/personas.json" > "$W/out.txt" 2>&1
}

# --- O: invalid or ambiguous origins make NO request to any listener ----------------------------------------------------
i=0
for target in "http://127.0.0.1:$P@localhost:$Q" "http://127.0.0.1:$P@127.0.0.1:$Q" "http://user:pw@127.0.0.1:$Q" "https://127.0.0.1:$Q" \
              "http://127.0.0.1" "http://127.0.0.1:$Q/rest" "http://127.0.0.1:$Q?x=1" "http://127.0.0.1:$Q#f" "http://0x7f000001:$Q" \
              "http://127.1:$Q" "http://localhost.:$Q" "http://127.0.0.2:$Q" " http://127.0.0.1:$Q" "http://127.0.0.1:$Q\\@evil" "HTTP://127.0.0.1:$Q"; do
  i=$((i + 1)); : > "$W/p.log"; : > "$W/q.log"
  run_personas "$target"; st=$?
  if [ $st -ne 0 ] && [ "$(lines "$W/p.log")" = 0 ] && [ "$(lines "$W/q.log")" = 0 ]; then ok "O$i invalid origin #$i refused with no request (exit $st)"
  else bad "O$i invalid origin #$i: exit $st, requests seen p=$(lines "$W/p.log") q=$(lines "$W/q.log")"; fi
done

# --- R: a redirect never carries a key to a second origin ---------------------------------------------------------------
for st in 301 302 307 308; do
  R=$(port); fake "$R" "$W/r$st.log" "redirect=$st:http://127.0.0.1:$Q/auth/v1/admin/users"; : > "$W/q.log"
  run_personas "http://127.0.0.1:$R"; rc=$?
  if [ $rc -ne 0 ] && [ "$(lines "$W/q.log")" = 0 ]; then ok "R$st personas: HTTP $st refused, nothing reached the second origin"
  else bad "R$st personas: exit $rc, second origin saw $(lines "$W/q.log") request(s)"; fi
  if [ -f "$UNDER/api-http.mjs" ]; then
    : > "$W/q.log"; node "$UNDER/api-http.mjs" ready "http://127.0.0.1:$R" "$W/anon" > /dev/null 2>&1; rc=$?
    if [ $rc -ne 0 ] && [ "$(lines "$W/q.log")" = 0 ]; then ok "R$st readiness: HTTP $st refused, nothing reached the second origin"
    else bad "R$st readiness: exit $rc, second origin saw $(lines "$W/q.log") request(s)"; fi
  else bad "R$st readiness: no strict client (api-http.mjs) in the code under test"; fi
done

# --- A: no password in any argv, output, psql input or persona file -----------------------------------------------------
G=$(port); fake "$G" "$W/g.log" gotrue
run_personas "http://127.0.0.1:$G"; st=$?
npw=$(node -e 'const l=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean).map(JSON.parse);console.log(l.filter(r=>r.password).length)' "$W/g.log")
[ $st -eq 0 ] && [ "$npw" -ge 10 ] && ok "A0 personas completed against the fake GoTrue ($npw password-bearing requests: non-vacuous)" || bad "A0 personas exit $st with $npw password-bearing requests"
res=$(node - "$W/g.log" "$W/out.txt" "$W/psql.log" "$W/personas.json" "$W/argv.log" <<'JS'
const fs = require('fs'); const [g, out, psqlLog, pfile, argvLog] = process.argv.slice(2);
const recs = fs.readFileSync(g, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter((r) => r.password);
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const argv = read(argvLog);
if (!/ARGV /.test(argv)) console.log('FAIL A-argv-recorder recorded no program start (control would be vacuous)');
const texts = { 'argv of every PATH-launched node/curl/psql': argv + read(psqlLog).split('\n').filter((l) => l.startsWith('ARGV')).join('\n'), output: read(out), 'psql input': read(psqlLog), personaFile: read(pfile) };
const leaks = recs.filter((r) => r.argvLeak).length;
console.log(leaks === 0 ? `PASS A1 no received password in any /proc cmdline sampled at request time (${recs.length} requests)` : `FAIL A1 ${leaks} of ${recs.length} received passwords were visible in a process argv at request time`);
for (const [k, t] of Object.entries(texts)) {
  const hit = recs.filter((r) => t.includes(r.password)).length;
  console.log(hit === 0 ? `PASS A-${k} no password in ${k} (${t.length} bytes checked)` : `FAIL A-${k} ${hit} password(s) found in ${k}`);
}
JS
)
echo "$res"
pass=$((pass + $(grep -c '^PASS' <<<"$res"))); fail=$((fail + $(grep -c '^FAIL' <<<"$res")))
echo "== api-boundary selftest (FAKE endpoints only) against $(basename "$(dirname "$(dirname "$UNDER")")")/$(basename "$UNDER"): $pass PASS, $fail FAIL"
[ $fail -eq 0 ]
