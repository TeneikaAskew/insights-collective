#!/usr/bin/env bash
# Deletes Edge Function slugs from the Supabase project.
#
# WHY THIS EXISTS SEPARATELY
#
# Deploying a function and deleting one need different things. Deploying happens
# automatically when a commit lands on main — the project redeploys every
# function from the repo. Deleting does not: a slug that exists in the project
# but has no source in the repo is invisible to that pipeline, so it lingers
# until someone removes it explicitly. Three such functions accumulated here.
#
# Nothing in the repo's normal tooling can delete a function. The Supabase MCP
# server exposes deploy, list and get, but no delete. So this needs a personal
# access token, which is a different credential from the service-role key the
# app uses:
#
#   1. Create one at https://supabase.com/dashboard/account/tokens
#   2. export SUPABASE_ACCESS_TOKEN=sbp_...
#   3. ./scripts/model-migration/delete-functions.sh <slug> [slug...]
#
# Deletion is permanent and takes effect immediately — the endpoint stops
# answering. Confirm nothing calls the slug first. A source search only proves
# this frontend does not; other clients, scheduled jobs and integrations will
# not show up in it.

set -euo pipefail

PROJECT_REF="siuqvhscuiycvdrtiqsh"
API="https://api.supabase.com/v1/projects/${PROJECT_REF}/functions"

if [ "$#" -eq 0 ]; then
  cat >&2 <<'USAGE'
usage: delete-functions.sh <slug> [slug...]

Slugs currently deployed with no source in this repo, left over from the
2026-08 Groq model migration:

  resume-services            superseded by resume-analyzer; returns 500
  generate-course-content    superseded by generate-lesson-content; returns 500
  analyze-job-description    superseded by analyze-job-match; stale gpt-4 id

Retired migration harnesses, now inert stubs returning 410:

  model-compare
  model-compare-judge
  model-compare-prompt
  gateway-probe

Nothing here is required. They are dead weight, not a hazard.
USAGE
  exit 2
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "SUPABASE_ACCESS_TOKEN is not set." >&2
  echo "Create one at https://supabase.com/dashboard/account/tokens and export it." >&2
  exit 1
fi

echo "Project: ${PROJECT_REF}"
echo "About to permanently delete: $*"
echo

for slug in "$@"; do
  # Report what is there before removing it, so a typo shows up as a 404 rather
  # than as a silent no-op that reads like success.
  status=$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" "${API}/${slug}")
  if [ "$status" = "404" ]; then
    echo "skip   ${slug} — no such function in this project"
    continue
  fi
  if [ "$status" != "200" ]; then
    echo "skip   ${slug} — unexpected status ${status} looking it up" >&2
    continue
  fi

  code=$(curl -sS -X DELETE -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" "${API}/${slug}")
  case "$code" in
    200|204) echo "delete ${slug} — done" ;;
    *)       echo "delete ${slug} — FAILED (HTTP ${code})" >&2 ;;
  esac
done
