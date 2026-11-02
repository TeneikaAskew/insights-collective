#!/usr/bin/env node
// ABOUTME: Strict gate over one TruffleHog --json scan: stdout must be well-formed git findings, stderr well-formed logs
// ABOUTME: ending in "finished scanning"; only an APPROVED exact-identity exception may pass an unverified finding.
//
// Usage: trufflehog-exceptions.mjs <exceptions.json> <stdout.jsonl> <stderr.jsonl> <producer-exit-code>
//
// Exit 0  every finding (if any) is an unverified finding at an APPROVED exact exception, and the producer finished.
// Exit 1  any other finding: unexcepted, VERIFIED (even at an excepted identity), or only covered by a PENDING entry.
// Exit 2  the scan cannot be trusted: usage, bad exceptions file, malformed finding, non-git source, error/fatal or
//         malformed log line, missing "finished scanning", producer exit code other than 0/183, or exit/finding mismatch.
//
// Output is fixed text plus counts and 12-hex identity digests. No scanner-provided field (commit, path, detector name,
// message, Raw, RawV2, Redacted, ExtraData, ...) is ever printed; exception ids come from the reviewed file, not the scan.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const MAX_LISTED = 20;
const SOURCE_TYPE_GIT = 16;
const EX_KEYS = new Set(['id', 'commit', 'file', 'line', 'detector', 'verified', 'reason', 'reviewed']);
const APPROVAL_KEYS = ['approvedBy', 'approvedAt', 'approvalRef'];
const FINDING_KEYS = ['SourceMetadata', 'SourceID', 'SourceType', 'SourceName', 'DetectorType', 'DetectorName',
  'DetectorDescription', 'DecoderName', 'Verified', 'VerificationError', 'VerificationFromCache', 'Raw', 'RawV2',
  'Redacted', 'ExtraData', 'StructuredData', 'SecretParts'];
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[A-Za-z0-9._\-/]+$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

/** Approval provenance is either the literal "PENDING" (inactive) or a complete record written AFTER approval. */
export function approvalState(reviewed) {
  if (reviewed === 'PENDING') return 'pending';
  if (isObj(reviewed) && Object.keys(reviewed).length === APPROVAL_KEYS.length
    && APPROVAL_KEYS.every((k) => nonEmpty(reviewed[k]))
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(reviewed.approvedAt)) return 'approved';
  return 'invalid';
}

export function loadExceptions(text) {
  const doc = JSON.parse(text);
  if (!isObj(doc) || !Array.isArray(doc.exceptions)) throw new Error('exceptions: missing array');
  const ids = new Set();
  return doc.exceptions.map((e) => {
    if (!isObj(e) || Object.keys(e).some((k) => !EX_KEYS.has(k))) throw new Error('exceptions: unexpected key');
    if (!nonEmpty(e.id) || !/^[A-Z0-9-]{1,64}$/.test(e.id) || ids.has(e.id)) throw new Error('exceptions: bad or duplicate id');
    ids.add(e.id);
    if (!/^[0-9a-f]{40}$/.test(e.commit ?? '') || !nonEmpty(e.file) || !SAFE_PATH.test(e.file)
      || !Number.isInteger(e.line) || e.line < 1 || !/^[A-Za-z0-9]{1,64}$/.test(e.detector ?? '')
      || e.verified !== false || !nonEmpty(e.reason)) {
      throw new Error('exceptions: entry is not an exact unverified commit/file/line/detector identity');
    }
    const state = approvalState(e.reviewed);
    if (state === 'invalid') throw new Error('exceptions: reviewed must be "PENDING" or a complete approval record');
    return { ...e, state };
  });
}

/** Strict typed identity of one finding, or null when the object is not a complete git finding. */
export function identity(f) {
  if (!isObj(f) || !isObj(f.SourceMetadata) || !isObj(f.SourceMetadata.Data)) return null;
  const data = f.SourceMetadata.Data;
  if (Object.keys(data).length !== 1 || !isObj(data.Git)) return null;
  const g = data.Git;
  if (typeof g.commit !== 'string' || !/^[0-9a-f]{40}$/.test(g.commit)) return null;
  if (!nonEmpty(g.file) || !Number.isSafeInteger(g.line) || g.line < 1) return null;
  if (f.SourceType !== SOURCE_TYPE_GIT) return null;
  if (!nonEmpty(f.DetectorName) || !Number.isInteger(f.DetectorType) || f.DetectorType < 0) return null;
  if (!nonEmpty(f.DecoderName) || typeof f.Verified !== 'boolean') return null;
  return { commit: g.commit, file: g.file, line: g.line, detector: f.DetectorName, verified: f.Verified };
}

