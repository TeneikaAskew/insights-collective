#!/usr/bin/env bash
# ABOUTME: Prepares a DISPOSABLE Supabase CLI workdir for the isolated local stack: the repository's
# ABOUTME: config.toml copied with ONLY the seed switched off (project_id stays the production ref = the guard's
# ABOUTME: deny identity), NO historical migrations (28 of 233 replay; they must never run before the snapshot
# ABOUTME: bootstrap), Edge Functions COPIED (not linked). Prints the start command; never runs it.
#
# Usage: scripts/local-stack/workdir.sh            -> fresh mktemp directory under ${TMPDIR:-/tmp}
#        scripts/local-stack/workdir.sh /abs/new/dir -> that path, which must NOT exist yet
#
# This script never deletes anything. It writes only inside a directory it created in this run, and refuses
# an existing path, a symlink at the leaf or ANY ancestor, a relative path, '.'/'..' segments, the repository
# (also when reached through a link or via TMPDIR), $HOME, /tmp itself and other roots, or a parent not owned and
# writable by the caller; and it refuses to copy a functions tree containing symlinks. (An earlier version
# recursively deleted "$1".)
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"   # physical path: boundary checks compare resolved paths only
MARKER=.ic-local-stack-workdir
refuse() { echo "workdir: refusing: $*" >&2; exit 2; }
command -v python3 >/dev/null || refuse "python3 is required to rewrite and verify config.toml (tomllib)"
# A symlink inside supabase/functions would survive the copy (cp copies the link, not its target) and point the
# "isolated" workdir back at the repository or anywhere else. Refused BEFORE any directory is created.
NLINKS=$(find "$ROOT/supabase/functions" -type l | wc -l)
[ "$NLINKS" -eq 0 ] || refuse "supabase/functions contains $NLINKS symlink(s); the copy would not be isolated: $(find "$ROOT/supabase/functions" -type l | head -3 | tr '\n' ' ')"
# Every ancestor of a requested path is checked: a symlink anywhere above the leaf (e.g. repo-alias -> the
# repository) would let a lexically "outside" path land inside the repository or another protected root.
no_symlink_ancestors() { # $1 absolute path; refuses if any existing component from / down is a symlink
  local acc="" seg rest="${1#/}"
  while [ -n "$rest" ]; do
    seg="${rest%%/*}"; [ "$seg" = "$rest" ] && rest="" || rest="${rest#*/}"
    acc="$acc/$seg"
    [ -L "$acc" ] && refuse "path component is a symlink: $acc (pass the resolved physical path)"
    [ -e "$acc" ] || break   # components below a missing one cannot be links; the parent check reports it
  done
  return 0
}
outside_protected() { # $1 resolved physical path of the target (or its future location)
  local t="$1" f fr
  for f in / /tmp /var/tmp /home /root /usr /etc /var /opt "${HOME:-/nonexistent}" "$ROOT"; do
    fr=$(cd "$f" 2>/dev/null && pwd -P || printf '%s' "$f")
    [ "$t" = "$f" ] || [ "$t" = "$fr" ] && refuse "'$f' itself is not a workdir"
  done
  case "$t/" in "$ROOT/"*) refuse "target must be outside the repository ($ROOT; resolved target $t)";; esac
  return 0
}
if [ $# -eq 0 ]; then
  BASE="${TMPDIR:-/tmp}"
  [ -d "$BASE" ] || refuse "TMPDIR is not a directory: $BASE"
  BASE_REAL=$(cd "$BASE" && pwd -P)
  # The fresh directory must not be created inside the repository either (TMPDIR could point there, directly
  # or through a symlink). Checked BEFORE mktemp so nothing is ever created in a protected place.
  case "$BASE_REAL/" in "$ROOT/"*) refuse "TMPDIR resolves inside the repository ($BASE -> $BASE_REAL)";; esac
  W=$(mktemp -d "$BASE_REAL/ic-local-stack.XXXXXXXX")
