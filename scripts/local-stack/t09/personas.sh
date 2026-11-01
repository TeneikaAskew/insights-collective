#!/usr/bin/env bash
# ABOUTME: Creates the T-09 API personas through the LOCAL GoTrue admin API (service key, labelled setup) and signs each in
# ABOUTME: by password grant. Tokens, passwords and keys exist only in mode-600 files; nothing secret is ever printed.
# Usage: personas.sh <api base url (loopback)> <anon key file> <service key file> <db url> <persona output file>
#   Personas: A pure student (enrolled later in C only, never D), B student, I instructor (owns C), J instructor (owns D),
#   ADMIN admin. Roles are set as setup through the database (the same trusted local session the fixtures use), then
#   checked: A and B hold exactly {student}. Output JSON: {"A":{"id":..,"token":..},...} written 0600.
# Secrets never go on a command line (process listings): curl reads headers and bodies from 0600 files (-H @file, -d @file).
set -u
API="${1:?api url}"; ANON_FILE="${2:?anon key file}"; SERVICE_FILE="${3:?service key file}"; DB="${4:?db url}"; OUT="${5:?persona file}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
umask 077
refuse() { echo "FAIL personas: $*"; exit 1; }
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$DB" >/dev/null || refuse "database is not loopback"
case "$API" in http://127.0.0.1:*|http://localhost:*) ;; *) refuse "API is not a loopback http URL" ;; esac
for f in "$ANON_FILE" "$SERVICE_FILE"; do
  [ -f "$f" ] && [ -s "$f" ] || refuse "key file missing or empty"
  [ "$(stat -c %a "$f")" = 600 ] || refuse "key file is not mode 600"
done
[ ! -e "$OUT" ] || refuse "persona file exists (never reused)"
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
printf 'apikey: %s\nAuthorization: Bearer %s\nContent-Type: application/json\n' "$(cat "$SERVICE_FILE")" "$(cat "$SERVICE_FILE")" > "$W/svc.h"
printf 'apikey: %s\nContent-Type: application/json\n' "$(cat "$ANON_FILE")" > "$W/anon.h"
RUN=$(od -An -N4 -tx4 /dev/urandom | tr -d ' \n')
post() { # label, url, header file, body file, out file -> http code (curl failure = refuse)
  local code
  code=$(curl -sS --connect-timeout 5 --max-time 20 -o "$5" -w '%{http_code}' -X POST -H @"$3" --data-binary @"$4" "$2" 2>"$W/curl.err") \
    || refuse "$1: curl failed ($(wc -c <"$W/curl.err") bytes of stderr withheld)"
  printf '%s' "$code"
}
node -e 'process.stdout.write("{}")' > "$OUT"
for P in A B I J ADMIN; do
  email="t09-$(tr 'A-Z' 'a-z' <<<"$P")-$RUN@local.test"
  pw=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
  node -e 'const [e,p]=process.argv.slice(1); process.stdout.write(JSON.stringify({email:e,password:p,email_confirm:true}))' "$email" "$pw" > "$W/u.json"
  code=$(post "create $P (setup)" "$API/auth/v1/admin/users" "$W/svc.h" "$W/u.json" "$W/u.out")
  [ "$code" = 200 ] || [ "$code" = 201 ] || refuse "create $P (setup): HTTP $code"
  node -e 'const [e,p]=process.argv.slice(1); process.stdout.write(JSON.stringify({email:e,password:p}))' "$email" "$pw" > "$W/t.json"
  code=$(post "sign in $P" "$API/auth/v1/token?grant_type=password" "$W/anon.h" "$W/t.json" "$W/t.out")
  [ "$code" = 200 ] || refuse "sign in $P: HTTP $code"
  node - "$OUT" "$P" "$W/u.out" "$W/t.out" <<'JS' || refuse "persona $P: response missing id or token"
const fs = require('fs'); const [out, p, uf, tf] = process.argv.slice(2);
const u = JSON.parse(fs.readFileSync(uf, 'utf8')), t = JSON.parse(fs.readFileSync(tf, 'utf8'));
const id = u.id || (u.user && u.user.id); if (!/^[0-9a-f-]{36}$/.test(id || '') || !t.access_token) process.exit(1);
const claims = JSON.parse(Buffer.from(t.access_token.split('.')[1], 'base64url').toString());
if (claims.sub !== id || claims.role !== 'authenticated') process.exit(1);
const o = JSON.parse(fs.readFileSync(out, 'utf8')); o[p] = { id, token: t.access_token }; fs.writeFileSync(out, JSON.stringify(o), { mode: 0o600 });
JS
  echo "persona $P: created via local GoTrue admin API (setup) and signed in by password grant; token kept in the 0600 persona file"
done
[ "$(stat -c %a "$OUT")" = 600 ] || refuse "persona file is not mode 600"
ids=$(node -e 'const o=require(process.argv[1]); console.log(["A","B","I","J","ADMIN"].map(k=>o[k].id).join(" "))' "$OUT")
read -r A B I J ADMIN <<<"$ids"
# Roles (setup). handle_new_user may have given every user a default role; staff roles are added, students left pure.
psql "$DB" -v ON_ERROR_STOP=1 -qAt -v a="$A" -v b="$B" -v i="$I" -v j="$J" -v adm="$ADMIN" <<'SQL' || refuse "role setup"
insert into public.profiles (id) values (:'a'), (:'b'), (:'i'), (:'j'), (:'adm') on conflict (id) do nothing;
insert into public.user_roles (user_id, role) values (:'a','student'), (:'b','student'), (:'i','instructor'), (:'j','instructor'), (:'adm','admin') on conflict do nothing;
select set_config('t09p.a', :'a', false) as a, set_config('t09p.b', :'b', false) as b \gset t09p_
do $$ begin
  if (select string_agg(role::text, ',' order by role::text) from public.user_roles where user_id = current_setting('t09p.a')::uuid) is distinct from 'student'
     or (select string_agg(role::text, ',' order by role::text) from public.user_roles where user_id = current_setting('t09p.b')::uuid) is distinct from 'student' then
    raise exception 'persona A or B is not a pure student'; end if;
end $$;
SQL
echo "PASS personas: 5 created (A, B students; I, J instructors; ADMIN admin); tokens only in the 0600 persona file"
