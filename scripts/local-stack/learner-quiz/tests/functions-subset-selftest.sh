#!/usr/bin/env bash
# ABOUTME: LOCAL self-test for functions-subset.sh on throwaway workdirs made by workdir.sh: accept path, plus refusals for a
# ABOUTME: non-workdir, a changed served byte, an undeclared remote import and an undeclared local import. No stack, no network.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"; B=$(mktemp -d); trap 'rm -rf "$B"' EXIT
pass=0; fail=0
mk() { bash "$ROOT/scripts/local-stack/workdir.sh" "$B/$1" >/dev/null 2>&1 || { echo "FAIL setup $1"; exit 1; }; }
chk() { local label="$1" want="$2" pat="$3" dir="$4"; bash "$HERE/functions-subset.sh" "$dir" > "$B/out" 2>&1; local st=$?
  if [ $st = "$want" ] && grep -qE "$pat" "$B/out"; then echo "PASS $label (exit $st)"; pass=$((pass+1)); else echo "FAIL $label (exit $st): $(tail -3 "$B/out")"; fail=$((fail+1)); fi; }
mk ok;  chk "S0 accept: exactly score-quiz, byte-identical, config parsed" 0 "^PASS subset" "$B/ok"
[ "$(find "$B/ok/supabase/functions" -type f | wc -l)" = 3 ] && { echo "PASS S0b 3 served files remain"; pass=$((pass+1)); } || { echo "FAIL S0b"; fail=$((fail+1)); }
mkdir "$B/plain"; mkdir -p "$B/plain/supabase/functions"; chk "S1 refuse: not a workdir.sh workdir" 2 "REFUSED \[2\]" "$B/plain"
mk byte; echo "// x" >> "$B/byte/supabase/functions/score-quiz/index.ts"; chk "S2 refuse: a served byte differs from the repository" 3 "REFUSED \[3\]" "$B/byte"
# S3/S4 run the check against a COPY of the repository whose score-quiz gained an import, so the byte check passes and the import check decides.
for c in remote local; do
  R="$B/repo-$c"; mkdir -p "$R/scripts/local-stack/learner-quiz" "$R/supabase"; cp -R "$ROOT/supabase/functions" "$R/supabase/"; cp "$HERE/functions-subset.sh" "$R/scripts/local-stack/learner-quiz/"
  if [ $c = remote ]; then sed -i '1i import "https://example.com/x.ts";' "$R/supabase/functions/score-quiz/index.ts"; else sed -i '1i import { a } from "../_shared/groq.ts";' "$R/supabase/functions/score-quiz/index.ts"; fi
  mk w-$c; cp "$R/supabase/functions/score-quiz/index.ts" "$B/w-$c/supabase/functions/score-quiz/index.ts"
  bash "$R/scripts/local-stack/learner-quiz/functions-subset.sh" "$B/w-$c" > "$B/out" 2>&1; st=$?
  [ $st = 4 ] && { echo "PASS S$([ $c = remote ] && echo 3 || echo 4) refuse: undeclared $c import (exit 4)"; pass=$((pass+1)); } || { echo "FAIL $c import (exit $st)"; fail=$((fail+1)); }
done
cmp -s "$ROOT/supabase/config.toml" <(git -C "$ROOT" show HEAD:supabase/config.toml) && { echo "PASS S5 repository config.toml untouched"; pass=$((pass+1)); } || { echo "FAIL S5"; fail=$((fail+1)); }
echo "== functions-subset selftest (LOCAL, no stack): $pass PASS, $fail FAIL"; [ $fail = 0 ]
