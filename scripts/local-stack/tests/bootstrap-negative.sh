#!/usr/bin/env bash
# ABOUTME: Regressions for the authentic-stack bootstrap on a LOCAL cluster with the managed layout SIMULATED
# ABOUTME: (PostgreSQL 16 here; real `supabase start` PG15 is a separate, unexecuted gate): mutual refusal of
# ABOUTME: the two bootstraps, a positive smoke run, idempotent localization, fail-closed on psql FATAL and on
# ABOUTME: partial identity output (fake psql, no network), and identity drift in column default / index.
set -u
PGBASE="${1:?loopback libpq url WITHOUT database}"; ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; rc=0
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGBASE/postgres" >/dev/null || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
npass=0; nfail=0
say() { if [ "$2" -eq 0 ]; then echo "PASS $1"; npass=$((npass+1)); else echo "FAIL $1"; nfail=$((nfail+1)); rc=1; fi; }
mk() { psql "$PGBASE/postgres" -qc "drop database if exists $1" >/dev/null 2>&1; psql "$PGBASE/postgres" -qc "create database $1" >/dev/null; }
# Roles are CLUSTER-wide: create only the missing ones and drop exactly those on exit, so the sibling
# harness (whose builder refuses managed roles by design) keeps working on this cluster.
CREATED_ROLES=()
for r in supabase_admin supabase_auth_admin supabase_storage_admin authenticator anon authenticated service_role; do
  [ "$(psql "$PGBASE/postgres" -Atc "select count(*) from pg_roles where rolname='$r'")" = "1" ] || { psql "$PGBASE/postgres" -qc "create role $r nologin" >/dev/null && CREATED_ROLES+=("$r"); }
