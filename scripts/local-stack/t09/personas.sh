#!/usr/bin/env bash
# ABOUTME: Creates the T-09 API personas (personas.mjs: strict loopback origin, no redirects, passwords never on a command line)
# ABOUTME: and sets their roles as setup through the database. Nothing secret is ever printed or passed as an argument.
# Usage: personas.sh <api origin (loopback)> <anon key file> <service key file> <db url> <persona output file>
#   A, B, HC, HG students; I, J instructors; ADMIN admin. Roles are set as setup through the database (the trusted local session
#   the fixtures use), then checked: A, B, HC and HG hold exactly {student}. Output JSON written 0600 by personas.mjs.
set -u
API="${1:?api origin}"; ANON_FILE="${2:?anon key file}"; SERVICE_FILE="${3:?service key file}"; DB="${4:?db url}"; OUT="${5:?persona file}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
umask 077
refuse() { echo "FAIL personas: $*"; exit 1; }
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$DB" >/dev/null || refuse "database is not loopback"
# The origin is validated by the shared parser BEFORE any key file is opened for a request (personas.mjs repeats it).
node "$HERE/api-http.mjs" check "$API" >/dev/null 2>&1 || refuse "API target refused (strict loopback origin required)"
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
node "$HERE/personas.mjs" "$API" "$ANON_FILE" "$SERVICE_FILE" "$OUT" || refuse "persona creation"
[ "$(stat -c %a "$OUT")" = 600 ] || refuse "persona file is not mode 600"
ids=$(node -e 'const o=require(process.argv[1]); console.log(["A","B","I","J","ADMIN","HC","HG"].map(k=>o[k].id).join(" "))' "$OUT") || refuse "persona file unreadable"
read -r A B I J ADMIN HC HG <<<"$ids"
# Roles (setup). handle_new_user may have given every user a default role; staff roles are added, students left pure.
psql "$DB" -v ON_ERROR_STOP=1 -qAt -v a="$A" -v b="$B" -v i="$I" -v j="$J" -v adm="$ADMIN" -v hc="$HC" -v hg="$HG" <<'SQL' || refuse "role setup"
insert into public.profiles (id) values (:'a'), (:'b'), (:'i'), (:'j'), (:'adm'), (:'hc'), (:'hg') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'a','student'), (:'b','student'), (:'i','instructor'), (:'j','instructor'), (:'adm','admin'), (:'hc','student'), (:'hg','student') on conflict do nothing;
select set_config('t09p.students', :'a' || ',' || :'b' || ',' || :'hc' || ',' || :'hg', false) as s \gset t09p_
do $$ declare u text; begin
  foreach u in array string_to_array(current_setting('t09p.students'), ',') loop
    if (select string_agg(role::text, ',' order by role::text) from public.user_roles where user_id = u::uuid) is distinct from 'student' then
      raise exception 'a student persona is not a pure student'; end if;
  end loop;
end $$;
SQL
echo "PASS personas: 7 created (A, B, HC, HG students; I, J instructors; ADMIN admin); tokens only in the 0600 persona file"
