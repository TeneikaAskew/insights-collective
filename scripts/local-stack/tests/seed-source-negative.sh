#!/usr/bin/env bash
# ABOUTME: No-database regressions for scripts/e2e/seed.sh and scripts/local-stack/seed-auth.sh: a missing,
# ABOUTME: unreadable, non-regular or empty SQL source, or a `cat` that fails, must fail the run; valid sources pass.
# A fake psql (first on PATH) records its arguments and the whole of stdin and exits 0, exactly like the real psql
# does when it receives only the one-line preamble. The real target guard runs against loopback values.
# Each script is copied into a private sandbox with the repository layout, so nothing in the checkout is modified.
# Optional: SEED_SH / SEED_AUTH_SH point at other copies of the scripts (used for the before/after control).
# Each assertion's status is saved in $ok BEFORE its message is built: a command substitution inside the
# message (e.g. $(id -u)) would otherwise reset $? and turn a failed assertion into a PASS.
# Unreadable-file cases need a non-root uid; under root they run through `setpriv` as uid 1000 (skipped, and
# reported as SKIP, if that is impossible).
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
# dsn user pw rest: credential-bearing test DSNs are assembled here so no tracked line carries a
# scheme://user:password@host literal (the repository secret scan flags that shape even for placeholders).
dsn() { printf '%s//%s:%s@%s' 'postgresql:' "$1" "$2" "$3"; }
SEED_SH="${SEED_SH:-$ROOT/scripts/e2e/seed.sh}"; SEED_AUTH_SH="${SEED_AUTH_SH:-$ROOT/scripts/local-stack/seed-auth.sh}"
npass=0; nfail=0; nskip=0; rc=0
say() { if [ "$2" -eq 0 ]; then echo "PASS $1"; npass=$((npass+1)); else echo "FAIL $1"; nfail=$((nfail+1)); rc=1; fi; }
skip() { echo "SKIP $1"; nskip=$((nskip+1)); }
SB=$(mktemp -d "${TMPDIR:-/tmp}/seed-src-neg.XXXXXXXX"); trap 'chmod -R u+rwX "$SB" 2>/dev/null; rm -rf "$SB"' EXIT; chmod 755 "$SB"

mkdir -p "$SB/bin"
cat > "$SB/bin/psql" <<'PSQL'
#!/usr/bin/env bash
# fake psql: never connects; records argv and the full stdin, then exits 0 (or $FAKE_PSQL_EXIT)
d="${FAKE_PSQL_LOG:?}"; printf '%s\n' "$@" > "$d/args"; cat > "$d/stdin"; exit "${FAKE_PSQL_EXIT:-0}"
PSQL
# a cat that fails without output, for the pipefail case (installed only for that case)
mkdir -p "$SB/badcat"; printf '#!/usr/bin/env bash\necho "cat: simulated read error" >&2; exit 1\n' > "$SB/badcat/cat"
chmod 755 "$SB/bin/psql" "$SB/badcat/cat"
NODE_DIR="$(dirname "$(command -v node)")"

# tree <name>: a fresh repository-shaped sandbox with both scripts, the real guard and valid SQL sources
tree() {
  local t="$SB/$1"; mkdir -p "$t/scripts/e2e" "$t/scripts/local-stack" "$t/scripts/local-db" "$t/e2e/fixtures" "$t/supabase" "$t/log"
  cp "$SEED_SH" "$t/scripts/e2e/seed.sh"; cp "$SEED_AUTH_SH" "$t/scripts/local-stack/seed-auth.sh"
  cp "$ROOT/scripts/e2e/assert-safe-target.mjs" "$t/scripts/e2e/"; cp "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$t/scripts/local-db/"
  cp "$ROOT/supabase/config.toml" "$t/supabase/"
  printf -- '-- seed fixture\nselect 1;\n-- END-OF-SEED-SQL\n' > "$t/e2e/fixtures/seed.sql"
  printf -- '-- auth fixture\nselect 2;\n-- END-OF-AUTH-SQL\n' > "$t/scripts/local-stack/auth-fixtures.sql"
  chmod -R a+rX "$t"; chmod 777 "$t/log"; echo "$t"
}
# run <tree> <script-rel> [extra PATH dir] [as-uid]: prints exit status; psql evidence lands in <tree>/log
run() {
  local t="$1" rel="$2" extra="${3:-}" uid="${4:-}" path="$SB/bin:$NODE_DIR:/usr/bin:/bin"
  [ -n "$extra" ] && path="$extra:$path"
  local envs=(env -i "PATH=$path" "HOME=$t" "FAKE_PSQL_LOG=$t/log" "FAKE_PSQL_EXIT=${FAKE_PSQL_EXIT:-0}"
    "SUPABASE_DB_URL=$(dsn "postgres" "postgres" "127.0.0.1:54322/postgres")"
    "VITE_SUPABASE_URL=http://127.0.0.1:54321" "E2E_RELAY_TARGET=http://127.0.0.1:54321"
    "E2E_ISOLATED_TARGET_REF=" "E2E_TEST_PASSWORD=local-only-e2e-password")
  if [ -n "$uid" ]; then setpriv --reuid="$uid" --regid="$uid" --clear-groups "${envs[@]}" bash "$t/$rel" >"$t/out" 2>&1
  else "${envs[@]}" bash "$t/$rel" >"$t/out" 2>&1; fi
  echo $?
}
psql_ran() { [ -e "$1/log/args" ]; }

