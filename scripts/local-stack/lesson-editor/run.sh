#!/usr/bin/env bash
# ABOUTME: Lesson-editor fixture runner for an ALREADY BOOTSTRAPPED isolated local stack. It never starts, stops or resets a
# ABOUTME: stack and never touches a shared fixture; the harness pin and target checks run before anything else.
#
# <db url> is ALWAYS password-free: postgresql://<user>@<loopback host>:<port>/<db>. A password, when the stack needs one,
# comes only from env LE_DB_PASSWORD_FILE (mode 600); psql then gets a private 0600 passfile through its environment, never
# argv. An external PGPASSWORD is refused, as are the self-test-only LE_ALLOWED_ORIGINS and LE_EGRESS_CONTROL overrides.
#
#   run.sh setup <api origin> <app origin> <db url> <anon key file> <service key file> <private dir (absent)> <evidence dir (absent)>
#        pin -> targets -> preflight.mjs (READ-ONLY; before any GoTrue admin POST) -> personas -> fixture.sql -> backend contract.
#        The private dir (0700) holds the session files; the evidence dir holds only credential-free results. Neither may
#        contain the other. Any failure after the private dir exists removes it.
#   run.sh owner    <db url> <private dir> OWNER|OTHER   sets instructor_id of fixture course C1 ONLY (RLS-ZERO-ROW case)
#   run.sh read     <db url> <lesson id>                 read-only row JSON; fixture ids (ed170000-...) only
#   run.sh quizhash <db url>                             read-only md5 over the fixture quiz DEFINITION and its questions
#   run.sh evidence <dest (absent)> <evidence dir>       T-09 stack-checks.sh stage-evidence: exact, credential-scanned inventory
#   run.sh cleanup  <private dir>                        removes the private session dir (only the expected file names)
#
# Not a shared runner: no globalSetup, no teardown, no truncation, no edits to e2e.yml. Integration into the shared workflow is
# the T-09 owner's (see README.md). Secrets come only from mode-600 files and are never printed or passed as arguments.
# Child stderr (psql, node) is NEVER printed, not even in part: only this script's own fixed texts, exit statuses and byte
# counts (the T-09 stack-checks.sh "probe" rule). A known fixture refusal is reported as a fixed code chosen here.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
umask 077
refuse() { echo "FAIL le-run: $*" >&2; exit 1; }
# Pinned harness files: the shared T-09 helper contract as carried by #162 a6d1d636, #166 and #167 (api-http.mjs 3acd5b02,
# the same-handle readSecretFile of 4a54ee4c; stack-checks.sh 9657af04, unchanged since 5d81976).
# Checked FIRST, before any helper from them runs. Any other content is refused until this lane re-checks it.
PINS=(
  "scripts/local-stack/t09/api-http.mjs 3acd5b021602c4e93cb6b100e60ce3232f986a3b"
  "scripts/local-stack/t09/stack-checks.sh 9657af04f561a283a49fb387074fc06c0f4161c0"
)
pin_harness() {
  local p f want got
  for p in "${PINS[@]}"; do
    f="${p% *}"; want="${p#* }"
    [ -f "$ROOT/$f" ] || refuse "T-09 harness file $f not present in this tree"
    got=$(git hash-object "$ROOT/$f" 2>/dev/null) || refuse "cannot hash $f"
    [ "$got" = "$want" ] || refuse "$f is $got, not the pinned $want (re-check required by the lesson-editor lane)"
  done
}
# Fixed refusal codes for fixture.sql's own exceptions. Matching only SELECTS one of these texts; nothing from stderr is printed.
CODES=(
  "apply it only through|fixture refused: not applied through run.sh"
  "non-synthetic auth user|fixture refused: non-synthetic auth user(s) present"
  "is not an le-\\* local.test account|fixture refused: a persona is not an le-* local.test account"
  "OTHER must differ from OWNER|fixture refused: OTHER equals OWNER"
  "course C1 already exists|fixture refused: course C1 already exists"
  "course owner mismatch|fixture refused: course owner mismatch"
  "expected 6 content items|fixture refused: unexpected content item count"
  "must start with a NULL updated_at|fixture refused: NULL-version lessons not NULL"
  "quiz must have 2 questions|fixture refused: quiz question count"
  "STUDENT is not a pure student|fixture refused: STUDENT role check"
)
# quiet <label> <cmd...>: runs a child with stderr withheld. On failure prints at most one fixed code from CODES, then the exit
# status and the withheld byte count. Never any stderr-derived text.
quiet() {
  local label="$1"; shift; local e st c
  e=$(mktemp) || refuse "mktemp"
  "$@" 2>"$e"; st=$?
  if [ $st -ne 0 ]; then
    for c in "${CODES[@]}"; do grep -qE "(lesson-editor fixture refused|fixture): .*${c%%|*}" "$e" && { echo "  ${c#*|}" >&2; break; }; done
    echo "FAIL le-run: $label exited $st (child stderr withheld: $(wc -c <"$e") bytes)" >&2
    rm -f "$e"; return $st
  fi
  rm -f "$e"
}
CLEAN=(env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE -u PGPASSWORD -u PGUSER -u PGDATABASE)
# Private passfile for this invocation (0700 dir, 0600 file), removed on every exit. Set by local_db.
PF_DIR=""; ARMED_WORK=""
on_exit() {
  [ -n "$PF_DIR" ] && rm -rf -- "$PF_DIR"
  if [ -n "$ARMED_WORK" ]; then rm -rf -- "$ARMED_WORK"; echo "le-run: private dir removed after a failed setup" >&2; fi
}
trap on_exit EXIT
psql() { command "${CLEAN[@]}" PGPASSFILE="$PF_DIR/pgpass" psql -w "$@"; }   # -w: never prompt; fail closed
local_db() {
  node "$HERE/pgconn.mjs" check "$1" >/dev/null 2>&1 || refuse "database URL refused (loopback, password-free canonical postgresql://user@host:port/db required)"
  [ -z "$PF_DIR" ] || return 0
  PF_DIR=$(mktemp -d) || refuse "mktemp"
  node "$HERE/pgconn.mjs" passfile "$1" "$PF_DIR/pgpass" >/dev/null 2>&1 || refuse "database password file refused (LE_DB_PASSWORD_FILE must be an absolute mode-600 file of one line)"
}
local_api() { node "$ROOT/scripts/local-stack/t09/api-http.mjs" check "$1" >/dev/null 2>&1 || refuse "origin refused (strict loopback origin required): $2"; }
persona_id() { node -e 'try{const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const p=o[process.argv[2]];if(!p||!/^[0-9a-f-]{36}$/.test(p.id))process.exit(1);console.log(p.id)}catch{process.exit(1)}' "$1" "$2" 2>/dev/null; }
abspath() { node -e 'console.log(require("path").resolve(process.argv[1]))' "$1"; }
inside() { case "$1/" in "$2"/*) return 0 ;; *) return 1 ;; esac; }
COURSE=ed170000-0000-4000-8000-0000000000c1
ACK='-c le.fixture_ack=isolated-local-stack'
PRIVATE_NAMES='^(personas\.json|state-(OWNER|OTHER|STUDENT)\.json)$'

[ -n "${PGPASSWORD+x}" ] && refuse "an external PGPASSWORD is refused; use LE_DB_PASSWORD_FILE (mode 600)"
no_selftest_overrides() {
  [ -z "${LE_ALLOWED_ORIGINS+x}" ] || refuse "LE_ALLOWED_ORIGINS is a self-test override and is refused here (nothing was written)"
  [ -z "${LE_EGRESS_CONTROL+x}" ] || refuse "LE_EGRESS_CONTROL is a self-test override and is refused here (nothing was written)"
}
cmd="${1:-}"; shift || true
case "$cmd" in
  setup)
    API="${1:?api origin}"; APP="${2:?app origin}"; DB="${3:?db url}"; ANON="${4:?anon key file}"; SERVICE="${5:?service key file}"
    WORK="$(abspath "${6:?private dir}")"; EVID="$(abspath "${7:?evidence dir}")"
    pin_harness
    no_selftest_overrides
    local_db "$DB"; local_api "$API" api; local_api "$APP" app
    [ -e "$WORK" ] && refuse "private dir exists (never reused)"
    [ -e "$EVID" ] && refuse "evidence dir exists (never reused)"
    inside "$WORK" "$EVID" || inside "$EVID" "$WORK" && refuse "private and evidence dirs must not contain each other"
    quiet "preflight" node "$HERE/preflight.mjs" "$API" "$APP" "$DB" "$ANON" "$SERVICE" || refuse "preflight (read-only; nothing was written)"
    mkdir -m 700 "$EVID" || refuse "cannot create evidence dir"
    ARMED_WORK="$WORK" 
    quiet "personas" node "$HERE/personas.mjs" "$API" "$ANON" "$SERVICE" "$APP" "$WORK" || refuse "personas"
    ids=""; for p in OWNER OTHER STUDENT; do i=$(persona_id "$WORK/personas.json" "$p") || refuse "personas file unreadable"; ids="$ids $i"; done
    read -r OWNER OTHER STUDENT <<<"$ids"
    PGOPTIONS="$ACK" quiet "fixture" psql "$DB" -X -q -v owner="$OWNER" -v other="$OTHER" -v student="$STUDENT" \
      -f "$HERE/fixture.sql" || refuse "fixture"
    quiet "backend contract" node "$HERE/backend-contract.mjs" "$API" "$ANON" "$WORK/personas.json" "$EVID/backend-contract.json" || refuse "backend contract"
    ARMED_WORK=""
    echo "PASS le-run setup: read-only preflight, personas, fixture and LOCAL backend contract; sessions in the private dir only" ;;
  owner)
    DB="${1:?db url}"; WORK="${2:?private dir}"; WHO="${3:?OWNER or OTHER}"
    no_selftest_overrides
    local_db "$DB"
    case "$WHO" in OWNER|OTHER) ;; *) refuse "owner must be OWNER or OTHER" ;; esac
    id=$(persona_id "$WORK/personas.json" "$WHO") || refuse "persona $WHO missing"
    n=$(PGOPTIONS="$ACK" quiet "owner change" psql \
      "$DB" -X -qAt -v ON_ERROR_STOP=1 -v id="$id" -c "do \$\$ begin if current_setting('le.fixture_ack', true) is distinct from 'isolated-local-stack' then raise exception 'not acknowledged'; end if; end \$\$;" \
      -c "with u as (update public.courses set instructor_id = '$id' where id = '$COURSE' returning 1) select count(*) from u;") || refuse "owner change"
    [ "$n" = 1 ] || refuse "owner change touched an unexpected number of rows (expected exactly 1)"
    echo "le-run owner: C1 instructor is now $WHO (setup, fixture course only)" ;;
  read)
    DB="${1:?db url}"; ID="${2:?lesson id}"
    local_db "$DB"
    [[ "$ID" =~ ^ed170000-0000-4000-8000-0000000000[0-9a-f]{2}$ ]] || refuse "only fixture ids may be read"
    out=$(quiet "read" psql "$DB" -X -qAt -v ON_ERROR_STOP=1 -c 'begin read only' \
      -c "select coalesce(row_to_json(r)::text, 'null') from (select id, title, content, type::text as type, published, updated_at from public.content_items where id = '$ID') r right join (select 1) one on true" \
      -c 'commit') || refuse "read"
    node -e 'try{JSON.parse(process.argv[1])}catch{process.exit(1)}' "$out" 2>/dev/null || refuse "read: unexpected output"
    printf '%s\n' "$out" ;;
  quizhash)
    DB="${1:?db url}"; local_db "$DB"
    out=$(quiet "quizhash" psql "$DB" -X -qAt -v ON_ERROR_STOP=1 -c 'begin read only' -c "
select md5(coalesce(string_agg(t, '|' order by t), '')) from (
  select 'ci:' || row_to_json(c)::text as t from (select id, type::text as type, course_id, module_id from public.content_items
     where id = 'ed170000-0000-4000-8000-0000000000a4') c
  union all select 'q:' || row_to_json(q)::text from public.quizzes q where q.content_item_id = 'ed170000-0000-4000-8000-0000000000a4'
  union all select 'qq:' || row_to_json(x)::text from public.quiz_questions x
     join public.quizzes q on q.id = x.quiz_id where q.content_item_id = 'ed170000-0000-4000-8000-0000000000a4'
) h" -c 'commit') || refuse "quizhash"
    [[ "$out" =~ ^[0-9a-f]{32}$ ]] || refuse "quizhash: unexpected output"
    printf '%s\n' "$out" ;;
  evidence)
    DEST="${1:?dest}"; EVID="$(abspath "${2:?evidence dir}")"
    pin_harness
    [ -d "$EVID" ] || refuse "evidence dir missing"
    find "$EVID" -type f | grep -qE '/(personas\.json|state-[A-Z]+\.json)$' && refuse "session file found under the evidence dir; nothing staged"
    bash "$ROOT/scripts/local-stack/t09/stack-checks.sh" stage-evidence --require-all "$DEST" "$EVID/backend-contract.json" -- "$EVID" || refuse "stage-evidence" ;;
  cleanup)
    WORK="$(abspath "${1:?private dir}")"
    [ -e "$WORK" ] || { echo "le-run cleanup: nothing to remove"; exit 0; }
    [ -d "$WORK" ] && [ ! -L "$WORK" ] || refuse "cleanup: not a plain directory"
    extra=$(find "$WORK" -mindepth 1 \( -type d -o ! -type f \) -print -quit 2>/dev/null); [ -z "$extra" ] || refuse "cleanup: unexpected entries; not removing"
    while IFS= read -r f; do [[ "$(basename "$f")" =~ $PRIVATE_NAMES ]] || refuse "cleanup: unexpected file; not removing"; done < <(find "$WORK" -type f)
    rm -rf -- "$WORK" || refuse "cleanup failed"
    echo "le-run cleanup: private session dir removed" ;;
  *) echo "usage: run.sh setup|owner|read|quizhash|evidence|cleanup ... (see header)" >&2; exit 2 ;;
esac
