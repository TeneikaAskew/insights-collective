#!/usr/bin/env bash
# ABOUTME: LOCAL self-test for edge-deps.mjs on SYNTHETIC closures (made-up module bodies, no downloaded bytes): the accept path,
# ABOUTME: then missing, tampered, extra, symlinked, transitive-unmapped, bare, non-literal-dynamic, escaping and unmapped-entry refusals.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
pass=0; fail=0
A='https://deno.land/std@0.168.0/http/server.ts'; B='https://esm.sh/@supabase/supabase-js@2.39.7'
mk() { # dir: a closed synthetic closure for the two entry URLs, with a transitive esm.sh dependency mapped by prefix
  local d=$1; mkdir -p "$d/deno.land/std@0.168.0/http" "$d/esm.sh/v135/x"
  printf 'import { a } from "./_util.ts";\nexport const serve = a;\n' > "$d/deno.land/std@0.168.0/http/server.ts"
  printf 'export const a = 1;\n' > "$d/deno.land/std@0.168.0/http/_util.ts"
  printf 'export * from "https://esm.sh/v135/x/mod.js";\n' > "$d/esm.sh/supabase-js.js"
  printf 'const m = await import("./dep.js");\nexport default m;\n' > "$d/esm.sh/v135/x/mod.js"
  printf 'export const d = 2;\n' > "$d/esm.sh/v135/x/dep.js"
  printf '{"imports":{"%s":"./deno.land/std@0.168.0/http/server.ts","%s":"./esm.sh/supabase-js.js","https://esm.sh/v135/":"./esm.sh/v135/"}}\n' "$A" "$B" > "$d/import_map.json"
  pin "$d"
}
pin() { (cd "$1" && find . -type f ! -name PINS.sha256 | sed 's#^\./##' | LC_ALL=C sort | xargs sha256sum > PINS.sha256); }
ph() { sha256sum "$1/PINS.sha256" 2>/dev/null | cut -d' ' -f1; }
chk() { local label="$1" want="$2" pat="$3" dir="$4" h="${5:-$(ph "$4")}"; [ -n "$h" ] || h=$(printf '0%.0s' $(seq 64)); node "$HERE/edge-deps.mjs" verify "$dir" "$h" "$A" "$B" > "$T/out" 2>&1; local st=$?
  if [ $st = "$want" ] && grep -qE "$pat" "$T/out"; then echo "PASS $label (exit $st)"; pass=$((pass+1)); else echo "FAIL $label (exit $st): $(cat "$T/out")"; fail=$((fail+1)); fi; }
c() { rm -rf "$T/$1"; mk "$T/$1"; echo "$T/$1"; }

d=$(c ok);  chk "D0 accept: closed, pinned, entries and transitive deps resolve locally" 0 "verify ok: 6 pinned files, 5 modules" "$d"
chk "D1 refuse: closure directory missing" 11 "closure directory missing" "$T/nope"
d=$(c miss); rm "$d/esm.sh/v135/x/dep.js"; chk "D2 refuse: pinned file missing" 12 "file set differs" "$d"
d=$(c tamp); echo '// x' >> "$d/esm.sh/v135/x/dep.js"; chk "D3 refuse: tampered byte" 13 "hash mismatch: esm.sh/v135/x/dep.js" "$d"
d=$(c extra); echo 'export {}' > "$d/esm.sh/extra.js"; chk "D4 refuse: unpinned extra file" 12 "file set differs" "$d"
d=$(c link); ln -s dep.js "$d/esm.sh/v135/x/alias.js"; chk "D5 refuse: symlink in closure" 12 "symlink" "$d"
d=$(c trans); printf 'import "https://cdn.example.com/y.js";\nexport const d = 2;\n' > "$d/esm.sh/v135/x/dep.js"; pin "$d"
  chk "D6 refuse: transitive dependency outside the map (would be fetched)" 16 "unresolved specifier in esm.sh/v135/x/dep.js" "$d"
d=$(c bare); printf 'import x from "npm:left-pad";\nexport const d = x;\n' > "$d/esm.sh/v135/x/dep.js"; pin "$d"
  chk "D7 refuse: npm:/bare specifier" 16 "forbidden specifier kind" "$d"
d=$(c dyn); printf 'const u = "./dep.js";\nexport default await import(u);\n' > "$d/esm.sh/v135/x/mod.js"; pin "$d"
  chk "D8 refuse: non-literal dynamic import()" 16 "non-literal dynamic import" "$d"
d=$(c esc); sed -i 's#"./esm.sh/supabase-js.js"#"../outside.js"#' "$d/import_map.json"; pin "$d"
  chk "D9 refuse: import-map target leaves the closure" 14 "not a relative path|leaves the closure" "$d"
d=$(c ent); sed -i "s#\"$B\"#\"https://esm.sh/@supabase/supabase-js@2.39.8\"#" "$d/import_map.json"; pin "$d"
  chk "D10 refuse: entry URL not mapped exactly (version drift)" 15 "entry not mapped exactly" "$d"
d=$(c rel); printf 'import { z } from "../../../../outside.ts";\nexport const d = z;\n' > "$d/esm.sh/v135/x/dep.js"; pin "$d"
  chk "D11 refuse: relative import escapes the closure" 16 "unresolved specifier" "$d"
d=$(c pins); H0=$(ph "$d"); echo '// x' >> "$d/esm.sh/v135/x/dep.js"; pin "$d"
  chk "D12 refuse: closure AND PINS.sha256 both rewritten; reviewed hash still pinned" 13 "does not match the reviewed hash" "$d" "$H0"
chk "D13 refuse: reviewed hash missing or malformed" 10 "64 hex" "$T/ok" "notahash"
echo "== edge-deps selftest (LOCAL, synthetic closures, no network): $pass PASS, $fail FAIL"; [ $fail = 0 ]
