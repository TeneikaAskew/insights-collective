#!/usr/bin/env bash
# ABOUTME: Applies ONE migration file and its ledger row atomically. The ledger INSERT runs FIRST inside psql's
# ABOUTME: --single-transaction, so a file's own top-level BEGIN...COMMIT (WRAPPED shape) commits both together.
# Usage: PGURL=... apply-atomic.sh <migration file> <version = the filename's leading digits>
#
# Why this order: with `-f FILE -c ledger` (the frozen order), a WRAPPED file's own COMMIT commits the schema change
# BEFORE the ledger INSERT runs; a failure or disconnect there leaves an applied-but-unrecorded schema. With the ledger
# first, everything up to the file's final COMMIT is one transaction: any failure before it rolls back BOTH. Files of any
# other top-level transaction shape are refused (txn-control.mjs), so no file can commit part of itself early.
# The file's bytes are executed unchanged; their sha256 is printed before and must match the reviewed identity.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
FILE="${1:?file}"; VERSION="${2:?version}"
[[ "$VERSION" =~ ^[0-9]{14}$ ]] && [[ "$(basename "$FILE")" == "${VERSION}_"* ]] || { echo "APPLY REFUSED [30]: version is not the filename's leading 14 digits"; exit 30; }
: "${PGURL:?PGURL}"
node "$HERE/txn-control.mjs" "$FILE"
echo "APPLY file sha256 $(sha256sum "$FILE" | cut -d' ' -f1) version $VERSION"
psql "$PGURL" -X -q -v ON_ERROR_STOP=1 --single-transaction \
  -c "insert into supabase_migrations.schema_migrations (version) values ('$VERSION')" \
  -f "$FILE"
n=$(psql "$PGURL" -X -At -v ON_ERROR_STOP=1 -c "select count(*) from supabase_migrations.schema_migrations where version = '$VERSION'")
[ "$n" = 1 ] || { echo "APPLY FAILED [31]: ledger holds $n rows for $VERSION after apply"; exit 31; }
echo "Applied and recorded $VERSION in one transaction."
