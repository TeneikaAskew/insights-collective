#!/usr/bin/env bash
# ABOUTME: Proves the narrow version-aware view signature in identities-extended.sql on any loopback PostgreSQL:
# ABOUTME: the CAPTURED live PG15 text of coursera_crawl_progress normalizes to the manifest signature, the raw
# ABOUTME: qualified text does not, the PG16 path is the identity, and changed definitions/options still fail.
# The PG15 branch is exercised by passing server_num=150008 to the same function the verifier uses; this proves
# the transform on the live-captured text, NOT what a PG15 runner prints at run time (verify-identities.sh
# prints the raw runtime definition on any mismatch for that).
# Usage: view-signature.sh <loopback libpq url of any database>
set -u
PGURL="${1:?loopback DSN}"; ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; SNAP="$ROOT/scripts/local-stack/schema"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$PGURL" >/dev/null || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
EXPECTED=$(awk -F'\t' '$1=="view" && $2=="coursera_crawl_progress"{print $3}' "$SNAP/identities-snapshot-derived.tsv")
[ ${#EXPECTED} -eq 32 ] || { echo "manifest signature for coursera_crawl_progress not found"; exit 2; }
# The captured live text: the snapshot DDL statement after ' as ' (this is the live PG15 pg_get_viewdef output).
CAP=$(python3 -I - "$SNAP/02_constraints_indexes_views.sql" <<'PY'
import sys
s=open(sys.argv[1]).read(); i=s.index('create or replace view public.coursera_crawl_progress'); j=s.index(';',i)+1
stmt=s[i:j]; print(stmt[stmt.index(' as ')+4:], end='')
PY
)
[ -n "$CAP" ] || { echo "captured view text not found"; exit 2; }
OPTS='security_invoker=true'
out=$( { printf '%s\n' '\o /dev/null' "\\i $ROOT/scripts/local-stack/identities-extended.sql" '\o'; cat <<'SQL'
select 'CASE' || E'\t' || name || E'\t' || (md5(opts || '|' || pg_temp.ic_viewdef_v16form(def, rel, ver)) = :'expected')::text
from (values
  ('pg15 captured text normalizes to the manifest signature', :'opts', :'cap', 'coursera_crawl_queue', 150008),
  ('pg15 raw qualified text (no normalization) differs',      :'opts', :'cap', null, 150008),
  ('pg16 path is the identity on qualified text',             :'opts', :'cap', 'coursera_crawl_queue', 160000),
  ('changed GROUP BY still fails',                             :'opts', replace(:'cap', 'GROUP BY coursera_crawl_queue.state, coursera_crawl_queue.source', 'GROUP BY coursera_crawl_queue.state'), 'coursera_crawl_queue', 150008),
  ('extra column still fails',                                 :'opts', replace(:'cap', 'count(*) AS urls,', 'count(*) AS urls, count(*) AS urls2,'), 'coursera_crawl_queue', 150008),
  ('changed reloption still fails',                            'security_invoker=false', :'cap', 'coursera_crawl_queue', 150008),
  ('missing reloption still fails',                            '', :'cap', 'coursera_crawl_queue', 150008),
  ('other relation qualifier is not stripped',                 :'opts', replace(:'cap', 'max(coursera_crawl_queue.processed_at)', 'max(other_rel.processed_at)'), 'coursera_crawl_queue', 150008),
  ('JOIN text is not normalized',                              :'opts', replace(:'cap', 'FROM coursera_crawl_queue', 'FROM coursera_crawl_queue JOIN x ON true'), 'coursera_crawl_queue', 150008),
  ('second SELECT is not normalized',                          :'opts', replace(:'cap', 'count(*) AS urls', '(SELECT 1) AS urls'), 'coursera_crawl_queue', 150008),
  ('FROM another relation is not normalized',                  :'opts', replace(:'cap', 'FROM coursera_crawl_queue', 'FROM coursera_crawl_queue2'), 'coursera_crawl_queue', 150008)
) v(name, opts, def, rel, ver);
SQL
} | psql "$PGURL" -Atq -v ON_ERROR_STOP=1 -v expected="$EXPECTED" -v opts="$OPTS" -v cap="$CAP" 2>&1); st=$?
[ $st -eq 0 ] || { echo "view-signature: psql exit $st: $(echo "$out" | head -3)"; exit 1; }
# expected truth value per case, in order
want=(true false false false false false false false false false false)
rc=0; i=0
while IFS=$'\t' read -r tag name got; do
  [ "$tag" = "CASE" ] || continue
  if [ "$got" = "${want[$i]}" ]; then echo "PASS $name"; else echo "FAIL $name (matches manifest: $got, want ${want[$i]})"; rc=1; fi
  i=$((i+1))
done <<< "$out"
[ $i -eq ${#want[@]} ] || { echo "FAIL expected ${#want[@]} cases, got $i"; rc=1; }
echo "view-signature: $i cases; exit $rc"; exit $rc
