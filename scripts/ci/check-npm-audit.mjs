#!/usr/bin/env node
// ABOUTME: Fail-closed gate over `npm audit --json` output plus npm's exit status. Only a well-formed v2 report
// ABOUTME: whose status is a documented 0/1 consistent with its counts can pass; every message is redacted.
//
// Replaces `jq '.metadata.vulnerabilities.high // 0'`, which turned a registry/network/lockfile error into
// "0 high, 0 critical" and a green gate. Threshold unchanged: any high or critical production advisory fails;
// moderate/low/info are reported (visibility) and do not fail.
//
// npm exit status (measured with npm 10.9.9): 0 = report lists no advisories; 1 = report lists advisories, or
// npm failed and printed {"error": ...}. Any other status (2, 127 command missing, 137 killed, negative), or a
// status that is absent, empty or not exactly "0"/"1", means the command did not run as documented: unusable.
//
// Diagnostics never echo input: report fields, parse errors, error codes/summaries, versions, counts, the status
// argument and the file path are all uncontrolled and may carry secrets from a registry URL or token. Messages
// name only the failed check; validated integer counts are the only values printed.
//
// Usage: node scripts/ci/check-npm-audit.mjs <audit.json> <npm-exit-status>
//   AUDIT_GATE_MODE=visibility: findings are reported as warnings (exit 1 still returned for the caller to
//   accept); an unusable report is an error in every mode.
// Exit: 0 pass; 1 high/critical found; 2 unusable.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical', 'total'];
const isPlainObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const unusable = (reason) => ({ code: 2, reason });

/** Accepts only the exact strings "0" / "1" (or the numbers 0 / 1); anything else is null. */
export function parseNpmStatus(raw) {
  if (raw === 0 || raw === 1) return raw;
  if (raw === '0') return 0;
  if (raw === '1') return 1;
  return null;
}

export function evaluateAudit(text, npmStatus) {
  const status = parseNpmStatus(npmStatus);
  if (status === null) return unusable('npm exit status is missing or not a documented 0/1 value');
  if (typeof text !== 'string' || text.trim() === '') return unusable('audit output is empty');
  let report;
  try { report = JSON.parse(text); } catch { return unusable('audit output is not valid JSON'); }
  if (!isPlainObject(report)) return unusable('audit output is not a JSON object');
  if ('error' in report) return unusable('npm audit reported an error object (details withheld)');
  if (report.auditReportVersion !== 2) return unusable('auditReportVersion is not 2');
  const v = isPlainObject(report.metadata) ? report.metadata.vulnerabilities : undefined;
  if (!isPlainObject(v)) return unusable('metadata.vulnerabilities is missing or not an object');
  for (const k of SEVERITIES) {
    if (!Number.isSafeInteger(v[k]) || v[k] < 0) return unusable(`metadata.vulnerabilities.${k} is not a non-negative integer`);
  }
  if (v.info + v.low + v.moderate + v.high + v.critical !== v.total) return unusable('severity counts do not add up to total');
  if (!isPlainObject(report.vulnerabilities)) return unusable('vulnerabilities is missing or not an object map');
  const advisories = v.low + v.moderate + v.high + v.critical;
  if (status === 1 && v.total === 0) return unusable('npm exited 1 but the report lists no advisories');
  if (status === 0 && advisories > 0) return unusable('npm exited 0 but the report lists advisories');
  const counts = { critical: v.critical, high: v.high, moderate: v.moderate, low: v.low, info: v.info };
  const tally = `critical ${v.critical}, high ${v.high}, moderate ${v.moderate}, low ${v.low}, info ${v.info}`;
  if (v.high > 0 || v.critical > 0) return { code: 1, reason: `high/critical advisories found (${tally})`, counts };
  return { code: 0, reason: `no high or critical advisories (${tally})`, counts };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  if (args.length !== 2) { console.log('::error::usage: check-npm-audit.mjs <audit.json> <npm-exit-status>'); process.exit(2); }
  let text;
  try { text = readFileSync(args[0], 'utf8'); } catch { console.log('::error::audit report file cannot be read'); process.exit(2); }
  const r = evaluateAudit(text, args[1]);
  const level = r.code === 1 && process.env.AUDIT_GATE_MODE === 'visibility' ? 'warning' : 'error';
  console.log(r.code === 0 ? r.reason : `::${level}::${r.reason}`);
  process.exit(r.code);
}
