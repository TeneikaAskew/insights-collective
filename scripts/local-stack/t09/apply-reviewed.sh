#!/usr/bin/env bash
# ABOUTME: Applies ONLY the seven reviewed T-09 migrations, by full path, after checking each file's git blob and sha256
# ABOUTME: pins. No glob. Each file runs in its own single transaction and gets its own ledger row in local_evidence.
# Usage: apply-reviewed.sh <loopback db url> OLD|NEW [allow_shim]
#   OLD = 000000 + 000100 only (the pre-T-09 control); NEW = all seven, in order. Separate fresh stacks per mode.
# The guard is re-verified after the last file, so a migration that touched the queue, vault or cron fails the run.
set -u
DB="${1:?loopback db url}"; MODE="${2:?OLD or NEW}"; ALLOW_SHIM="${3:-0}"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
node "$ROOT/scripts/local-db/assert-local-dsn.mjs" "$DB" || exit 2
psql() { command env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGPORT -u PGPASSFILE psql "$@"; }
# path | git blob | sha256 -- pinned at 9cd162ff24a59142dca20b926a88139bfeb66076 (PG15-POSTGREST-PLAN-v2.md, table 1)
PINS=(
"supabase/migrations/20261101000000_scope_instructor_reads_to_own_courses.sql|101a792d0db0284bcecb469cb6aad1bc40b98260|d37ac8f32993c264ea4a3dcd45463e17800af3c922ca622bb13261878343b6b4"
"supabase/migrations/20261101000100_start_quiz_attempt_requires_quiz_access.sql|887df90aaccde33e3d09ca0dd6923993cdc6140f|3fe232f94efb0f78a4f4aa7b520fc96bbbaf55a8e6199eeb4d12993318a45c4b"
"supabase/migrations/20261101000200_quiz_completion_requires_submitted_attempt.sql|5c209c3cd4b411f03ff24f81e35da8458e88ba39|b004d08e4e60fbddd6759c681421e80704d8dfa7731e5cf5a790b9603a7cbb41"
"supabase/migrations/20261101000300_completion_evidence_identity_binding.sql|f70bc5ac7172268ff6bf9aae62f36be18591625e|a1b723638fd392c63909ba0baa288204ce4ead3005d5ee4cfd736864d92acd40"
"supabase/migrations/20261101000400_assignment_submission_identity_binding.sql|2df6fa852493655ace9f6ff3a27c926df0787a50|c9767ca43022cffe45a10a6ca056c4207eefc2251b4998bb0b2040cd04033823"
"supabase/migrations/20261101000500_target_access_and_certificate_evidence.sql|de4f8c2772150fdbfa73dd070035ca4c217abdfb|9019cb56e3751c6b633ae61d57c2927ecbb6b5316619f4d08ae677b34b0b7296"
"supabase/migrations/20261101000600_final_assignment_submission_evidence.sql|8d520861ec840c29d6da7c5b85e84b5dd85aea44|e5e0a9ef242cb81ae4b6cf6505a4078a9eccfadc94a01e45aeb310c4730e452e"
)
case "$MODE" in OLD) N=2 ;; NEW) N=7 ;; *) echo "mode must be OLD or NEW" >&2; exit 2 ;; esac

# Pins are checked for ALL seven before anything is applied, so a drifted later file stops the run up front.
for pin in "${PINS[@]}"; do
  IFS='|' read -r path blob sha <<<"$pin"
  f="$ROOT/$path"
  [ -f "$f" ] || { echo "FAIL pin: missing $path"; exit 1; }
  gotblob=$(git -C "$ROOT" hash-object "$f"); gotsha=$(sha256sum "$f" | cut -d' ' -f1)
  [ "$gotblob" = "$blob" ] && [ "$gotsha" = "$sha" ] || { echo "FAIL pin: $path blob $gotblob sha256 $gotsha (expected $blob / $sha)"; exit 1; }
done
echo "PASS pins: 7/7 blob+sha256 match 9cd162f; applying $N ($MODE)"

psql "$DB" -v ON_ERROR_STOP=1 -qc "create table if not exists local_evidence.applied_migrations (
  seq int primary key, path text not null unique, blob text not null, sha256 text not null, mode text not null,
  applied_at timestamptz not null default clock_timestamp())" || exit 3
i=0
for pin in "${PINS[@]:0:$N}"; do
  i=$((i + 1)); IFS='|' read -r path blob sha <<<"$pin"
  # The migration body and its ledger row commit together or not at all.
  if ! out=$(psql "$DB" -v ON_ERROR_STOP=1 --single-transaction -q -f "$ROOT/$path" \
        -c "insert into local_evidence.applied_migrations (seq, path, blob, sha256, mode) values ($i, '$path', '$blob', '$sha', '$MODE')" 2>&1); then
    echo "FAIL apply $i $path:"; grep -E "ERROR|FATAL" <<<"$out" | head -3; exit 1
  fi
  echo "PASS apply $i $(basename "$path")"
done
got=$(psql "$DB" -Atc "select count(*) || '|' || string_agg(sha256, ',' order by seq) from local_evidence.applied_migrations")
want="$N|$(for pin in "${PINS[@]:0:$N}"; do echo "${pin##*|}"; done | paste -sd,)"
[ "$got" = "$want" ] && echo "PASS ledger: $N rows, sha256 sequence matches" || { echo "FAIL ledger: $got"; exit 1; }
psql "$DB" -v allow_shim="$ALLOW_SHIM" -q -f "$HERE/egress-verify.sql" 2>&1 | grep -E "egress-verify|ERROR" | sed 's/^.*NOTICE: */   /'
[ "${PIPESTATUS[0]}" -eq 0 ] && echo "PASS guard intact after $MODE migrations" || { echo "FAIL guard after $MODE migrations"; exit 1; }
