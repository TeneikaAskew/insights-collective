#!/usr/bin/env bash
# ABOUTME: Producer wrapper for the TruffleHog secret scan: same image, range and BASE==HEAD refusal as the official action
# ABOUTME: (scripts/ci/vendor/trufflehog-action.yml), but JSON output kept in a private dir, gated, then removed.
#
# Env: BASE, HEAD (commit-ish or empty; both empty = full history, as on schedule/dispatch in the official action),
#      TH_IMAGE (default ghcr.io/trufflesecurity/trufflehog), TH_VERSION (default latest),
#      TH_EXCEPTIONS (default scripts/ci/trufflehog-exceptions.json), RUNNER_TEMP (private dir parent).
# Exit: the gate's code (0 pass, 1 finding, 2 untrustworthy scan) or 3+ for wrapper refusals. Fails closed throughout.
# Prints only fixed status lines and counts; raw scanner stdout/stderr never reach the job log or any artifact.
set -uo pipefail
umask 077

IMAGE="${TH_IMAGE:-ghcr.io/trufflesecurity/trufflehog}"
VERSION="${TH_VERSION:-latest}"
EXCEPTIONS="${TH_EXCEPTIONS:-scripts/ci/trufflehog-exceptions.json}"
GATE="$(cd "$(dirname "$0")" && pwd -P)/trufflehog-exceptions.mjs"
RAW=""

say() { printf '%s\n' "$*"; }
refuse() { say "::error::trufflehog-scan: $1"; exit "${2:-3}"; }

cleanup() {
  local rc=$?
  if [ -n "$RAW" ]; then
    rm -rf -- "${RAW:?}"
    if [ -e "$RAW" ]; then say "::error::trufflehog-scan: private output dir NOT removed"; rc=9; else say "trufflehog-scan: private output removed"; fi
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

command -v docker >/dev/null 2>&1 || refuse "docker not available (producer missing)" 4
command -v node >/dev/null 2>&1 || refuse "node not available (gate missing)" 4
[ -f "$GATE" ] || refuse "gate script missing" 4
[ -r "$EXCEPTIONS" ] || refuse "exceptions file missing" 4
git status >/dev/null 2>&1 || refuse "not a git work tree" 5
[ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = "false" ] || refuse "shallow clone; full history (fetch-depth: 0) is required" 5

# Range: identical decision to the official action's "Scan by BASE & HEAD" branch, except that a ref which does not
# resolve is refused here (the action passes it on and lets the scanner fail).
base_commit=""; head_commit=""
if [ -n "${BASE:-}" ] || [ -n "${HEAD:-}" ]; then
  if [ -n "${BASE:-}" ]; then base_commit=$(git rev-parse --verify --quiet "${BASE}^{commit}") || refuse "BASE does not resolve to a commit" 6; fi
  if [ -n "${HEAD:-}" ]; then head_commit=$(git rev-parse --verify --quiet "${HEAD}^{commit}") || refuse "HEAD does not resolve to a commit" 6; fi
  if [ "$base_commit" == "$head_commit" ]; then
    say "::error::BASE and HEAD commits are the same. TruffleHog won't scan anything. Please see documentation (https://github.com/trufflesecurity/trufflehog#octocat-trufflehog-github-action)."
    exit 1
  fi
fi

RAW=$(mktemp -d "${RUNNER_TEMP:-/tmp}/trufflehog.XXXXXXXX") || refuse "cannot create private dir" 7
chmod 0700 "$RAW" || refuse "cannot restrict private dir" 7
: > "$RAW/stdout.jsonl" && : > "$RAW/stderr.jsonl" && : > "$RAW/pull.log" || refuse "cannot create private files" 7
chmod 0600 "$RAW/stdout.jsonl" "$RAW/stderr.jsonl" "$RAW/pull.log" || refuse "cannot restrict private files" 7
[ "$(stat -c %a "$RAW")" = "700" ] || refuse "private dir mode is not 0700" 7
for f in stdout.jsonl stderr.jsonl pull.log; do [ "$(stat -c %a "$RAW/$f")" = "600" ] || refuse "private file mode is not 0600" 7; done

docker pull --quiet "${IMAGE}:${VERSION}" >"$RAW/pull.log" 2>&1 || refuse "image pull failed (producer missing)" 8

# Same scanner invocation as the official action apart from output format: --json (machine-readable, gated below)
# instead of --github-actions (annotations). --fail keeps the 183 = "results found" exit contract.
docker run --rm --pull never -v "$PWD:/tmp" -w /tmp "${IMAGE}:${VERSION}" \
  git file:///tmp/ --since-commit "${base_commit}" --branch "${head_commit}" --fail --no-update --json \
  >"$RAW/stdout.jsonl" 2>"$RAW/stderr.jsonl"
producer_rc=$?
say "trufflehog-scan: producer exit ${producer_rc}"

# The gate's own output is fixed text and counts. A PASS must carry the gate's PASS summary as its last line, so a gate
# that exits 0 without evaluating anything (wrong entry point, empty module) cannot pass the scan.
gate_out=$(node "$GATE" "$EXCEPTIONS" "$RAW/stdout.jsonl" "$RAW/stderr.jsonl" "$producer_rc")
gate_rc=$?
printf '%s\n' "$gate_out"
if [ "$gate_rc" -eq 0 ]; then
  last=$(printf '%s\n' "$gate_out" | tail -n 1)
  [[ "$last" =~ ^trufflehog\ gate:\ findings=[0-9]+\ .*\ result=PASS$ ]] || refuse "gate exited 0 without a PASS summary" 10
fi
exit "$gate_rc"
