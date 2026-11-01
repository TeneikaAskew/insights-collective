Fixtures for `scripts/ci/check-npm-audit.mjs` (tests: `src/test/__tests__/checkNpmAudit.test.ts`).

- `real-99f81e3e-omit-dev.json`: unedited output of `npm audit --omit=dev --json` on main `99f81e3e`
  (npm 10.9.9, node 22.23.4, 2026-10-31); exit status 1; 1 critical, 4 high, 5 moderate.
- `real-error-econnrefused.json`: unedited output of the same command with `--registry=http://127.0.0.1:9/`
  (registry unreachable); exit status 1. This is the shape the old `jq '.metadata.vulnerabilities.high // 0'`
  read as zero.
- `real-4caf417-omit-dev-moderate-only.json`: unedited `npm audit --omit=dev --json` on the dependency branch
  `4caf417` (npm 10.9.9); exit status 1; 0 critical, 0 high, 5 moderate. Used to prove that a moderate-only
  report passes only with status 1 and fails closed on any other status.
- `synthetic/`: hand-written controls. Every uncontrolled field (error code/summary/message/detail, invalid JSON
  text, version, a count) carries the sentinel `AUDIT_SENTINEL_9f3c1e7b`, which stands in for a credential that a
  registry URL or token could leak; the gate must never print it. `vulns-array-clean.json` has
  `vulnerabilities: []`, which must be refused (only an object map is a valid report).
