#!/usr/bin/env bash
# ABOUTME: Learner-quiz mode only: reduces the DISPOSABLE workdir's served Edge Functions to exactly score-quiz (+ its one local
# ABOUTME: import and deno.json), byte-identical to the repository, and fixes the set of remote entry imports.
# Usage: functions-subset.sh <workdir created by scripts/local-stack/workdir.sh>
#
# Label: TEST-SERVED FUNCTION SUBSET. The served functions are a strict subset of the repository's, unmodified. Every other
# /functions/v1/<name> answers "not found" in this mode, so a learner flow that calls any other function fails visibly instead
# of reaching a function that may send to an external host. The learner quiz path calls only score-quiz
# (InlineQuizPlayer.tsx `functions.invoke('score-quiz')`); nothing else in that path invokes a function.
# config.toml in the WORKDIR keeps only [functions.score-quiz] (parsed and verified with tomllib); the repository is untouched.
#
# Remote imports: this script fixes the remote import SET to the two declared entry URLs and refuses any change. It does not
# provide their bytes. closure-install.sh (run next) installs the reviewed, integrity-pinned closure and the import map, and fails
# the job before any stack starts if the closure is missing, tampered, or not closed. See README.md, decision E1 (revised 18:03Z).
# Exit: 0 ok; 2 usage/workdir; 3 file set or bytes differ; 4 remote-import set differs; 5 config rewrite failed.
set -u
W="${1:-}"; ROOT="$(cd "$(dirname "$0")/../../.." && pwd -P)"
[ -n "$W" ] && [ -d "$W/supabase/functions" ] && [ -f "$W/.ic-local-stack-workdir" ] || { echo "SUBSET REFUSED [2]: not a workdir made by workdir.sh"; exit 2; }
F="$W/supabase/functions"
KEEP=(deno.json score-quiz/index.ts _shared/utils.ts)
DECLARED_REMOTE=$'https://deno.land/std@0.168.0/http/server.ts\nhttps://esm.sh/@supabase/supabase-js@2.39.7'

# Remove every entry not in KEEP (only inside the disposable workdir; refuses symlinks, as workdir.sh already does).
[ -z "$(find "$F" -type l | head -1)" ] || { echo "SUBSET REFUSED [2]: symlink in the workdir functions tree"; exit 2; }
while IFS= read -r -d '' f; do
  rel="${f#"$F"/}"; keep=0; for k in "${KEEP[@]}"; do [ "$rel" = "$k" ] && keep=1; done
  [ $keep = 1 ] || rm -f -- "$f"
done < <(find "$F" -type f -print0)
find "$F" -mindepth 1 -type d -empty -delete

# Exact file set, byte-identical to the repository.
got=$(cd "$F" && find . -type f | sed 's|^\./||' | sort); want=$(printf '%s\n' "${KEEP[@]}" | sort)
[ "$got" = "$want" ] || { echo "SUBSET REFUSED [3]: served file set is not exactly: ${KEEP[*]}"; exit 3; }
for k in "${KEEP[@]}"; do
  cmp -s "$F/$k" "$ROOT/supabase/functions/$k" || { echo "SUBSET REFUSED [3]: $k differs from the repository"; exit 3; }
  echo "served $k sha256 $(sha256sum "$F/$k" | cut -d' ' -f1) (byte-identical to the repository)"
done

# Every import specifier in the served files: relative ones must resolve inside the subset; remote ones must equal the declared set.
# Static import/export-from lines (also the closing line of a multi-line import), side-effect imports and dynamic import().
specs=$( { grep -hE "^[[:space:]]*(import|export|\})[^\"']*from[[:space:]]*[\"'][^\"']+[\"']" "$F/score-quiz/index.ts" "$F/_shared/utils.ts" | sed -E "s/.*from[[:space:]]*[\"']([^\"']+)[\"'].*/\1/";
           grep -hE "^[[:space:]]*import[[:space:]]*[\"']" "$F/score-quiz/index.ts" "$F/_shared/utils.ts" | sed -E "s/.*import[[:space:]]*[\"']([^\"']+)[\"'].*/\1/";
           grep -hoE "import[[:space:]]*\([[:space:]]*[\"'][^\"']+[\"']" "$F/score-quiz/index.ts" "$F/_shared/utils.ts" | sed -E "s/.*[\"']([^\"']+)[\"']/\1/"; } | sort -u)
remote=$(grep -E '^[a-z][a-z0-9+.-]*:' <<<"$specs" || true)
[ "$remote" = "$(sort <<<"$DECLARED_REMOTE")" ] || { echo "SUBSET REFUSED [4]: remote import set differs from the declared two"; exit 4; }
while IFS= read -r r; do
  [ -z "$r" ] && continue
  [ "$r" = "../_shared/utils.ts" ] || { echo "SUBSET REFUSED [4]: undeclared local import $r"; exit 4; }
done < <(grep -vE '^[a-z][a-z0-9+.-]*:' <<<"$specs")
echo "declared remote entry imports (to be resolved from the pinned closure by closure-install.sh; the runtime must not fetch them; that the pinned runtime honours this is UNVERIFIED):"; sed 's/^/  /' <<<"$remote"

python3 - "$W/supabase/config.toml" <<'PY' || { echo "SUBSET REFUSED [5]: config.toml functions rewrite failed"; exit 5; }
import re, sys, tomllib
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
# Drop every [functions.<name>] table except score-quiz (a table runs to the next header).
parts = re.split(r'(?m)^(?=\[)', s)
out = [t for t in parts if not (re.match(r'\[functions\.([A-Za-z0-9_-]+)\]', t) and not t.startswith('[functions.score-quiz]'))]
s2 = ''.join(out); open(p, 'w', encoding='utf-8').write(s2)
cfg = tomllib.loads(s2)
fns = sorted((cfg.get('functions') or {}).keys())
assert fns == ['score-quiz'], fns
assert cfg['functions']['score-quiz'].get('verify_jwt') is True, 'score-quiz must keep verify_jwt = true'
assert cfg['db']['seed']['enabled'] is False
print("config.toml (workdir): functions = [score-quiz], verify_jwt = true, seed disabled (parsed)")
PY
echo "PASS subset: TEST-SERVED FUNCTION SUBSET = score-quiz only; repository untouched"
