#!/usr/bin/env bash
# ABOUTME: Prepares a DISPOSABLE Supabase CLI workdir for the isolated local stack: the repository's
# ABOUTME: config.toml copied unchanged (project_id stays the production ref = the guard's deny identity),
# ABOUTME: NO historical migrations (28 of 233 replay; they must never run before the snapshot bootstrap),
# ABOUTME: default seed disabled, Edge Functions linked read-only. Prints the start command; never runs it.
# Usage: scripts/local-stack/workdir.sh [/tmp/ic-local-stack]
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; W="${1:-/tmp/ic-local-stack}"
rm -rf "$W"; mkdir -p "$W/supabase"
cp "$ROOT/supabase/config.toml" "$W/supabase/config.toml"
# Belt and braces: the CLI applies supabase/migrations and seed.sql on `supabase start`/`db reset`.
# There is no migrations directory in this workdir, and the seed is disabled explicitly.
grep -q '^\[db.seed\]' "$W/supabase/config.toml" || printf '\n[db.seed]\nenabled = false\n' >> "$W/supabase/config.toml"
mkdir -p "$W/supabase/migrations"   # present but EMPTY, so the CLI has nothing to apply
ln -s "$ROOT/supabase/functions" "$W/supabase/functions"
grep -q 'project_id = "' "$W/supabase/config.toml" && echo "config.toml copied unchanged (project_id preserved as the deny identity)"
echo "workdir: $W  (migrations: $(ls "$W/supabase/migrations" | wc -l) files; seed disabled; functions linked)"
echo "NOT RUN BY THIS SCRIPT. On a Docker-capable machine, in order:"
echo "  1. supabase start --workdir $W            # local only; no --linked, no remote commands"
echo "  2. scripts/local-stack/bootstrap.sh \"\$SUPABASE_DB_URL\"   # the loopback DSN from 'supabase status -o env --workdir $W'; never typed in by hand"
echo "  3. scripts/e2e/seed.sh (with loopback targets from 'supabase status -o env --workdir $W')"
