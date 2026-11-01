#!/usr/bin/env bash
# ABOUTME: Causal auth gate for the quiz-lifecycle learner, run AFTER the unchanged original fixture and BEFORE any browser
# ABOUTME: case: OLD-seed state+probe; only if that fails, the candidate alignment, then state+probe again. Fixed lines only.
#
# Sequence (reviewed design; nothing here runs unless a reviewed job is explicitly approved):
#   1. gotrue-health (read-only; version token only)
#   2. auth-state + auth-probe, phase=old-seed      (the ORIGINAL 882 seed, unmodified)
#   3. OLD PASS  -> no candidate is applied; seed causality is NOT claimed; UI cases may run (the failure is then in the
#                   UI path, which the masked login capture records).
#      OLD FAIL  -> learner-auth-align.sh (candidate = shared auth-fixtures rule set), then auth-state + auth-probe,
#                   phase=candidate. CANDIDATE PASS -> UI cases may run; the line says consistent-not-proven, never proven.
#                   CANDIDATE FAIL -> UI cases are blocked (exit 1).
#      REFUSAL (exit 2) at any point -> blocked; nothing further runs.
# Exit 0 only when one probe passed. The last line is the fixed gate verdict.
set -u -o pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
[ $# -eq 0 ] || { echo "auth-gate refused: unexpected argument"; exit 2; }
verdict() { echo "auth-gate old=$1 candidate=$2 seed_causality=$3 ui=$4"; }

node "$HERE/learner-auth-probe.mjs" --health || { verdict refused not-applied not-claimed blocked; exit 2; }

LQ_AUTH_PROBE_PHASE=old-seed "$HERE/learner-auth-state.sh"; s=$?
case "$s" in 2|3|4) verdict refused not-applied not-claimed blocked; exit 2 ;; esac
LQ_AUTH_PROBE_PHASE=old-seed node "$HERE/learner-auth-probe.mjs"; p=$?
if [ "$p" -eq 0 ]; then verdict pass not-applied not-claimed run; exit 0; fi
if [ "$p" -ne 1 ]; then verdict refused not-applied not-claimed blocked; exit 2; fi

"$HERE/learner-auth-align.sh"; a=$?
if [ "$a" -ne 0 ]; then verdict fail align-failed not-claimed blocked; [ "$a" -eq 1 ] && exit 1; exit 2; fi
LQ_AUTH_PROBE_PHASE=candidate "$HERE/learner-auth-state.sh"
LQ_AUTH_PROBE_PHASE=candidate node "$HERE/learner-auth-probe.mjs"; p=$?
if [ "$p" -eq 0 ]; then verdict fail pass consistent-not-proven run; exit 0; fi
verdict fail fail not-supported blocked
exit 1
