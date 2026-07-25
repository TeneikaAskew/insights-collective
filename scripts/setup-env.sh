#!/usr/bin/env bash
# Create or update .env / .env.local from .env.example.
#
# Usage:
#   ./scripts/setup-env.sh            # create missing env files (existing files untouched)
#   ./scripts/setup-env.sh --update   # also sync existing files: append any keys that are
#                                     # new in .env.example, keeping your current values
#
# In both modes, any of the known variables that are set in your shell
# environment override the value written to a created file (and, with
# --update, override the value in an existing file).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_FILE="$ROOT_DIR/.env.example"
LOCAL_FILE="$ROOT_DIR/.env.local"
ENV_FILE="$ROOT_DIR/.env"
UPDATE_MODE=0

if [[ "${1:-}" == "--update" ]]; then
  UPDATE_MODE=1
fi

if [[ ! -f "$EXAMPLE_FILE" ]]; then
  echo "Missing $EXAMPLE_FILE"
  exit 1
fi

# Every KEY= line in the example is a known variable.
mapfile -t KNOWN_VARS < <(grep -E '^[A-Z][A-Z0-9_]*=' "$EXAMPLE_FILE" | cut -d= -f1)

apply_shell_overrides() {
  local target_file="$1"
  local applied=0
  for var_name in "${KNOWN_VARS[@]}"; do
    if [[ -n "${!var_name:-}" ]]; then
      escaped_value=$(printf '%s' "${!var_name}" | sed 's/[\/&|]/\\&/g')
      if grep -q "^${var_name}=" "$target_file"; then
        sed -i "s|^${var_name}=.*$|${var_name}=${escaped_value}|" "$target_file"
      else
        printf '%s=%s\n' "$var_name" "${!var_name}" >> "$target_file"
      fi
      applied=$((applied + 1))
    fi
  done
  if [[ $applied -gt 0 ]]; then
    echo "  applied $applied value(s) from your shell environment"
  fi
}

sync_missing_keys() {
  local target_file="$1"
  local added=0
  for var_name in "${KNOWN_VARS[@]}"; do
    if ! grep -q "^${var_name}=" "$target_file"; then
      grep "^${var_name}=" "$EXAMPLE_FILE" >> "$target_file"
      added=$((added + 1))
    fi
  done
  echo "  added $added new key(s) from .env.example"
}

write_env_file() {
  local target_file="$1"
  local base_name
  base_name="$(basename "$target_file")"

  if [[ -f "$target_file" ]]; then
    if [[ $UPDATE_MODE -eq 1 ]]; then
      echo "Updating existing $base_name"
      sync_missing_keys "$target_file"
      apply_shell_overrides "$target_file"
    else
      echo "Skipping existing $base_name (use --update to sync new keys)"
    fi
    return
  fi

  cp "$EXAMPLE_FILE" "$target_file"
  echo "Created $base_name"
  apply_shell_overrides "$target_file"
}

write_env_file "$LOCAL_FILE"
write_env_file "$ENV_FILE"

echo "Done. Review $ENV_FILE and fill in any remaining blanks (never commit it)."
