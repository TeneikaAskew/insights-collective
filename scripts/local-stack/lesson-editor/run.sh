#!/usr/bin/env bash
# ABOUTME: Lesson-editor fixture runner for an ALREADY BOOTSTRAPPED isolated local stack. It never starts, stops or resets a
# ABOUTME: stack and never touches a shared fixture; every subcommand re-checks the loopback DSN (and API origin) first.
#
#   run.sh setup  <api origin> <app origin> <db url> <anon key file> <service key file> <work dir (absent)>
#        personas (local GoTrue admin API, setup) -> fixture.sql (once per fresh stack) -> backend-contract.mjs (LOCAL checks)
#   run.sh owner  <db url> <work dir> OWNER|OTHER     sets instructor_id of fixture course C1 ONLY (RLS-ZERO-ROW case)
#   run.sh read   <db url> <lesson id>                read-only row JSON; fixture ids (ed170000-...) only
#   run.sh quizhash <db url>                          read-only md5 over the fixture quiz, its questions and any submissions
#
# Not a shared runner: no globalSetup, no teardown, no truncation, no edits to e2e.yml. Integration into the shared workflow is
# the T-09 owner's (see README.md). Secrets come only from mode-600 files and are never printed or passed as arguments.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
umask 077
refuse() { echo "FAIL le-run: $*" >&2; exit 1; }
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
local_db() { node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$1" >/dev/null 2>&1 || refuse "database is not loopback"; }
local_api() { node "$ROOT/scripts/local-stack/t09/api-http.mjs" check "$1" >/dev/null 2>&1 || refuse "origin refused (strict loopback origin required): $2"; }
# Pinned harness file: tested against T-09 harness 5d81976 (api-http.mjs blob fb2b49d8). Any other content is refused until
# this lane re-checks it (the T-09 owner's integration may move the harness; the pin makes that visible, never silent).
API_HTTP_BLOB=fb2b49d8d20f5a00da8e3bcbc55ad265cf6a1766
pin_harness() {
  local f="$ROOT/scripts/local-stack/t09/api-http.mjs" got
  [ -f "$f" ] || refuse "T-09 harness (scripts/local-stack/t09) not present in this tree"
  got=$(git hash-object "$f" 2>/dev/null) || refuse "cannot hash api-http.mjs"
  [ "$got" = "$API_HTTP_BLOB" ] || refuse "api-http.mjs is $got, not the pinned $API_HTTP_BLOB (re-check required by the lesson-editor lane)"
}
COURSE=ed170000-0000-4000-8000-0000000000c1
ACK='-c le.fixture_ack=isolated-local-stack'

cmd="${1:-}"; shift || true
case "$cmd" in
  setup)
    API="${1:?api origin}"; APP="${2:?app origin}"; DB="${3:?db url}"; ANON="${4:?anon key file}"; SERVICE="${5:?service key file}"; WORK="${6:?work dir}"
    local_db "$DB"; local_api "$API" api; local_api "$APP" app
    [ -e "$WORK" ] && refuse "work dir exists (never reused)"
    pin_harness
    node "$HERE/personas.mjs" "$API" "$ANON" "$SERVICE" "$APP" "$WORK" || refuse "personas"
    ids=$(node -e 'const o=require(process.argv[1]); console.log(["OWNER","OTHER","STUDENT"].map(k=>o[k].id).join(" "))' "$WORK/personas.json") || refuse "personas file unreadable"
    read -r OWNER OTHER STUDENT <<<"$ids"
    PGOPTIONS="$ACK" psql "$DB" -X -q -v owner="$OWNER" -v other="$OTHER" -v student="$STUDENT" -f "$HERE/fixture.sql" || refuse "fixture"
    node "$HERE/backend-contract.mjs" "$API" "$ANON" "$WORK/personas.json" "$WORK/backend-contract.json" || refuse "backend contract"
    echo "PASS le-run setup: personas, fixture and LOCAL backend contract; storage states in $WORK (mode 600)" ;;
  owner)
    DB="${1:?db url}"; WORK="${2:?work dir}"; WHO="${3:?OWNER or OTHER}"
    local_db "$DB"
    case "$WHO" in OWNER|OTHER) ;; *) refuse "owner must be OWNER or OTHER" ;; esac
    id=$(node -e 'const o=require(process.argv[1]); const p=o[process.argv[2]]; if(!p) process.exit(1); console.log(p.id)' "$WORK/personas.json" "$WHO") || refuse "persona $WHO missing"
    n=$(PGOPTIONS="$ACK" psql "$DB" -X -qAt -v ON_ERROR_STOP=1 -v id="$id" <<SQL
do \$\$ begin
  if current_setting('le.fixture_ack', true) is distinct from 'isolated-local-stack' then raise exception 'not acknowledged'; end if;
end \$\$;
with u as (update public.courses set instructor_id = :'id' where id = '$COURSE' returning 1) select count(*) from u;
SQL
) || refuse "owner change"
    [ "$n" = 1 ] || refuse "owner change touched $n rows (expected exactly 1)"
    echo "le-run owner: C1 instructor is now $WHO (setup, fixture course only)" ;;
  read)
    DB="${1:?db url}"; ID="${2:?lesson id}"
    local_db "$DB"
    [[ "$ID" =~ ^ed170000-0000-4000-8000-0000000000[0-9a-f]{2}$ ]] || refuse "only fixture ids may be read"
    psql "$DB" -X -qAt -v ON_ERROR_STOP=1 -v id="$ID" <<'SQL' || refuse "read"
begin read only;
select coalesce(row_to_json(r)::text, 'null') from (
  select id, title, content, type::text as type, published, updated_at from public.content_items where id = :'id') r
right join (select 1) one on true;
commit;
SQL
    ;;
  quizhash)
    DB="${1:?db url}"; local_db "$DB"
    psql "$DB" -X -qAt -v ON_ERROR_STOP=1 <<'SQL' || refuse "quizhash"
begin read only;
select md5(coalesce(string_agg(t, '|' order by t), '')) from (
  select 'ci:' || row_to_json(c)::text as t from (select id, type::text as type, course_id, module_id from public.content_items
     where id = 'ed170000-0000-4000-8000-0000000000a4') c
  union all select 'q:' || row_to_json(q)::text from public.quizzes q where q.content_item_id = 'ed170000-0000-4000-8000-0000000000a4'
  union all select 'qq:' || row_to_json(x)::text from public.quiz_questions x
     join public.quizzes q on q.id = x.quiz_id where q.content_item_id = 'ed170000-0000-4000-8000-0000000000a4'
  union all select 'qs:' || row_to_json(s)::text from public.quiz_submissions s
     join public.quizzes q on q.id = s.quiz_id where q.content_item_id = 'ed170000-0000-4000-8000-0000000000a4'
) h;
commit;
SQL
    ;;
  *) echo "usage: run.sh setup|owner|read|quizhash ... (see header)" >&2; exit 2 ;;
esac
