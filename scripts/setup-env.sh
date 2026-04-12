#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_FILE="$ROOT_DIR/.env.example"
LOCAL_FILE="$ROOT_DIR/.env.local"
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$EXAMPLE_FILE" ]]; then
  echo "Missing $EXAMPLE_FILE"
  exit 1
fi

write_env_file() {
  local target_file="$1"

  if [[ -f "$target_file" ]]; then
    echo "Skipping existing $(basename "$target_file")"
    return
  fi

  cp "$EXAMPLE_FILE" "$target_file"

  local vars=(
    VITE_SUPABASE_URL
    VITE_SUPABASE_ANON_KEY
    E2E_BASE_URL
    E2E_ADMIN_EMAIL
    E2E_ADMIN_PASSWORD
    E2E_INSTRUCTOR_EMAIL
    E2E_INSTRUCTOR_PASSWORD
    E2E_MEMBER_EMAIL
    E2E_MEMBER_PASSWORD
    E2E_TEST_COURSE_ID
    E2E_TEST_MODULE_ID
    E2E_TEST_LESSON_ID
    E2E_TEST_ASSIGNMENT_ID
    E2E_TEST_QUIZ_ID
    E2E_TEST_SUBMISSION_ID
    E2E_TEST_FORUM_ID
    E2E_TEST_THREAD_ID
    E2E_TEST_EVENT_ID
    E2E_TEST_BLOG_SLUG
    E2E_TEST_SURVEY_SLUG
    E2E_TEST_SURVEY_FORM_ID
    E2E_TEST_FORM_SLUG
    E2E_TEST_PORTFOLIO_ID
    E2E_TEST_PORTFOLIO_URL
    E2E_TEST_ASSISTANT_ID
    E2E_TEST_RUBRIC_ID
    E2E_TEST_ADMIN_COURSE_ID
  )

  for var_name in "${vars[@]}"; do
    if [[ -n "${!var_name:-}" ]]; then
      escaped_value=$(printf '%s' "${!var_name}" | sed 's/[\/&]/\\&/g')
      sed -i "s|^${var_name}=.*$|${var_name}=${escaped_value}|" "$target_file"
    fi
  done

  echo "Created $(basename "$target_file")"
}

write_env_file "$LOCAL_FILE"
write_env_file "$ENV_FILE"
