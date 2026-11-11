#!/usr/bin/env bash
# ABOUTME: Control-flow selftest of auth-gate.sh with FAKE components (no database, no network, no GoTrue): a byte-identical
# ABOUTME: copy of the gate runs beside fake health/state/align/probe scripts whose exit codes and lines each case sets.
# Proves: every prerequisite must succeed (exits 1, 2, 126, 127 of health/state/align at OLD and NEW block), the
# candidate runs only on a justified auth rejection, diagnosis-only outcomes never align, and blocked runs never say ui=run.
set -u
umask 077
HERE="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cp "$HERE/auth-gate.sh" "$T/auth-gate.sh"
cmp -s "$HERE/auth-gate.sh" "$T/auth-gate.sh" || { echo "FAIL copy differs"; exit 1; }
# Fakes. Each records that it ran in $FAKE_LOG; its exit code and line come from the case's environment.
cat > "$T/learner-auth-probe.mjs" <<'JS'
import fs from 'node:fs';
const phase = process.env.LQ_AUTH_PROBE_PHASE ?? 'none';
if (process.argv[2] === '--health') {
  fs.appendFileSync(process.env.FAKE_LOG, 'health\n');
  console.log(`gotrue-health method=GET path=/auth/v1/health status=${process.env.FAKE_HEALTH_STATUS ?? '200'} version=v2.999.0`);
  process.exit(Number(process.env.FAKE_HEALTH_EXIT ?? 0));
}
fs.appendFileSync(process.env.FAKE_LOG, `probe:${phase}\n`);
const rc = Number(process.env[phase === 'candidate' ? 'FAKE_PROBE_NEW' : 'FAKE_PROBE_OLD'] ?? 0);
console.log(`auth-probe fake rc=${rc} phase=${phase}`);
process.exit(rc);
JS
cat > "$T/learner-auth-state.sh" <<'SH'
#!/usr/bin/env bash
echo "state:$LQ_AUTH_PROBE_PHASE" >> "$FAKE_LOG"
if [ "$LQ_AUTH_PROBE_PHASE" = candidate ]; then rc=${FAKE_STATE_NEW:-0}; else rc=${FAKE_STATE_OLD:-0}; fi
[ "$rc" = 126 ] && { echo "simulated not-executable"; exit 126; }
[ "$rc" = 127 ] && { echo "simulated not-found"; exit 127; }
echo "auth-state user_row=${FAKE_ROW:-true} email_matches=true instance_id_null=false aud_authenticated=true role_authenticated=true password_hash_present=true email_confirmed=true created_at_null=false updated_at_null=false confirmation_token_null=false recovery_token_null=false email_change_token_new_null=false email_change_null=false email_change_token_current_null=false phone_change_null=${FAKE_NULLS:-true} phone_change_token_null=false reauthentication_token_null=false banned=false deleted=false identity_rows=one phase=$LQ_AUTH_PROBE_PHASE"
exit "$rc"
SH
cat > "$T/learner-auth-align.sh" <<'SH'
#!/usr/bin/env bash
echo "align" >> "$FAKE_LOG"
exit "${FAKE_ALIGN:-0}"
SH
chmod 755 "$T"/*.sh
fails=0; n=0
# case <name> <expected exit> <expected verdict prefix> <expected run log, comma-separated> [VAR=value ...]
case_() {
  local name=$1 xrc=$2 xv=$3 xlog=$4; shift 4
  n=$((n + 1)); : > "$T/log"
  out=$(env -i PATH="$PATH" FAKE_LOG="$T/log" "$@" "$T/auth-gate.sh" 2>&1); rc=$?
  log=$(paste -sd, "$T/log")
  last=$(printf '%s\n' "$out" | tail -n 1)
  if [ "$rc" = "$xrc" ] && [ "${last#"$xv"}" != "$last" ] && [ "$log" = "$xlog" ] \
     && { [ "$rc" = 0 ] || ! printf '%s' "$last" | grep -q 'ui=run'; }; then echo "ok   $name"
  else echo "FAIL $name: rc=$rc want $xrc; last='$last' want '$xv…'; ran '$log' want '$xlog'"; fails=$((fails + 1)); fi
}
H=health; O="health,state:old-seed,probe:old-seed"; C="$O,align,state:candidate,probe:candidate"
case_ old-pass                 0 "auth-gate old=pass candidate=not-applied justification=na seed_causality=not-claimed ui=run" "$O"
case_ old-pass-no-nulls        0 "auth-gate old=pass candidate=not-applied" "$O" FAKE_NULLS=false
for e in 1 2 126 127; do
  case_ "health exit $e"       2 "auth-gate old=health-failed candidate=not-applied" "$H" FAKE_HEALTH_EXIT=$e
  case_ "OLD state exit $e (probe would pass)" 2 "auth-gate old=state-failed candidate=not-applied" "health,state:old-seed" FAKE_STATE_OLD=$e FAKE_PROBE_OLD=0
  case_ "align exit $e"        2 "auth-gate old=auth-rejected candidate=align-failed" "$O,align" FAKE_PROBE_OLD=1 FAKE_ALIGN=$e
  case_ "NEW state exit $e (probe would pass)" 2 "auth-gate old=auth-rejected candidate=state-failed" "$O,align,state:candidate" FAKE_PROBE_OLD=1 FAKE_STATE_NEW=$e FAKE_PROBE_NEW=0
done
case_ "health status 500 exit 0" 2 "auth-gate old=health-failed" "$H" FAKE_HEALTH_STATUS=500
for e in 2 126 127 4; do
  case_ "OLD probe exit $e"    2 "auth-gate old=refused candidate=not-applied" "$O" FAKE_PROBE_OLD=$e
  case_ "NEW probe exit $e"    2 "auth-gate old=auth-rejected candidate=refused" "$C" FAKE_PROBE_OLD=1 FAKE_PROBE_NEW=$e
done
case_ "OLD probe internal error (exit 4) never aligns" 2 "auth-gate old=refused candidate=not-applied justification=na" "$O" FAKE_PROBE_OLD=4
case_ "OLD diagnosis-only (exit 3) never aligns" 1 "auth-gate old=diagnosis-only candidate=not-applied justification=na seed_causality=not-claimed ui=blocked" "$O" FAKE_PROBE_OLD=3
case_ "OLD auth-rejected, no NULL column: unexplained, no align" 1 "auth-gate old=auth-rejected candidate=not-applied justification=none seed_causality=not-claimed ui=blocked" "$O" FAKE_PROBE_OLD=1 FAKE_NULLS=false
case_ "OLD auth-rejected, row absent: no align" 1 "auth-gate old=auth-rejected candidate=not-applied justification=none" "$O" FAKE_PROBE_OLD=1 FAKE_ROW=false
case_ "justified candidate passes" 0 "auth-gate old=auth-rejected candidate=pass justification=null-columns seed_causality=consistent-not-proven ui=run" "$C" FAKE_PROBE_OLD=1 FAKE_PROBE_NEW=0
case_ "justified candidate still rejected" 1 "auth-gate old=auth-rejected candidate=fail justification=null-columns seed_causality=not-supported ui=blocked" "$C" FAKE_PROBE_OLD=1 FAKE_PROBE_NEW=1
case_ "justified candidate diagnosis-only" 1 "auth-gate old=auth-rejected candidate=fail" "$C" FAKE_PROBE_OLD=1 FAKE_PROBE_NEW=3
n=$((n + 1)); : > "$T/log"
out=$(env -i PATH="$PATH" FAKE_LOG="$T/log" "$T/auth-gate.sh" extra 2>&1); rc=$?
if [ "$rc" = 2 ] && [ "$out" = "auth-gate refused: unexpected argument" ] && [ ! -s "$T/log" ]; then echo "ok   unexpected argument refused before any step"
else echo "FAIL unexpected argument"; fails=$((fails + 1)); fi
[ "$fails" -eq 0 ] && echo "PASS auth-gate fake selftest: $n cases" || { echo "FAIL auth-gate fake selftest: $fails of $n"; exit 1; }