done
DBS=(); cleanup() { for d in "${DBS[@]:-}"; do [ -n "$d" ] && psql "$PGBASE/postgres" -qc "drop database if exists $d" >/dev/null 2>&1; done; for r in "${CREATED_ROLES[@]:-}"; do [ -n "$r" ] && psql "$PGBASE/postgres" -qc "drop role if exists $r" >/dev/null 2>&1; done; }
trap cleanup EXIT
simulate() { mk "$1"; DBS+=("$1"); psql "$PGBASE/$1" -q -f "$ROOT/scripts/local-db/supabase-shim.sql" >/dev/null 2>&1; psql "$PGBASE/$1" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/local-stack/tests/simulate-managed-stack.sql" >/dev/null; }

# 1) shim database (schemas/objects owned by postgres) is refused by the authentic bootstrap
mk ls_shim; DBS+=(ls_shim); psql "$PGBASE/ls_shim" -q -f "$ROOT/scripts/local-db/supabase-shim.sql" >/dev/null 2>&1
out=$(timeout 600 "$ROOT/scripts/local-stack/bootstrap.sh" "$PGBASE/ls_shim" 2>&1); st=$?; [ $st -ne 0 ] && echo "$out" | grep -qE "is owned by|expected the 7 managed roles"; say "authentic bootstrap refuses a shim database (object ownership check)" $?
# 2) snapshot builder refuses a database on a cluster with managed roles
mk ls_managed_builder; DBS+=(ls_managed_builder)
out=$("$ROOT/scripts/local-db/build-from-snapshot.sh" "$PGBASE/ls_managed_builder" /tmp/does-not-matter 2>&1); st=$?; [ $st -ne 0 ] && echo "$out" | grep -q "looks like a real Supabase database"; say "snapshot builder refuses a database with managed roles" $?
# 3) positive control: simulated managed layout, full bootstrap must succeed and report both identity sets
simulate ls_sim
out=$(timeout 600 "$ROOT/scripts/local-stack/bootstrap.sh" "$PGBASE/ls_sim" 2>&1); st=$?; echo "$out" | grep -E "OK:|declared divergences|bootstrap OK" | sed 's/^/   /'; say "authentic bootstrap applies the sanitized snapshot on the SIMULATED layout (PG16; not PG15 parity)" $st
# 4) idempotent localization: second run creates nothing, updates the 5 placeholders, counts unchanged
before=$(psql "$PGBASE/ls_sim" -Atc "select count(*) from vault.secrets"); out=$(psql "$PGBASE/ls_sim" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/local-stack/localize.sql" 2>&1); after=$(psql "$PGBASE/ls_sim" -Atc "select count(*) from vault.secrets")
echo "$out" | grep -q "0 created, 5 updated" && [ "$before" = "$after" ] && [ "$after" = "5" ]; say "localize.sql is idempotent (second run: 0 created, 5 updated, count stays 5)" $?
dups=$(psql "$PGBASE/ls_sim" -Atc "select count(*) - count(distinct name) from vault.secrets"); [ "$dups" = "0" ]; say "vault names are unique after localization" $?
cron=$(psql "$PGBASE/ls_sim" -Atc "select count(*) from cron.job"); [ "$cron" = "0" ]; say "no cron jobs remain scheduled" $?
# 5) fail-closed: a psql that dies with FATAL mid-way through 02 must fail the bootstrap (fake psql, no network)
# type -P resolves the BINARY only; command -v would return the psql() shell function above, and the fake would
# then exec itself forever (seen once: 28 minutes of a spinning fake psql with the cluster idle).
FAKE=$(mktemp -d); REAL_PSQL=$(type -P psql)
[ -x "$REAL_PSQL" ] && [ "$REAL_PSQL" != "$FAKE/psql" ] || { echo "cannot resolve the real psql binary (got: ${REAL_PSQL:-nothing})"; exit 1; }
cat > "$FAKE/psql" <<PSQL
#!/usr/bin/env bash
for a in "\$@"; do if [[ "\$a" == *"\${FAKE_FATAL_ON:-__never__}"* ]]; then echo "some partial output line"; echo "psql: FATAL:  terminating connection due to administrator command" >&2; exit 2; fi; done
for a in "\$@"; do if [[ "\$a" == *"\${FAKE_EXIT3_ON:-__never__}"* ]]; then exit 3; fi; done   # silent: no ERROR text at all
[ "\$(readlink -f "\$0")" = "\$(readlink -f "$REAL_PSQL")" ] && { echo "fake psql would exec itself" >&2; exit 97; }
exec "$REAL_PSQL" "\$@"
PSQL
chmod +x "$FAKE/psql"
simulate ls_fatal
out=$(PATH="$FAKE:$PATH" FAKE_FATAL_ON=02_constraints_indexes_views.sql timeout 600 "$ROOT/scripts/local-stack/bootstrap.sh" "$PGBASE/ls_fatal" 2>&1); st=$?
[ $st -ne 0 ] && ! echo "$out" | grep -q "bootstrap OK" && echo "$out" | grep -qE "FATAL"; say "bootstrap fails closed when psql exits 2 with FATAL during constraints/views (no 'bootstrap OK')" $?
# 6) fail-closed: identity query emitting partial rows then exit 2 must fail verification
out=$(PATH="$FAKE:$PATH" FAKE_FATAL_ON=identities-extended.sql timeout 600 "$ROOT/scripts/local-stack/verify-identities.sh" "$PGBASE/ls_sim" 2>&1); st=$?
[ $st -ne 0 ] && echo "$out" | grep -q "identity query failed"; say "verify-identities fails closed on partial output + psql exit 2" $?
out=$(PATH="$FAKE:$PATH" FAKE_FATAL_ON=identities.sql timeout 600 "$ROOT/scripts/local-stack/verify-identities.sh" "$PGBASE/ls_sim" 2>&1); st=$?
[ $st -ne 0 ] && echo "$out" | grep -q "identity query failed"; say "verify-identities fails closed when the live-verified query dies" $?
# 7) snapshot-derived parity catches a changed column default and a changed index definition
psql "$PGBASE/ls_sim" -qc "alter table public.courses alter column published set default true" >/dev/null
out=$(timeout 600 "$ROOT/scripts/local-stack/verify-identities.sh" "$PGBASE/ls_sim" 2>&1); st=$?; [ $st -ne 0 ] && echo "$out" | grep -q "courses.published"; say "parity catches a drifted column default (courses.published)" $?
psql "$PGBASE/ls_sim" -qc "alter table public.courses alter column published set default false" >/dev/null
IDX=$(psql "$PGBASE/ls_sim" -Atc "select indexname from pg_indexes where schemaname='public' and tablename='enrollments' and indexname like 'idx_%' limit 1")
IDXDEF=$(psql "$PGBASE/ls_sim" -Atc "select indexdef from pg_indexes where schemaname='public' and indexname='$IDX'")
psql "$PGBASE/ls_sim" -qc "drop index public.$IDX; create index $IDX on public.enrollments (course_id, user_id)" >/dev/null
out=$(timeout 600 "$ROOT/scripts/local-stack/verify-identities.sh" "$PGBASE/ls_sim" 2>&1); st=$?; [ $st -ne 0 ] && echo "$out" | grep -q "$IDX"; say "parity catches a drifted index definition ($IDX)" $?
psql "$PGBASE/ls_sim" -qc "drop index public.$IDX; $IDXDEF" >/dev/null   # restore the original definition so later groups start from parity
out=$(timeout 600 "$ROOT/scripts/local-stack/verify-identities.sh" "$PGBASE/ls_sim" 2>&1); st=$?; say "parity passes again once the index is restored" $st
# 8) omission semantics: the broken live view is ABSENT locally (42P01), the live recursion is not reproduced
code=$(psql "$PGBASE/ls_sim" -Atc "select 1 from public.quiz_analytics" 2>&1 | grep -oE "ERROR:.*" | head -1); echo "   quiz_analytics locally: ${code:-no error}"; echo "$code" | grep -q "does not exist"; say "quiz_analytics is omitted locally (undefined_table), not a reproduced 42P17" $?
# 9) process status first: a psql that exits 3 with NO error text while applying 03 must fail the bootstrap
#    (reviewer finding: exit 3 without ERROR lines used to pass as success)
simulate ls_exit3
out=$(PATH="$FAKE:$PATH" FAKE_EXIT3_ON=03_functions.sql timeout 600 "$ROOT/scripts/local-stack/bootstrap.sh" "$PGBASE/ls_exit3" 2>&1); st=$?
[ $st -ne 0 ] && ! echo "$out" | grep -q "bootstrap OK" && echo "$out" | grep -q "psql exited 3"; say "bootstrap fails closed when psql exits 3 silently (no ERROR text) during functions" $?
# 10) resources.created_by is compared EXACTLY against the sanitized reference (no blanket waiver): any drift fails
psql "$PGBASE/ls_sim" -qc "alter table public.resources alter column created_by set default gen_random_uuid()" >/dev/null
out=$(timeout 600 "$ROOT/scripts/local-stack/verify-identities.sh" "$PGBASE/ls_sim" 2>&1); st=$?; [ $st -ne 0 ] && echo "$out" | grep -q "resources.created_by"; say "parity rejects a drifted resources.created_by default (sanitized signature is exact, not waived)" $?
psql "$PGBASE/ls_sim" -qc "alter table public.resources alter column created_by drop default" >/dev/null
out=$(timeout 600 "$ROOT/scripts/local-stack/verify-identities.sh" "$PGBASE/ls_sim" 2>&1); st=$?; say "parity passes again once the sanitized signature is restored" $st
# 11) the final server-version probe: psql dying there must NOT print "bootstrap OK" with a blank version
simulate ls_ver
out=$(PATH="$FAKE:$PATH" FAKE_FATAL_ON="show server_version" timeout 600 "$ROOT/scripts/local-stack/bootstrap.sh" "$PGBASE/ls_ver" 2>&1); st=$?
[ $st -ne 0 ] && ! echo "$out" | grep -q "bootstrap OK" && echo "$out" | grep -q "version probe"; say "bootstrap fails closed when the final version probe dies (no 'bootstrap OK' with a blank version)" $?
# 12) workdir preparation is non-destructive (separate harness; it never touches a database)
out=$("$ROOT/scripts/local-stack/tests/workdir-negative.sh" 2>&1); st=$?; echo "$out" | grep -E "^(FAIL|SKIP)" | sed 's/^/   /'; say "workdir-negative.sh: $(echo "$out" | grep -c '^PASS') checks pass, $(echo "$out" | grep -c '^FAIL') fail" $st
# 13) Supabase default ACLs (first PG15 run 41266473201): the image grants anon/authenticated/service_role ALL on every
#     new public table. SIMULATED here with the same ALTER DEFAULT PRIVILEGES; the exact reconcile must remove what
#     the capture lacks (quiz_questions and submission_attachments to anon), and identities must then match.
simulate ls_defacl
psql "$PGBASE/ls_defacl" -qc "alter default privileges in schema public grant all on tables to anon, authenticated, service_role" >/dev/null
out=$(timeout 600 "$ROOT/scripts/local-stack/bootstrap.sh" "$PGBASE/ls_defacl" 2>&1); st=$?; echo "$out" | grep -E "ACL reconcile|revoked|OK:|bootstrap OK" | head -8 | sed 's/^/   /'
[ $st -eq 0 ] && echo "$out" | grep -qP "revoked \(not in capture\): quiz_questions\tanon\t" && echo "$out" | grep -qP "revoked \(not in capture\): submission_attachments\tanon\t" && echo "$out" | grep -q "bootstrap OK"
say "bootstrap reconciles simulated Supabase default ACLs exactly (quiz_questions/submission_attachments anon revoked; parity OK)" $?
# 14) the reconcile touches only the three API roles and only what the capture lacks
psql "$PGBASE/ls_defacl" -qc "do \$\$ begin if not exists (select 1 from pg_roles where rolname='ic_other_role') then create role ic_other_role nologin; end if; end \$\$; grant select on public.quiz_questions to ic_other_role; grant insert on public.quiz_questions to anon" >/dev/null
out=$("$ROOT/scripts/local-stack/reconcile-table-acl.sh" "$PGBASE/ls_defacl" "$ROOT/scripts/local-stack/schema/05_triggers_grants.sql" quiz_analytics 2>&1); st=$?
other=$(psql "$PGBASE/ls_defacl" -Atc "select has_table_privilege('ic_other_role','public.quiz_questions','SELECT')"); anon=$(psql "$PGBASE/ls_defacl" -Atc "select has_table_privilege('anon','public.quiz_questions','INSERT')")
psql "$PGBASE/ls_defacl" -qc "revoke all on public.quiz_questions from ic_other_role; drop role ic_other_role" >/dev/null 2>&1
[ $st -eq 0 ] && [ "$other" = "t" ] && [ "$anon" = "f" ] && echo "$out" | grep -qP "quiz_questions\tanon\tINSERT"; say "reconcile revokes a new extra anon INSERT and leaves a non-API role's grant alone" $?
# 15) fail closed: a captured privilege that is missing on the server is reported, never silently accepted
psql "$PGBASE/ls_defacl" -qc "revoke select on public.quiz_questions from authenticated" >/dev/null
out=$("$ROOT/scripts/local-stack/reconcile-table-acl.sh" "$PGBASE/ls_defacl" "$ROOT/scripts/local-stack/schema/05_triggers_grants.sql" quiz_analytics 2>&1); st=$?
psql "$PGBASE/ls_defacl" -qc "grant select on public.quiz_questions to authenticated" >/dev/null
[ $st -eq 1 ] && echo "$out" | grep -qP "MISSING\tquiz_questions\tauthenticated\tSELECT"; say "reconcile fails closed on a missing captured privilege" $?
# 16) fail closed: a grant line outside the strict form is refused instead of being skipped
BAD=$(mktemp); { cat "$ROOT/scripts/local-stack/schema/05_triggers_grants.sql"; echo 'grant SELECT on public."Odd Table" to anon;'; } > "$BAD"
out=$("$ROOT/scripts/local-stack/reconcile-table-acl.sh" "$PGBASE/ls_defacl" "$BAD" quiz_analytics 2>&1); st=$?; rm -f "$BAD"
[ $st -eq 2 ] && echo "$out" | grep -q "do not match the strict form"; say "reconcile refuses an unparseable grant line" $?
# 17) narrow version-aware view signature (captured PG15 text, PG16 identity, changed-definition controls)
# 18) diagnostics: the coursera_crawl_progress evidence is kept on a PASSING run, and a drifted view's diagnostics are
# real catalog text (the b256e74 form passed :'v' inside psql -c, which psql never interpolates: a syntax error)
out=$(timeout 600 "$ROOT/scripts/local-stack/verify-identities.sh" "$PGBASE/ls_sim" 2>&1); st=$?
ev=$(echo "$out" | sed -n '/^\[evidence\] view coursera_crawl_progress/,$p')
[ $st -eq 0 ] && echo "$ev" | grep -q "server_version_num: " && echo "$ev" | grep -q "FROM coursera_crawl_queue" && echo "$ev" | grep -qE "md5\(reloptions\|raw definition\): [0-9a-f]{32}" && echo "$ev" | grep -qE "identity signature: [0-9a-f]{32}"
say "verify-identities keeps coursera_crawl_progress evidence (version, options, raw text, both hashes) on a passing run" $?
VDEF=$(psql "$PGBASE/ls_sim" -Atc "select pg_get_viewdef('public.coursera_crawl_progress'::regclass, false)")
psql "$PGBASE/ls_sim" -v ON_ERROR_STOP=1 -qc "create or replace view public.coursera_crawl_progress with (security_invoker=true) as select state, source, count(*) as urls, min(enqueued_at) as oldest_enqueued_at, max(processed_at) as newest_processed_at from public.coursera_crawl_queue where state is not null group by state, source" >/dev/null
out=$(timeout 600 "$ROOT/scripts/local-stack/verify-identities.sh" "$PGBASE/ls_sim" 2>&1); st=$?
diagv=$(echo "$out" | sed -n '/^  diagnostics view coursera_crawl_progress:/,/identity signature/p')
[ $st -ne 0 ] && echo "$diagv" | grep -q "WHERE state IS NOT NULL" && echo "$diagv" | grep -qE "md5\(reloptions\|raw definition\): [0-9a-f]{32}" && ! echo "$out" | grep -qiE "syntax error|evidence query FAILED"
say "a drifted view fails parity and its diagnostics carry the real definition and both hashes (no psql syntax error)" $?
psql "$PGBASE/ls_sim" -v ON_ERROR_STOP=1 -qc "create or replace view public.coursera_crawl_progress with (security_invoker=true) as $VDEF" >/dev/null
out=$(timeout 600 "$ROOT/scripts/local-stack/verify-identities.sh" "$PGBASE/ls_sim" 2>&1); st=$?; say "parity passes again once the view is restored" $st
# 19) reconcile input/capture failures stop before psql (no database needed)
out=$("$ROOT/scripts/local-stack/tests/reconcile-negative.sh" 2>&1); st=$?; echo "$out" | grep -E "^(FAIL|SKIP)" | sed 's/^/   /'; say "reconcile-negative.sh: $(echo "$out" | grep -c '^PASS') checks pass" $st
out=$("$ROOT/scripts/local-stack/tests/view-signature.sh" "$PGBASE/postgres" 2>&1); st=$?; echo "$out" | grep -E "^FAIL" | sed 's/^/   /'; say "view-signature.sh: $(echo "$out" | grep -c '^PASS') cases pass" $st
rm -rf "$FAKE"; echo "bootstrap-negative: $npass PASS, $nfail FAIL of $((npass+nfail)) named checks; exit $rc"; exit $rc
