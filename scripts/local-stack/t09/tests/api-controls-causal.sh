#!/usr/bin/env bash
# ABOUTME: CAUSAL fault-injection controls for the API case judgement (review H1): a refused prerequisite or a malformed 4xx must
# ABOUTME: make the case INVALID, never PASS. Each fault is injected by the MOCKED layer (MOCK_INJECT) on a LOCAL-SHIM run.
# Usage: api-controls-causal.sh <t09 dir under test> <loopback maintenance url> <template db>
#   The SAME three faults are run against whichever revision's t09 dir is given (the candidate, or an older revision for the
#   before/after receipt). The mock used is always THIS checkout's tests/mock-stack.mjs (the only one with MOCK_INJECT); it is
#   copied over the revision under test's mock for the duration of the run and restored afterwards.
#   F1 OLD      staff grading PATCH for E9 answered 403/42501      -> E9 must be INVALID (the prerequisite never held)
#   F2 NEW      L1's page-completion POST answered 400/PGRST102   -> L1 must be INVALID (the trigger never fired)
#   F3 OLD+NEW  J's grading PATCH for K2 answered 400/PGRST204    -> K2 must be INVALID (arbitrary 4xx is not protection)
# Fault injection is FAKE by construction: no rule ever reaches the database; this is not an evidence run.
set -u
UNDER="$(cd "${1:?t09 dir under test}" && pwd)"; BASE="${2:?maintenance url}"; TEMPLATE="${3:?template}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MOCK="$UNDER/tests/mock-stack.mjs"; SAVED=$(mktemp)
cp "$MOCK" "$SAVED"; trap 'cp "$SAVED" "$MOCK"; rm -f "$SAVED"' EXIT
[ "$HERE/mock-stack.mjs" -ef "$MOCK" ] || cp "$HERE/mock-stack.mjs" "$MOCK"
LA_P='7b000000-0000-4000-8000-000000000102'   # course LA page (api-controls fixture id)
pass=0; fail=0
fault() { # label mode case rule-json
  local label="$1" mode="$2" cid="$3" rule="$4" out line
  out=$(MOCK_INJECT="[$rule]" "$UNDER/local-shim-run.sh" "$BASE" "$TEMPLATE" "$mode" api 2>&1)
  grep -q 'FAULT INJECTION' <<<"$out" || true
  line=$(grep -E "^(PASS|FAIL|INVALID) $cid " <<<"$out" | head -1)
  if [ -z "$line" ]; then echo "FAIL $label $mode: case $cid produced no line (run did not reach the API tier)"; fail=$((fail + 1)); return; fi
  case "$line" in
    INVALID*) echo "PASS $label $mode: $cid judged INVALID under the fault :: ${line:0:260}"; pass=$((pass + 1)) ;;
    *)        echo "FAIL $label $mode: $cid judged ${line%% *} under the fault (a fault must never count) :: ${line:0:260}"; fail=$((fail + 1)) ;;
  esac
}
fault F1 OLD E9 '{"method":"PATCH","path":"/rest/v1/assignment_submissions","body":"\"grade\":\"0\"","status":403,"reply":{"code":"42501","message":"permission denied (injected)"}}'
fault F2 NEW L1 "{\"method\":\"POST\",\"path\":\"/rest/v1/content_item_progressions\",\"body\":\"$LA_P\",\"status\":400,\"reply\":{\"code\":\"PGRST102\",\"message\":\"malformed (injected)\"}}"
fault F3 OLD K2 '{"method":"PATCH","path":"/rest/v1/assignment_submissions","body":"\"grade\":\"9\"","status":400,"reply":{"code":"PGRST204","message":"malformed (injected)"}}'
fault F3 NEW K2 '{"method":"PATCH","path":"/rest/v1/assignment_submissions","body":"\"grade\":\"9\"","status":400,"reply":{"code":"PGRST204","message":"malformed (injected)"}}'
echo "== api-controls causal faults (MOCKED layer, injected) against $UNDER: $pass PASS, $fail FAIL"
[ $fail -eq 0 ]
