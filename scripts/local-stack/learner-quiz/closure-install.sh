#!/usr/bin/env bash
# ABOUTME: Learner-quiz mode: installs the reviewed, integrity-pinned score-quiz dependency closure into the DISPOSABLE workdir and
# ABOUTME: points [functions.score-quiz] at its import map. Runs before any stack starts; any gap fails the job before boot.
# Usage: closure-install.sh <workdir> <closure dir> <reviewed PINS.sha256 sha256>
#   1. edge-deps.mjs verify on the source closure (pinned set, hashes, closed graph, both entry URLs mapped exactly).
#   2. Copy into <workdir>/supabase/functions/_closure/ and verify the COPY again with the same reviewed hash.
#   3. Set import_map for score-quiz in the WORKDIR config.toml only; re-parse with tomllib and assert the value.
#   4. Assert score-quiz/index.ts and _shared/utils.ts are still byte-identical to the repository (function code provenance:
#      the function bytes never change; only module resolution is redirected by the map).
# What this does NOT prove: that the pinned Supabase Edge runtime image honours a per-function import_map, or that it refuses to
# fetch a module the map does not cover. Both are open gate E1-R (README.md) and are checked only on a real run.
# Exit: 0 ok; 2 usage/workdir; 20 + edge-deps code on a closure refusal; 6 config; 7 function bytes changed.
set -u
W="${1:-}" C="${2:-}" H="${3:-}"; HERE="$(cd "$(dirname "$0")" && pwd -P)"; ROOT="$(cd "$HERE/../../.." && pwd -P)"
A='https://deno.land/std@0.168.0/http/server.ts'; B='https://esm.sh/@supabase/supabase-js@2.39.7'
[ -n "$W" ] && [ -f "$W/.ic-local-stack-workdir" ] && [ -d "$W/supabase/functions/score-quiz" ] || { echo "CLOSURE REFUSED [2]: not a prepared workdir"; exit 2; }
D="$W/supabase/functions/_closure"
[ -e "$D" ] && { echo "CLOSURE REFUSED [2]: $D already exists"; exit 2; }
node "$HERE/edge-deps.mjs" verify "$C" "$H" "$A" "$B"; st=$?; [ $st = 0 ] || { echo "CLOSURE REFUSED [$((20+st))]: source closure"; exit $((20+st)); }
cp -R --no-dereference "$C" "$D" || { echo "CLOSURE REFUSED [2]: copy failed"; exit 2; }
node "$HERE/edge-deps.mjs" verify "$D" "$H" "$A" "$B"; st=$?; [ $st = 0 ] || { echo "CLOSURE REFUSED [$((20+st))]: installed copy"; exit $((20+st)); }
python3 - "$W/supabase/config.toml" <<'PY' || { echo "CLOSURE REFUSED [6]: config import_map"; exit 6; }
import sys, re, tomllib
p = sys.argv[1]; s = open(p).read()
want = './functions/_closure/import_map.json'
m = re.search(r'^\[functions\.score-quiz\]\s*$', s, re.M)
if not m or tomllib.loads(s)['functions']['score-quiz'].get('import_map') is not None: sys.exit(1)
s = s[:m.end()] + f'\nimport_map = "{want}"' + s[m.end():]
cfg = tomllib.loads(s)
assert list(cfg['functions']) == ['score-quiz'] and cfg['functions']['score-quiz']['import_map'] == want
assert cfg['functions']['score-quiz'].get('verify_jwt') is True
open(p, 'w').write(s)
PY
for f in score-quiz/index.ts _shared/utils.ts deno.json; do
  cmp -s "$ROOT/supabase/functions/$f" "$W/supabase/functions/$f" || { echo "CLOSURE REFUSED [7]: $f differs from the repository"; exit 7; }
done
echo "PASS closure installed: score-quiz bytes unchanged; import_map set in the workdir config; reviewed PINS.sha256 $H"