export const digest = (id) => crypto.createHash('sha256')
  .update(JSON.stringify([id.commit, id.file, id.line, id.detector, id.verified])).digest('hex').slice(0, 12);

/** stderr: every nonblank line must be a JSON log record at an info-N level; exactly one is "finished scanning". */
export function checkLogs(lines) {
  let finished = 0; let bad = 0; let errors = 0;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    let o; try { o = JSON.parse(raw); } catch { bad++; continue; }
    if (!isObj(o) || typeof o.level !== 'string' || typeof o.msg !== 'string' || FINDING_KEYS.some((k) => k in o)) { bad++; continue; }
    if (!/^info-\d+$/.test(o.level)) { errors++; continue; } // "error", "fatal", "warn" or anything else refuses
    if (o.msg === 'finished scanning') finished++;
  }
  return { finished, bad, errors };
}

export function evaluate({ stdoutLines, stderrLines, exitCode, exceptions }) {
  const r = { code: 0, reasons: [], findings: 0, excepted: [], pending: [], unexpected: [], verified: [], malformed: 0 };
  for (const raw of stdoutLines) {
    if (!raw.trim()) continue;
    let f; try { f = JSON.parse(raw); } catch { r.malformed++; continue; }
    const id = identity(f); // a `level` key (or any other extra key) never turns a finding into a log line
    if (!id) { r.malformed++; continue; }
    r.findings++;
    const d = digest(id);
    if (id.verified) { r.verified.push(d); continue; }
    const hit = exceptions.find((e) => e.commit === id.commit && e.file === id.file && e.line === id.line
      && e.detector === id.detector && e.verified === false);
    if (!hit) r.unexpected.push(d);
    else if (hit.state === 'approved') r.excepted.push(hit.id);
    else r.pending.push(hit.id);
  }
  const logs = checkLogs(stderrLines);
  if (!(exitCode === 0 || exitCode === 183)) r.reasons.push('PRODUCER_EXIT');
  if (exitCode === 0 && r.findings > 0) r.reasons.push('EXIT0_WITH_FINDINGS');
  if (exitCode === 183 && r.findings === 0) r.reasons.push('EXIT183_WITHOUT_FINDINGS');
  if (r.malformed) r.reasons.push('MALFORMED_FINDING');
  if (logs.bad) r.reasons.push('MALFORMED_LOG');
  if (logs.errors) r.reasons.push('ERROR_LOG');
  if (logs.finished !== 1) r.reasons.push('NOT_FINISHED');
  if (r.reasons.length) r.code = 2;
  else if (r.verified.length || r.unexpected.length || r.pending.length) r.code = 1;
  return r;
}

export function report(r) {
  const out = [];
  const list = (label, xs) => xs.slice(0, MAX_LISTED).forEach((x) => out.push(`${label} ${x}`));
  for (const reason of r.reasons) out.push(`::error::trufflehog gate: scan not trustworthy (${reason})`);
  list('::error::VERIFIED secret finding, identity digest', r.verified);
  list('::error::unexcepted secret finding, identity digest', r.unexpected);
  list('::error::finding matches an exception that is NOT approved (PENDING):', r.pending);
  list('EXCEPTED (approved exact identity):', r.excepted);
  out.push(`trufflehog gate: findings=${r.findings} excepted=${r.excepted.length} pending=${r.pending.length} `
    + `unexpected=${r.unexpected.length} verified=${r.verified.length} malformed=${r.malformed} result=${['PASS', 'FAIL', 'REFUSED'][r.code]}`);
  return out;
}

// Compare real paths: a symlinked checkout path must not make the CLI silently skip (and exit 0).
const realOrNull = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
const isMain = Boolean(process.argv[1]) && realOrNull(process.argv[1]) === realOrNull(fileURLToPath(import.meta.url));
if (isMain) {
  const [exFile, outFile, errFile, codeArg] = process.argv.slice(2);
  if (!exFile || !outFile || !errFile || !/^\d{1,3}$/.test(codeArg ?? '')) {
    console.log('trufflehog gate: usage error'); process.exit(2);
  }
  let exceptions; let stdoutText; let stderrText;
  try { exceptions = loadExceptions(fs.readFileSync(exFile, 'utf8')); } catch { console.log('::error::trufflehog gate: exceptions file invalid'); process.exit(2); }
  try { stdoutText = fs.readFileSync(outFile, 'utf8'); stderrText = fs.readFileSync(errFile, 'utf8'); } catch {
    console.log('::error::trufflehog gate: producer output missing'); process.exit(2);
  }
  const r = evaluate({ stdoutLines: stdoutText.split('\n'), stderrLines: stderrText.split('\n'), exitCode: Number(codeArg), exceptions });
  for (const line of report(r)) console.log(line);
  process.exit(r.code);
}
