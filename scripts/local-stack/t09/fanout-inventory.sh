#!/usr/bin/env bash
# ABOUTME: Frozen SOURCE inventory for email_notification_fanout: proves from the schema snapshot and the seven pinned T-09
# ABOUTME: migrations that no trigger attaches the function. Pure file check, no database. Fails on any reappearance.
# Usage: fanout-inventory.sh   (run from anywhere; reads files under the repository root only)
# Provenance printed for review: the historical application trigger was created by 20260810142118 and dropped by
# 20260816000000. Neither is replayed by this harness; the trigger is never restored or dropped to test it.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
SNAP="$ROOT/scripts/local-stack/schema"
FILES=("$SNAP/01_types_tables.sql" "$SNAP/02_constraints_indexes_views.sql" "$SNAP/03_functions.sql"
       "$SNAP/04_rls_policies.sql" "$SNAP/05_triggers_grants.sql")
# The seven reviewed migrations, by the same paths apply-reviewed.sh pins (their blobs are checked there).
while IFS= read -r p; do FILES+=("$ROOT/$p"); done < <(sed -nE 's/^"(supabase\/migrations\/[^|]+)\|.*/\1/p' "$HERE/apply-reviewed.sh")
[ "${#FILES[@]}" -eq 12 ] || { echo "FAIL inventory: expected 5 snapshot files + 7 pinned migrations, got ${#FILES[@]}"; exit 1; }
RC=0
for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "FAIL inventory: missing ${f#"$ROOT"/}"; exit 1; }
  # Any CREATE [CONSTRAINT] TRIGGER statement (joined across lines up to its ';') that executes the function.
  hits=$(tr '\n' ' ' <"$f" | grep -oiE "create( or replace)?( constraint)? trigger[^;]*email_notification_fanout[^;]*;" | wc -l)
  if [ "$hits" -ne 0 ]; then echo "FAIL inventory: ${f#"$ROOT"/} attaches email_notification_fanout ($hits trigger statement(s))"; RC=1; fi
done
# Positive control: the matcher does find the historical attachment, so a zero above is not a blind matcher.
HIST="$ROOT/supabase/migrations/20260810142118_f8bda28b-f4a3-4858-9a4d-c7c320cc71ce.sql"
DROP="$ROOT/supabase/migrations/20260816000000_notification_email_digest.sql"
if [ -f "$HIST" ] && [ -f "$DROP" ]; then
  h=$(tr '\n' ' ' <"$HIST" | grep -oiE "create( or replace)?( constraint)? trigger[^;]*email_notification_fanout[^;]*;" | wc -l)
  d=$(grep -ciE "drop trigger if exists trg_email_notification_fanout on public\.notifications" "$DROP")
  [ "$h" -ge 1 ] && [ "$d" -eq 1 ] || { echo "FAIL inventory control: historical create=$h drop=$d (matcher or provenance changed)"; RC=1; }
  echo "provenance: created in ${HIST##*/} ($h statement), dropped in ${DROP##*/}; neither replayed here"
else
  echo "FAIL inventory control: provenance files missing"; RC=1
fi
[ $RC -eq 0 ] && echo "PASS fanout inventory: 0 attaching trigger statements in 5 snapshot files + 7 pinned migrations"
exit $RC