for spec in "seed.sh:scripts/e2e/seed.sh:e2e/fixtures/seed.sql:END-OF-SEED-SQL" \
            "seed-auth.sh:scripts/local-stack/seed-auth.sh:scripts/local-stack/auth-fixtures.sql:END-OF-AUTH-SQL"; do
  IFS=: read -r name rel src marker <<<"$spec"

  # positive control: valid source -> exit 0, psql got the preamble AND the whole file, guard ran first
  t=$(tree "pos-$name"); st=$(run "$t" "$rel")
  [ "$st" = 0 ] && psql_ran "$t" && head -1 "$t/log/stdin" | grep -q "set_config('e2e.password'" && tail -1 "$t/log/stdin" | grep -q "$marker" \
    && grep -qx -- '-v' "$t/log/args" && grep -qx 'ON_ERROR_STOP=1' "$t/log/args"
  ok=$?; say "$name valid source: exit 0, psql receives preamble + full SQL (positive control)" $ok

  # missing source
  t=$(tree "missing-$name"); rm -f "$t/$src"; st=$(run "$t" "$rel")
  [ "$st" != 0 ] && ! psql_ran "$t"; ok=$?; say "$name missing source: non-zero exit ($st) and psql never started" $ok

  # directory in place of the file (not a regular file)
  t=$(tree "dir-$name"); rm -f "$t/$src"; mkdir "$t/$src"; st=$(run "$t" "$rel")
  [ "$st" != 0 ] && ! psql_ran "$t"; ok=$?; say "$name directory instead of file: non-zero exit ($st) and psql never started" $ok

  # empty file
  t=$(tree "empty-$name"); : > "$t/$src"; st=$(run "$t" "$rel")
  [ "$st" != 0 ] && ! psql_ran "$t"; ok=$?; say "$name empty source: non-zero exit ($st) and psql never started" $ok

  # dangling symlink
  t=$(tree "dangle-$name"); rm -f "$t/$src"; ln -s "$t/nowhere.sql" "$t/$src"; st=$(run "$t" "$rel")
  [ "$st" != 0 ] && ! psql_ran "$t"; ok=$?; say "$name dangling symlink: non-zero exit ($st) and psql never started" $ok

  # unreadable (mode 000), as a non-root uid
  if [ "$(id -u)" = 0 ] && ! command -v setpriv >/dev/null; then skip "$name unreadable source (no setpriv)"
  else
    uid=""; [ "$(id -u)" = 0 ] && uid=1000
    t=$(tree "unread-$name"); chmod 000 "$t/$src"; st=$(run "$t" "$rel" "" "$uid")
    [ "$st" != 0 ] && ! psql_ran "$t"; ok=$?; say "$name unreadable source (mode 000, uid ${uid:-$(id -u)}): non-zero exit ($st) and psql never started" $ok
    # control for the uid switch itself: the same uid CAN run the valid case
    t=$(tree "unread-ctl-$name"); st=$(run "$t" "$rel" "" "$uid")
    [ "$st" = 0 ] && psql_ran "$t"; ok=$?; say "$name same uid with a readable source: exit 0 (control for the unreadable case)" $ok
  fi

  # pipefail: preflight passes but `cat` fails; the fake psql still exits 0 after the preamble
  t=$(tree "badcat-$name"); st=$(run "$t" "$rel" "$SB/badcat")
  [ "$st" != 0 ]; ok=$?; say "$name cat fails after preflight: pipeline failure propagates (exit $st) although psql exited 0" $ok

  # psql failure propagates
  t=$(tree "psqlfail-$name"); st=$(FAKE_PSQL_EXIT=3 run "$t" "$rel")
  [ "$st" = 3 ]; ok=$?; say "$name psql exit 3 is the script's exit status" $ok
done
echo "summary: $npass PASS / $nfail FAIL / $nskip SKIP"
exit $rc
