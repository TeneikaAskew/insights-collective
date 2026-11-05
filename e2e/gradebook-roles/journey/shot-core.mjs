// ABOUTME: Screenshot capture rules for the journey lane (UNRUN proposal): the 16 allowlisted shot names, the page-content
// ABOUTME: scan that refuses a capture showing the pairing nonce or a credential, and the private PNG + scan-record write.
//
// A screenshot leaves the run only through scripts/gradebook-fixture/journey/shot-export.mjs, which accepts a PNG only
// with a matching clean record written here (sha256 of the exact bytes).
// SCOPE (reviewed limits, not a universal framework): the 16 known synthetic routes of this journey, each bound to one
// persona project and one exact path. The scan SAMPLES the main document's text, markup, form values, title and URL; it is
// not a check of every painted surface and no pixel is inspected. Pages with surfaces it cannot sample (iframe, canvas,
// video, embed, object, or an image from outside the app/API origins) are WITHHELD, not captured. The capture window is
// guarded on the f2112ce principle: same document, no navigation, no mutation; anything changed, unclean or incomplete
// is WITHHELD with a fixed reason and the buffer is never written. J0a (the catalog lists the control course, the
// pairing carrier) is withheld by rule, so the screenshot set never depends on how the catalog renders that row.
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

/** Each shot's persona project and route key (observe.ts resolves the key to the exact path from ids.ts route). */
export const SHOT_PLAN = Object.freeze({
  'J0a-catalog-before-publish': ['jr-0-learner-draft', 'catalog'],
  'J0b-detail-before-publish': ['jr-0-learner-draft', 'detail'],
  'J1-builder-draft': ['jr-1-instructor-publish', 'builder'],
  'J1-builder-published-after-reload': ['jr-1-instructor-publish', 'builder'],
  'J2a-enrolled-after-reload': ['jr-2-learner-submit', 'detail'],
  'J2b-progress-after-page': ['jr-2-learner-submit', 'progress'],
  'J2b-certificate-none-after-page': ['jr-2-learner-submit', 'certificate'],
  'J2c-submitted-after-reload': ['jr-2-learner-submit', 'lesson-assignment'],
  'J2c-progress-after-submit': ['jr-2-learner-submit', 'progress'],
  'J2c-certificate-issued-before-grade': ['jr-2-learner-submit', 'certificate'],
  'J3a-speedgrader-with-file': ['jr-3-instructor-grade', 'grader'],
  'J3b-speedgrader-graded-after-reload': ['jr-3-instructor-grade', 'grader'],
  'J4a-lesson-graded': ['jr-4-learner-readback', 'lesson-assignment'],
  'J4c-grades': ['jr-4-learner-readback', 'grades'],
  'J4c-progress': ['jr-4-learner-readback', 'progress'],
  'J4d-certificate': ['jr-4-learner-readback', 'certificate'],
});
/** Withheld by rule, never captured: the catalog lists the control course (the pairing carrier). CourseList cards do not
 *  display `description` (search only), so this is a conservative choice, not an observed nonce. */
export const WITHHOLD_ALWAYS = Object.freeze({ 'J0a-catalog-before-publish': 'CARRIER_ROUTE' });
export const WITHHELD_REASONS = Object.freeze(['CARRIER_ROUTE', 'INCOMPLETE', 'PERSONA', 'ROUTE', 'UNSUPPORTED_SURFACE', 'DIRTY_BEFORE',
  'NAVIGATED', 'MUTATED', 'CHANGED', 'DIRTY_AFTER']);

/**
 * In-page capture-window guard (read-only: it observes, it never writes to the page or the network). 'arm' records a
 * token on this document and counts DOM mutations and input/change/pagehide/beforeunload events; 'read' drains pending
 * mutation records, returns the token seen (null on a new document) and the count, and fully detaches: observer
 * disconnected, every listener dropped, state dropped. Passed to page.evaluate verbatim; the static contract pins its body.
 * DIAGNOSTIC ONLY (never a decision input): every counted record or event is also tallied into the current phase
 * (0 BEFORE_SAMPLE from arm, 1 SCREENSHOT, 2 AFTER_SAMPLE, 3 FINAL) by fixed kind; 'mark:<S|A|F>' drains pending records
 * into the phase that is ending and advances (forward only). The total n is the same count as before: every record or
 * event still adds exactly 1 to n, whether delivered, drained at a mark or drained at the read. Only fixed-kind integers
 * leave the page: never an attribute name or value, node, text, selector or URL.
 * Kind slots: 0 attributes, 1 childList, 2 characterData, 3 unknown record type, 4 input, 5 change, 6 navigation
 * (pagehide/beforeunload), then the attribute family of slot 0: 7 STYLE, 8 CLASS, 9 OTHER.
 */
