#!/usr/bin/env bash
# Deploys the Edge Functions touched by the Groq model migration, from disk.
#
# Deploying from disk matters here: these functions embed large prompt templates
# with backticks and ${} interpolation, and a transcription error in a prompt
# does not fail loudly — it degrades the output silently, which is the failure
# mode this migration exists to remove.
#
# Requires a Supabase personal access token:
#   export SUPABASE_ACCESS_TOKEN=...        # supabase.com/dashboard/account/tokens
#   ./scripts/model-migration/deploy-functions.sh
#
# Deploy a subset by naming them:
#   ./scripts/model-migration/deploy-functions.sh assistant-ai review-code

set -euo pipefail

PROJECT_REF="siuqvhscuiycvdrtiqsh"
DEFAULT_FUNCTIONS=(
  review-code              # phase 2 — decommissioned llama-3.3-70b-versatile
  assistant-ai             # phase 1 — decommissioned llama3-8b-8192
  evaluate-star-response   # phase 1 — decommissioned llama3-8b-8192
  generate-study-guide     # phase 1 — decommissioned llama3-8b-8192
)

if [ "$#" -gt 0 ]; then
  FUNCTIONS=("$@")
else
  FUNCTIONS=("${DEFAULT_FUNCTIONS[@]}")
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "SUPABASE_ACCESS_TOKEN is not set." >&2
  echo "Create one at https://supabase.com/dashboard/account/tokens and export it." >&2
  exit 1
fi

cd "$(dirname "$0")/../.."

for fn in "${FUNCTIONS[@]}"; do
  if [ ! -f "supabase/functions/$fn/index.ts" ]; then
    echo "skip $fn — no source at supabase/functions/$fn/index.ts" >&2
    continue
  fi
  echo "deploying $fn ..."
  npx --yes supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

echo
echo "Deployed: ${FUNCTIONS[*]}"
echo "Verify with: node scripts/model-migration/validate-review-code.mjs"