else
  REQ="$1"
  case "$REQ" in /*) ;; *) refuse "path must be absolute (got '$REQ')";; esac
  case "$REQ/" in *"/../"*|*"/./"*|*"//"*) refuse "path must not contain '.', '..' or empty segments";; esac   # REQ is absolute, so "$REQ/" has no leading "//"
  if [ -e "$REQ" ] || [ -L "$REQ" ]; then refuse "target exists (never reused, never deleted): $REQ"; fi
  outside_protected "$REQ"                       # lexical check (kept: clearer message for the plain case)
  PARENT=$(dirname "$REQ")
  no_symlink_ancestors "$PARENT"                 # refuses repo-alias/supabase/newdir and any other link above the leaf
  [ -d "$PARENT" ] || refuse "parent directory does not exist: $PARENT"
  PARENT_REAL=$(cd "$PARENT" && pwd -P)
  [ "$PARENT_REAL" = "$PARENT" ] || refuse "parent does not resolve to itself ($PARENT -> $PARENT_REAL)"
  outside_protected "$PARENT_REAL/$(basename "$REQ")"   # boundary re-checked on the resolved path
  { [ -O "$PARENT" ] && [ -w "$PARENT" ]; } || refuse "parent is not owned and writable by uid $(id -u): $PARENT"
  mkdir "$REQ"   # not -p: the parent exists already, the leaf must be new; a race here fails loudly (set -e)
  W="$REQ"
fi
printf 'created %s by scripts/local-stack/workdir.sh from %s\n' "$(date -u +%FT%TZ)" "$ROOT" > "$W/$MARKER"
mkdir "$W/supabase" "$W/supabase/migrations"   # migrations present but EMPTY: the CLI has nothing to apply
cp "$ROOT/supabase/config.toml" "$W/supabase/config.toml"
# Seed: the repository config declares no [db.seed] table, so the CLI DEFAULT (enabled = true, ./seed.sql)
# would apply. Set it explicitly, and if a [db.seed] table ever appears in config.toml rewrite its `enabled`
# key instead of appending a second table (TOML forbids defining a table twice; the old grep-guard left an
# existing `enabled = true` untouched and still printed "seed disabled"). Verified by parsing the result.
python3 - "$W/supabase/config.toml" <<'PY'
import re, sys, tomllib
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
m = re.search(r'^\[db\.seed\]\s*$', s, re.M)
if m:
    head, tail = s[:m.end()], s[m.end():]
    nxt = re.search(r'^\[', tail, re.M); body, rest = (tail[:nxt.start()], tail[nxt.start():]) if nxt else (tail, '')
    body2, n = re.subn(r'^(\s*enabled\s*=\s*)\S+', r'\1false', body, flags=re.M)
    if n == 0: body2 = '\nenabled = false' + body
    s = head + body2 + rest
else:
    s = s.rstrip('\n') + '\n\n[db.seed]\nenabled = false\n'
open(p, 'w', encoding='utf-8').write(s)
cfg = tomllib.loads(s)
assert cfg['db']['seed']['enabled'] is False, cfg['db'].get('seed')
assert cfg['project_id'], 'project_id missing after rewrite'
print(f"config.toml: project_id preserved ({cfg['project_id'][:4]}…, the deny identity); db.seed.enabled = false (parsed)")
PY
# Functions are COPIED so the stack's workdir is self-contained and edits there never touch the repository.
# Symlinks in the functions tree were refused before anything was created (see top); verified again after.
cp -RP "$ROOT/supabase/functions" "$W/supabase/functions"
[ -z "$(find "$W/supabase/functions" -type l | head -1)" ] || refuse "symlink present in the copied functions tree"
echo "workdir: $W  (marker $MARKER; migrations: $(find "$W/supabase/migrations" -type f | wc -l) files; functions copied: $(find "$W/supabase/functions" -type f | wc -l) files)"
echo "NOT RUN BY THIS SCRIPT. On a Docker-capable machine, in order:"
echo "  1. supabase start --workdir $W            # local only; no --linked, no remote commands"
echo "  2. scripts/local-stack/bootstrap.sh \"\$SUPABASE_DB_URL\"   # the loopback DSN from 'supabase status -o env --workdir $W'; never typed in by hand"
echo "  3. scripts/e2e/seed.sh (with loopback targets from 'supabase status -o env --workdir $W')"