export function SHOT_GUARD([op, token]) {
  const w = /** @type {any} */ (globalThis);
  const EVENTS = ['input', 'change', 'pagehide', 'beforeunload'];
  const PHASES = ['B', 'S', 'A', 'F'];
  if (op === 'arm') {
    const st = { token, n: 0, obs: null, bump: null, cur: 0, ph: [0, 1, 2, 3].map(() => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), tally: null };
    st.tally = (recs) => {
      const p = st.ph[st.cur];
      for (const r of recs) {
        const t = r ? r.type : null;
        if (t === 'attributes') { const a = r.attributeName; p[0] += 1; p[a === 'style' ? 7 : a === 'class' ? 8 : 9] += 1; }
        else if (t === 'childList') p[1] += 1;
        else if (t === 'characterData') p[2] += 1;
        else p[3] += 1;
      }
      return recs.length;
    };
    st.bump = (e) => { st.n += 1; const t = e ? e.type : null; st.ph[st.cur][t === 'input' ? 4 : t === 'change' ? 5 : 6] += 1; };
    st.obs = new MutationObserver((recs) => { st.n += st.tally(recs); });
    st.obs.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    for (const ev of EVENTS) w.addEventListener(ev, st.bump, true);
    w.__gbShotGuard = st;
    return token;
  }
  const st = w.__gbShotGuard;
  if (typeof op === 'string' && op.startsWith('mark:')) {
    const next = PHASES.indexOf(op.slice(5));
    if (!st || next <= st.cur) return { phase: -1 };
    st.n += st.tally(st.obs.takeRecords());
    st.cur = next;
    return { phase: next };
  }
  if (!st) return { token: null, n: -1 };
  st.n += st.tally(st.obs.takeRecords());
  st.obs.disconnect();
  for (const ev of EVENTS) w.removeEventListener(ev, st.bump, true);
  delete w.__gbShotGuard;
  return { token: st.token, n: st.n, phases: st.ph };
}

/**
 * The capture window, in a fixed order (drv wraps the page; fakes drive every gap). The navigation listener and the
 * guard are armed BEFORE the first sample and stay armed through the AFTER sample, so a change in either gap
 * (sample/screenshot or screenshot/sample) is counted. The guard is read (drained and detached) LAST, in finally, on
 * success and on any exception; then the navigation listener is removed. Any exception, or a guard that cannot be
 * read, makes the observation incomplete and drops the buffer.
 * drv = { watchNav(onMainFrameNav) -> unwatch, guard(op, token), sample(), screenshot() }
 * @returns {Promise<{ png: Buffer | null, obs: Record<string, unknown> }>}
 */
export async function captureShot(drv, base, armed, secrets) {
  let navigations = 0, png = null, before = null, after = null, guard = null, failed = false, marks = 0;
  const unwatch = drv.watchNav(() => { navigations += 1; });
  // Diagnostic phase boundaries only: a mark that throws or does not advance is just not counted (marks < 3); it never
  // changes the window, the decision, the guard read or the cleanup.
  const mark = async (p) => { try { const r = await drv.guard(`mark:${p}`, armed); if (r && r.phase > 0) marks += 1; } catch { /* diagnostic only */ } };
  try {
    await drv.guard('arm', armed);
    before = await drv.sample();
    if (scanPage(before.texts, secrets).length === 0) {            // a dirty page is never captured
      await mark('S');
      png = await drv.screenshot();
      await mark('A');
      after = await drv.sample();
      await mark('F');
    } else after = before;
  } catch { failed = true; } finally {
    try { guard = await drv.guard('read', armed); } catch { failed = true; }
    unwatch();
  }
  if (failed || !guard) return { png: null, obs: { ...base, incomplete: true } };
  return { png, obs: { ...base, before, after, armed, guard, navigations, marks, incomplete: false } };
}

const sameSample = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/**
 * The capture decision, pure (fakes drive every branch). obs = { project, expectedPath, appOrigin, apiOrigin,
 * before: Sample, after: Sample, armed, guard: { token, n }, navigations, incomplete } with
 * Sample = { url, texts: string[], images: string[], surfaces: number }.
 * @returns {{ write: true } | { write: false, reason: string }}
 */
export function decideShot(name, obs, secrets) {
  if (!SHOT_SET.has(name)) throw new JourneyGateError('SHOT_E_NAME');
  if (WITHHOLD_ALWAYS[name]) return { write: false, reason: WITHHOLD_ALWAYS[name] };
  const no = (reason) => ({ write: false, reason });
  if (!obs || obs.incomplete || !obs.before || !obs.after || !obs.guard) return no('INCOMPLETE');
  if (obs.project !== SHOT_PLAN[name][0]) return no('PERSONA');
  let u;
  try { u = new URL(obs.before.url); } catch { return no('ROUTE'); }
  if (u.origin !== obs.appOrigin || u.pathname !== obs.expectedPath || u.search !== '' || u.hash !== '') return no('ROUTE');
  const offOrigin = (src) => { try { const x = new URL(src, obs.appOrigin); return !/^https?:$/.test(x.protocol) || (x.origin !== obs.appOrigin && x.origin !== obs.apiOrigin); } catch { return true; } };
  if (obs.before.surfaces !== 0 || obs.before.images.some(offOrigin)) return no('UNSUPPORTED_SURFACE');
  if (scanPage(obs.before.texts, secrets).length) return no('DIRTY_BEFORE');
  if (obs.navigations !== 0 || obs.guard.token === null || obs.guard.token !== obs.armed) return no('NAVIGATED');
  if (obs.guard.n !== 0) return no('MUTATED');
  if (!sameSample(obs.before, obs.after)) return no('CHANGED');
  if (scanPage(obs.after.texts, secrets).length) return no('DIRTY_AFTER');
  return { write: true };
}

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

