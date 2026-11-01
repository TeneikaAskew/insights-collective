#!/usr/bin/env bash
# ABOUTME: Causal auth gate for the quiz-lifecycle learner, run AFTER the unchanged original fixture and BEFORE any browser
# ABOUTME: case. Every prerequisite must succeed; the candidate runs only on a justified auth rejection. Fixed lines only.
#
# Sequence (reviewed design; nothing here runs unless a reviewed job is explicitly approved). Any unexpected exit at any
# step BLOCKS: no alignment and no UI after a refusal or a failed prerequisite.
#   1. gotrue-health (read-only): must exit 0 AND report status=200.
#   2. phase=old-seed: auth-state must exit 0 with its fixed line; auth-probe on the ORIGINAL 882 seed:
#        exit 0 (class=pass)            -> no candidate; seed causality NOT claimed; UI may run (masked capture = UI path).
#        exit 3 (class=diagnosis-only)  -> transport/timeout/redirect/non-JSON/wrong user/other: BLOCK, diagnosis only,
#                                          no password rewrite.
#        exit 1 (class=auth-rejected)   -> the candidate is JUSTIFIED only if the OLD state shows the exact row present
#                                          (user_row=true, email_matches=true) AND at least one column the candidate
#                                          changes is NULL. Otherwise BLOCK (auth-rejected-unexplained).
#        exit 4 (internal error) or any other exit -> BLOCK (refused), no alignment.
#   3. candidate: learner-auth-align.sh must exit 0; phase=candidate auth-state must exit 0; probe again:
#        exit 0 -> UI may run, seed_causality=consistent-not-proven; exit 1 or 3 -> BLOCK; any other -> BLOCK (refused).
# Exit 0 only when UI may run; 1 on a blocked diagnosis; 2 on a refusal or failed prerequisite. Last line = verdict.
set -u -o pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
[ $# -eq 0 ] || { echo "auth-gate refused: unexpected argument"; exit 2; }
verdict() { echo "auth-gate old=$1 candidate=$2 justification=$3 seed_causality=$4 ui=$5"; }
block2() { verdict "$1" "$2" "$3" not-claimed blocked; exit 2; }

h=$(node "$HERE/learner-auth-probe.mjs" --health); hs=$?
printf '%s\n' "$h"
[ "$hs" -eq 0 ] && printf '%s\n' "$h" | grep -qE '^gotrue-health method=GET path=/auth/v1/health status=200 ' || block2 health-failed not-applied na

st=$(LQ_AUTH_PROBE_PHASE=old-seed "$HERE/learner-auth-state.sh"); ss=$?
printf '%s\n' "$st"
[ "$ss" -eq 0 ] || block2 state-failed not-applied na
LQ_AUTH_PROBE_PHASE=old-seed node "$HERE/learner-auth-probe.mjs"; p=$?
case "$p" in
  0) verdict pass not-applied na not-claimed run; exit 0 ;;
  3) verdict diagnosis-only not-applied na not-claimed blocked; exit 1 ;;
  1) ;;
  *) block2 refused not-applied na ;;
esac
# Justification: the exact row exists and at least one column the candidate normalizes is NULL in the OLD state.
s1=$(printf '%s\n' "$st" | grep -E '^auth-state ' | head -n 1)
if ! { printf '%s' "$s1" | grep -q ' user_row=true email_matches=true ' \
    && printf '%s' "$s1" | grep -qE ' (instance_id_null|created_at_null|updated_at_null|confirmation_token_null|recovery_token_null|email_change_token_new_null|email_change_null|email_change_token_current_null|phone_change_null|phone_change_token_null|reauthentication_token_null)=true '; }; then
  verdict auth-rejected not-applied none not-claimed blocked; exit 1
fi

"$HERE/learner-auth-align.sh"; a=$?
[ "$a" -eq 0 ] || block2 auth-rejected align-failed null-columns
st2=$(LQ_AUTH_PROBE_PHASE=candidate "$HERE/learner-auth-state.sh"); ss2=$?
printf '%s\n' "$st2"
[ "$ss2" -eq 0 ] || block2 auth-rejected state-failed null-columns
LQ_AUTH_PROBE_PHASE=candidate node "$HERE/learner-auth-probe.mjs"; p=$?
case "$p" in
  0) verdict auth-rejected pass null-columns consistent-not-proven run; exit 0 ;;
  1|3) verdict auth-rejected fail null-columns not-supported blocked; exit 1 ;;
  *) block2 auth-rejected refused null-columns ;;
esac
