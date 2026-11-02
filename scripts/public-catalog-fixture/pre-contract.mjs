// ABOUTME: Gate for the owned-stack PRE contract (database egress interception installed before any seed or write). This lane
// ABOUTME: CONSUMES the shared owner's reviewed contract and never writes its own; with no integrated contract the run is BLOCKED.
//
// The PR134 runner owner named (00:10Z) the T09 PRE contract, which KEEPS pg_net and intercepts its queue (it does not refuse or
// uninstall it). Its files are on claude/t09-runtime-harness (c64a8fc, #140) and claude/quiz-noedge-authgate-f2112ce, NOT on main:
//   scripts/local-stack/t09/egress-guard.sql 4775946e, egress-sentinels.sql 5693cf5e, egress-verify.sql 17a9c24f,
//   stack-checks.sh 9657af04 (net-create, net-verify, stage-pre, owned-stop, net-remove, leftovers, stage-evidence).
// Its own scope: the database's pg_net path only; runner/container egress is not controlled ("intercepted, not verified").
// Integration means a composed runner ref carrying those blobs plus a reviewed call order for this lane. Until that exists the
// table below stays EMPTY and every run refuses. It is deliberately not filled from the expected list above.
import { checkHelperPins } from './helper-pins.mjs';

export const PRE_CONTRACT_PINS = Object.freeze({});
export const EXPECTED_T09_PRE = Object.freeze({
  'scripts/local-stack/t09/egress-guard.sql': '4775946e',
  'scripts/local-stack/t09/egress-sentinels.sql': '5693cf5e',
  'scripts/local-stack/t09/egress-verify.sql': '17a9c24f',
  'scripts/local-stack/t09/stack-checks.sh': '9657af04',
});

export function checkPreContract(root) {
  if (!Object.keys(PRE_CONTRACT_PINS).length) return ['PUBLIC_CATALOG_E_BLOCKED_NO_PRE_CONTRACT: no integrated, reviewed owned-stack PRE contract'];
  return checkHelperPins(root, PRE_CONTRACT_PINS);
}