export const DIAG_PHASES = Object.freeze(['BEFORE_SAMPLE', 'SCREENSHOT', 'AFTER_SAMPLE', 'FINAL']);
/** Column order of each phase's 10 counts (see SHOT_GUARD kind slots). */
export const DIAG_KINDS = Object.freeze(['attributes', 'childList', 'characterData', 'unknown', 'input', 'change', 'navigation', 'STYLE', 'CLASS', 'OTHER']);
const DIAG_CAP = 999;
const isCount = (v) => Number.isInteger(v) && v >= 0;
/**
 * The MUTATED diagnostic from a guard read: { phases: 4 x 10 counts capped at 999, marks: 0..3, sum: 'EQ'|'NE' } where sum
 * compares the uncapped kind total (slots 0-6) with the guard's own n. Anything malformed gives 'NA'. Pure; never a
 * decision input.
 */
export function mutationDiag(obs) {
  const g = obs && obs.guard, ph = g && g.phases;
  if (!g || !Array.isArray(ph) || ph.length !== 4 || !ph.every((r) => Array.isArray(r) && r.length === 10 && r.every(isCount))
    || !isCount(g.n) || !Number.isInteger(obs.marks) || obs.marks < 0 || obs.marks > 3) return 'NA';
  const total = ph.reduce((t, r) => t + r.slice(0, 7).reduce((a, b) => a + b, 0), 0);
  return { phases: ph.map((r) => r.map((v) => Math.min(v, DIAG_CAP))), marks: obs.marks, sum: total === g.n ? 'EQ' : 'NE' };
}
/** Strict re-validation of a stored diag (export side). Returns the manifest suffix or null when invalid. */
export function diagSuffix(diag) {
  if (diag === 'NA') return 'diag=NA';
  if (!diag || typeof diag !== 'object' || Array.isArray(diag) || Object.keys(diag).sort().join(',') !== 'marks,phases,sum') return null;
  const { phases, marks, sum } = diag;
  if (!Array.isArray(phases) || phases.length !== 4 || !phases.every((r) => Array.isArray(r) && r.length === 10 && r.every((v) => isCount(v) && v <= DIAG_CAP))) return null;
  if (!Number.isInteger(marks) || marks < 0 || marks > 3 || (sum !== 'EQ' && sum !== 'NE')) return null;
  return `${DIAG_PHASES.map((p, i) => `${p}=${phases[i].join('/')}`).join(' ')} marks=${marks} sum=${sum}`;
}
const DN = '(?:0|[1-9][0-9]{0,2})';
const DROW = `${DN}(?:/${DN}){9}`;
/** The manifest suffix grammar (summary side). */
export const DIAG_SUFFIX_RE = new RegExp(`^(?:diag=NA|BEFORE_SAMPLE=${DROW} SCREENSHOT=${DROW} AFTER_SAMPLE=${DROW} FINAL=${DROW} marks=[0-3] sum=(?:EQ|NE))$`);

/**
 * Write the outcome of one shot. A PNG is written only when decideShot says so (and then with a record bound to its
 * sha256); otherwise ONLY <name>.withheld.json {name, withheld:true, reason} is written and the buffer is dropped.
 * @param {string} dir @param {string} name @param {Buffer|null} png @param {object} obs @param {{label:string,value:string}[]} secrets
 * @returns {{ written: 'png', sha256: string } | { written: 'withheld', reason: string }}
 */
export function writeShot(dir, name, png, obs, secrets) {
  if (!SHOT_SET.has(name)) throw new JourneyGateError('SHOT_E_NAME');
  assertShotDir(dir);
  const d = decideShot(name, obs, secrets);
  if (d.write && (!Buffer.isBuffer(png) || png.length < 67)) d.write = false, d.reason = 'INCOMPLETE';
  if (!d.write) {
    const rec = { name, withheld: true, reason: d.reason };
    if (d.reason === 'MUTATED') rec.diag = mutationDiag(obs);   // diagnostic only: fixed-kind capped counts, or 'NA'
    writeExclusive(path.join(dir, `${name}.withheld.json`), JSON.stringify(rec));
    return { written: 'withheld', reason: d.reason };
  }
  const sha256 = createHash('sha256').update(png).digest('hex');
  writeExclusive(path.join(dir, `${name}.png`), png);
  writeExclusive(path.join(dir, `${name}.scan.json`), JSON.stringify({ name, sha256, verdict: 'clean', scans: 2, window: 'same-document-unchanged' }));
  return { written: 'png', sha256 };
}
