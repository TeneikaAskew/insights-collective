#!/usr/bin/env bash
# ABOUTME: LOCAL self-test for closure-install.sh on throwaway workdirs and a SYNTHETIC closure (no downloaded bytes, no stack):
# ABOUTME: accept path with config and provenance assertions, then missing closure, wrong reviewed hash, changed function byte, rerun.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
pass=0; fail=0; A='https://deno.land/std@0.168.0/http/server.ts'; B='https://esm.sh/@supabase/supabase-js@2.39.7'
C="$T/closure"; mkdir -p "$C/deno.land/std@0.168.0/http" "$C/esm.sh"
printf 'export const serve = 1;\n' > "$C/deno.land/std@0.168.0/http/server.ts"; printf 'export const createClient = 1;\n' > "$C/esm.sh/supabase-js.js"
printf '{"imports":{"%s":"./deno.land/std@0.168.0/http/server.ts","%s":"./esm.sh/supabase-js.js"}}\n' "$A" "$B" > "$C/import_map.json"
(cd "$C" && find . -type f ! -name PINS.sha256 | sed 's#^\./##' | LC_ALL=C sort | xargs sha256sum > PINS.sha256); H=$(sha256sum "$C/PINS.sha256" | cut -d' ' -f1)
mk() { bash "$ROOT/scripts/local-stack/workdir.sh" "$T/$1" >/dev/null 2>&1 && bash "$HERE/functions-subset.sh" "$T/$1" >/dev/null 2>&1 || { echo "FAIL setup"; exit 1; }; }
run() { local label="$1" want="$2" pat="$3"; shift 3; bash "$HERE/closure-install.sh" "$@" > "$T/out" 2>&1; local st=$?
  if [ $st = "$want" ] && grep -qE "$pat" "$T/out"; then echo "PASS $label (exit $st)"; pass=$((pass+1)); else echo "FAIL $label (exit $st): $(tail -3 "$T/out")"; fail=$((fail+1)); fi; }
mk ok; run "C0 accept: closure verified twice, import_map set, function bytes unchanged" 0 "^PASS closure installed" "$T/ok" "$C" "$H"
python3 -c 'import tomllib,sys; c=tomllib.load(open(sys.argv[1],"rb"))["functions"]; assert list(c)==["score-quiz"] and c["score-quiz"]["import_map"]=="./functions/_closure/import_map.json" and c["score-quiz"]["verify_jwt"] is True' "$T/ok/supabase/config.toml" \
  && { echo "PASS C0b workdir config: only score-quiz, verify_jwt true, import_map points at the installed map"; pass=$((pass+1)); } || { echo "FAIL C0b"; fail=$((fail+1)); }
cmp -s "$ROOT/supabase/config.toml" <(git -C "$ROOT" show HEAD:supabase/config.toml) && { echo "PASS C0c repository config.toml untouched"; pass=$((pass+1)); } || { echo "FAIL C0c"; fail=$((fail+1)); }
mk miss; run "C1 refuse: closure missing (today's state: no reviewed closure exists)" 31 "CLOSURE REFUSED \[31\]" "$T/miss" "$T/none" "$H"
mk hash; run "C2 refuse: reviewed hash does not match PINS.sha256" 33 "CLOSURE REFUSED \[33\]" "$T/hash" "$C" "$(printf 'a%.0s' $(seq 64))"
mk byte; echo '// x' >> "$T/byte/supabase/functions/score-quiz/index.ts"; run "C3 refuse: served function byte differs (provenance)" 7 "CLOSURE REFUSED \[7\]" "$T/byte" "$C" "$H"
run "C4 refuse: second install into the same workdir" 2 "already exists" "$T/ok" "$C" "$H"
echo "== closure-install selftest (LOCAL, synthetic closure, no network): $pass PASS, $fail FAIL"; [ $fail = 0 ]
