// ABOUTME: Screenshot capture rules for the journey lane (UNRUN proposal): the 16 allowlisted shot names, the page-content
// ABOUTME: scan that refuses a capture showing the pairing nonce or a credential, and the private PNG + scan-record write.
//
// A screenshot leaves the run only through scripts/gradebook-fixture/journey/shot-export.mjs, which accepts a PNG only
// with a matching scan record written here (sha256 of the exact bytes). The scan reads the page's own text at capture
// time (rendered text, markup, form values, title, URL), before AND after the screenshot; any hit refuses the shot with a
// fixed code and nothing is written. Pixels are not OCR'd: the scan covers what the page renders as text, which is the
// only place the carrier description or a credential could come from on these synthetic pages.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { JourneyGateError } from './private-dir.mjs';
import { PAIRING_PREFIX } from './pairing-proof.mjs';

/** The only names a screenshot may carry: one per shot() call in the journey specs (the static contract checks this). */
export const SHOT_NAMES = Object.freeze([
  'J0a-catalog-before-publish', 'J0b-detail-before-publish', 'J1-builder-draft', 'J1-builder-published-after-reload',
  'J2a-enrolled-after-reload', 'J2b-progress-after-page', 'J2b-certificate-none-after-page', 'J2c-submitted-after-reload',
  'J2c-progress-after-submit', 'J2c-certificate-issued-before-grade', 'J3a-speedgrader-with-file',
  'J3b-speedgrader-graded-after-reload', 'J4a-lesson-graded', 'J4c-grades', 'J4c-progress', 'J4d-certificate',
]);
const SHOT_SET = new Set(SHOT_NAMES);

/** Credential SHAPES refused on any captured page, whatever their value. */
const PATTERNS = Object.freeze([
  /postgres(?:ql)?:\/\//i,                                   // a database URI
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, // a JWT (anon/service/access token)
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/,           // Supabase API keys
  /service_role/i,
  /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/,
]);

/**
 * The exact values a captured page must never contain: this run's nonce, the carrier prefix, and the run's credentials.
 * A missing nonce or credential refuses (a scan that silently checks less is not a scan).
 * @param {Record<string,string|undefined>} env @param {{ stack_id: string }} proof
 * @returns {{ label: string, value: string }[]}
 */
export function shotSecrets(env, proof) {
  if (!proof || typeof proof.stack_id !== 'string' || !/^[0-9a-f]{32}$/.test(proof.stack_id)) throw new JourneyGateError('SHOT_E_NO_NONCE');
  const out = [{ label: 'NONCE', value: proof.stack_id }, { label: 'PREFIX', value: PAIRING_PREFIX }];
  for (const k of ['E2E_INSTRUCTOR_PASSWORD', 'E2E_MEMBER_PASSWORD', 'VITE_SUPABASE_ANON_KEY']) {
    const v = env[k];
    if (typeof v !== 'string' || v === '') throw new JourneyGateError('SHOT_E_NO_SECRET');
    out.push({ label: 'CREDENTIAL', value: v });
  }
  return out;
}

/**
 * @param {unknown[]} texts  page text captured at shot time (rendered text, markup, form values, title, URL)
 * @param {{ label: string, value: string }[]} secrets
 * @returns {string[]} fixed codes ([] = clean); never the matched text
 */
export function scanPage(texts, secrets) {
  if (!Array.isArray(texts) || texts.length === 0 || texts.some((t) => typeof t !== 'string')) return ['SHOT_E_SCAN_INPUT'];
  if (!Array.isArray(secrets) || secrets.length < 5) return ['SHOT_E_SCAN_INPUT'];
  const hits = new Set();
  for (const t of texts) {
    const lower = t.toLowerCase();
    for (const s of secrets) if (t.includes(s.value) || lower.includes(s.value.toLowerCase())) hits.add(`SHOT_E_${s.label}`);
    if (PATTERNS.some((re) => re.test(t))) hits.add('SHOT_E_PATTERN');
  }
  return [...hits].sort();
}

/** The shot dir: absolute, a real directory (not a symlink), 0700, owned by this process. */
export function assertShotDir(dir, uid = typeof process.getuid === 'function' ? process.getuid() : -1) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) throw new JourneyGateError('SHOT_E_DIR');
  let st;
  try { st = fs.lstatSync(dir); } catch { throw new JourneyGateError('SHOT_E_DIR'); }
  if (st.isSymbolicLink() || !st.isDirectory() || (st.mode & 0o777) !== 0o700 || (uid >= 0 && st.uid !== uid)) throw new JourneyGateError('SHOT_E_DIR');
  return dir;
}

function writeExclusive(p, data) {
  let fd;
  try { fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600); }
  catch { throw new JourneyGateError('SHOT_E_EXCLUSIVE_CREATE'); }
  let failed = null;
  try { fs.writeSync(fd, data); fs.fchmodSync(fd, 0o600); } catch { failed = 'SHOT_E_WRITE'; }
  try { fs.closeSync(fd); } catch { failed = failed ?? 'SHOT_E_WRITE'; }
  if (failed) throw new JourneyGateError(failed);
}

/**
 * Write one clean capture: <name>.png and <name>.scan.json (exact keys; sha256 of the exact PNG bytes). The scan results
 * are passed in so the caller cannot write a record for a page it did not scan: any code refuses before anything is written.
 * @param {string} dir @param {string} name @param {Buffer} png @param {string[][]} scans  scanPage results (before, after)
 */
export function writeShot(dir, name, png, scans) {
  if (!SHOT_SET.has(name)) throw new JourneyGateError('SHOT_E_NAME');
  if (!Array.isArray(scans) || scans.length !== 2 || scans.some((s) => !Array.isArray(s))) throw new JourneyGateError('SHOT_E_NOT_SCANNED');
  const bad = scans.flat();
  if (bad.length) throw new JourneyGateError(bad.sort()[0]);
  if (!Buffer.isBuffer(png) || png.length < 67) throw new JourneyGateError('SHOT_E_PNG');
  assertShotDir(dir);
  const sha256 = createHash('sha256').update(png).digest('hex');
  writeExclusive(path.join(dir, `${name}.png`), png);
  writeExclusive(path.join(dir, `${name}.scan.json`), JSON.stringify({ name, sha256, verdict: 'clean', scans: 2 }));
  return sha256;
}
