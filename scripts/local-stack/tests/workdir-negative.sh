#!/usr/bin/env bash
# ABOUTME: Non-destructive regressions for scripts/local-stack/workdir.sh: it must never delete or reuse a
# ABOUTME: caller path, must refuse existing/symlink/relative/traversal/root targets, and must produce a
# ABOUTME: workdir whose config.toml PARSES with db.seed.enabled = false and the repository's project_id.
# Everything happens under one mktemp sandbox; only paths this test created and verified are removed.
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; WD="$ROOT/scripts/local-stack/workdir.sh"
SB=$(mktemp -d "${TMPDIR:-/tmp}/workdir-neg.XXXXXXXX"); trap 'rm -rf "$SB"' EXIT
rc=0; say() { if [ "$2" -eq 0 ]; then echo "PASS $1"; else echo "FAIL $1"; rc=1; fi; }
CFG_BEFORE=$(sha256sum "$ROOT/supabase/config.toml" | cut -d' ' -f1)
refused() { # name, path-arg… : must exit 2, print "refusing", and create nothing at the target
  local name="$1"; shift; local out st; out=$("$WD" "$@" 2>&1); st=$?
  [ $st -eq 2 ] && echo "$out" | grep -q "refusing"; say "$name" $?
}
# 1) existing directory with a sentinel: refused, sentinel intact, no marker written
mkdir -p "$SB/existing"; echo keep > "$SB/existing/sentinel.txt"
refused "existing directory is refused" "$SB/existing"
[ "$(cat "$SB/existing/sentinel.txt")" = "keep" ] && [ ! -e "$SB/existing/.ic-local-stack-workdir" ]; say "existing directory untouched (sentinel intact, no marker)" $?
# 2) existing FILE, symlink to a directory, dangling symlink
: > "$SB/afile"; refused "existing file is refused" "$SB/afile"
ln -s "$SB/existing" "$SB/link"; refused "symlink to a directory is refused" "$SB/link"
[ "$(cat "$SB/existing/sentinel.txt")" = "keep" ]; say "symlink target untouched" $?
ln -s "$SB/nowhere" "$SB/dangling"; refused "dangling symlink is refused" "$SB/dangling"
# 3) relative, traversal, empty-segment, roots, the repository, $HOME
refused "relative path is refused" "relative/dir"
refused "'..' segment is refused" "$SB/x/../y"
refused "'.' segment is refused" "$SB/./y"
refused "empty segment is refused" "$SB//y"
for r in / /tmp /var/tmp /home /root "$HOME" "$ROOT"; do refused "root-like path '$r' is refused" "$r"; done
refused "a path inside the repository is refused" "$ROOT/.scratch-workdir"
[ ! -e "$ROOT/.scratch-workdir" ]; say "nothing created inside the repository" $?
# 4) parent missing; parent is a symlink
refused "missing parent is refused" "$SB/no/such/parent/w"
mkdir -p "$SB/realparent"; ln -s "$SB/realparent" "$SB/linkparent"; refused "symlinked parent is refused" "$SB/linkparent/w"
# 5) ownership: only meaningful as a non-root user (root owns/writes everything)
if [ "$(id -u)" -ne 0 ]; then mkdir -p "$SB/ro"; chmod 555 "$SB/ro"; refused "unwritable parent is refused" "$SB/ro/w"; chmod 755 "$SB/ro"; else echo "SKIP unwritable-parent refusal (running as uid 0; -O/-w are always true for root)"; fi
# 6) positive: a new leaf under an owned parent is created with the marker; config parses as required
out=$("$WD" "$SB/fresh" 2>&1); st=$?; echo "$out" | sed 's/^/   /' | head -3
[ $st -eq 0 ] && [ -f "$SB/fresh/.ic-local-stack-workdir" ]; say "new leaf created with marker (exit 0)" $?
python3 - "$SB/fresh/supabase/config.toml" "$ROOT/supabase/config.toml" <<'PY'
import sys, tomllib
w = tomllib.load(open(sys.argv[1], 'rb')); r = tomllib.load(open(sys.argv[2], 'rb'))
assert w['db']['seed']['enabled'] is False, w['db'].get('seed')
assert w['project_id'] == r['project_id'], 'project_id changed'
r.setdefault('db', {}).pop('seed', None); w['db'].pop('seed', None)
assert w == r, 'config differs beyond [db.seed]'
print('   parsed: db.seed.enabled=false; project_id preserved; no other key changed')
PY
say "workdir config.toml parses with db.seed.enabled = false, same project_id, nothing else changed" $?
[ -d "$SB/fresh/supabase/migrations" ] && [ -z "$(ls -A "$SB/fresh/supabase/migrations")" ]; say "migrations directory present and empty" $?
[ ! -L "$SB/fresh/supabase/functions" ] && [ "$(find "$SB/fresh/supabase/functions" -type f | wc -l)" = "$(find "$ROOT/supabase/functions" -type f | wc -l)" ]; say "functions copied (not a symlink), same file count" $?
# 7) positive: no-argument form creates a fresh mktemp directory; cleaned up only after the marker is verified
out=$("$WD" 2>&1); st=$?; W2=$(echo "$out" | sed -nE 's/^workdir: (\S+) .*/\1/p')
[ $st -eq 0 ] && [ -n "$W2" ] && [ -f "$W2/.ic-local-stack-workdir" ] && [[ "$W2" == "${TMPDIR:-/tmp}/ic-local-stack."* ]]; say "no-argument form creates a fresh mktemp workdir with marker" $?
if [ -n "$W2" ] && [ -f "$W2/.ic-local-stack-workdir" ] && [[ "$W2" == "${TMPDIR:-/tmp}/ic-local-stack."* ]]; then rm -rf "$W2"; fi
# 9) symlinked ANCESTOR (not just the parent): repo-alias -> repository must not let repo-alias/supabase/newdir in
ln -s "$ROOT" "$SB/repo-alias"
refused "ancestor symlink to the repository is refused (repo-alias/supabase/newdir)" "$SB/repo-alias/supabase/newdir"
[ ! -e "$ROOT/supabase/newdir" ]; say "nothing created inside the repository through the alias" $?
mkdir -p "$SB/realparent/sub"; ln -s "$SB/realparent" "$SB/alias2"
refused "symlink two levels above the leaf is refused" "$SB/alias2/sub/w"
[ ! -e "$SB/realparent/sub/w" ]; say "nothing created through the two-level alias" $?
# 10) no-argument form: TMPDIR inside the repository, directly or through a link, is refused before mktemp
before=$(ls -A "$ROOT" | grep -c '^ic-local-stack\.' || true)
out=$(TMPDIR="$ROOT" "$WD" 2>&1); st=$?; [ $st -eq 2 ] && echo "$out" | grep -q refusing; say "TMPDIR = repository is refused" $?
out=$(TMPDIR="$SB/repo-alias" "$WD" 2>&1); st=$?; [ $st -eq 2 ] && echo "$out" | grep -q refusing; say "TMPDIR = link to repository is refused" $?
after=$(ls -A "$ROOT" | grep -c '^ic-local-stack\.' || true)
[ "$before" = "$after" ]; say "no ic-local-stack.* directory created in the repository" $?
# 11) symlinks inside supabase/functions: exercised on a throwaway FAKE repository copy (the real tree is never
#     modified). Absolute link back to the source and a relative in-tree link are both refused before any
#     directory is created; the same fake repository without links succeeds and its copy holds no links.
mkfake() { # $1 dir
  mkdir -p "$1/scripts/local-stack" "$1/supabase/functions/fn"
  cp "$WD" "$1/scripts/local-stack/workdir.sh"; cp "$ROOT/supabase/config.toml" "$1/supabase/config.toml"
  echo 'export {}' > "$1/supabase/functions/fn/index.ts"
}
mkfake "$SB/fake-abs"; ln -s "$ROOT/supabase/functions" "$SB/fake-abs/supabase/functions/fn/escape"
out=$("$SB/fake-abs/scripts/local-stack/workdir.sh" "$SB/w-abs" 2>&1); st=$?
[ $st -eq 2 ] && echo "$out" | grep -q 'symlink' && [ ! -e "$SB/w-abs" ]; say "functions symlink to the source tree is refused, nothing created" $?
mkfake "$SB/fake-rel"; ln -s index.ts "$SB/fake-rel/supabase/functions/fn/alias.ts"
out=$("$SB/fake-rel/scripts/local-stack/workdir.sh" "$SB/w-rel" 2>&1); st=$?
[ $st -eq 2 ] && [ ! -e "$SB/w-rel" ]; say "relative in-tree functions symlink is refused, nothing created" $?
mkfake "$SB/fake-ok"
out=$("$SB/fake-ok/scripts/local-stack/workdir.sh" "$SB/w-ok" 2>&1); st=$?
[ $st -eq 0 ] && [ -f "$SB/w-ok/supabase/functions/fn/index.ts" ] && [ -z "$(find "$SB/w-ok" -type l)" ]; say "fake repository without links: copy succeeds and contains no symlink" $?
[ "$(sha256sum "$SB/fake-abs/supabase/functions/fn/index.ts" | cut -d' ' -f1)" = "$(sha256sum "$SB/fake-ok/supabase/functions/fn/index.ts" | cut -d' ' -f1)" ]; say "fake source files untouched by refused runs" $?
# 8) the repository config was never modified
[ "$(sha256sum "$ROOT/supabase/config.toml" | cut -d' ' -f1)" = "$CFG_BEFORE" ]; say "repository supabase/config.toml unchanged" $?
grep -q 'rm -rf' "$WD"; [ $? -ne 0 ]; say "workdir.sh contains no rm -rf" $?
echo "workdir-negative: exit $rc"; exit $rc
