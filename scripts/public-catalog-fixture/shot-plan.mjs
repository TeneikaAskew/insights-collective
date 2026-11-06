// ABOUTME: Fixed-name synthetic screenshots for the public lane: 3 catalog captures (one per project) and 1 desktop rail capture.
// ABOUTME: Reuses the qualified #148 capture window (SHOT_GUARD, captureShot, scanPage) imported blob-pinned; never forks it.
//
// SCOPE (reviewed limits, not a framework): exactly the 4 names below, each bound to one project, one exact path (/courses, no
// query or hash) and one exact viewport. The capture window is #148's: guard and navigation watch armed before the BEFORE sample,
// clean BEFORE sample or no screenshot, identical clean AFTER sample, guard read last. Anything else WITHHOLDS the shot with a
// fixed reason and the buffer is never written. The scan samples main-document text, markup, form values, title and URL for
// this run's pairing nonce, run id, carrier id, anon key and DB URL plus credential shapes; it inspects no pixels. Pages with
// unsampled surfaces or off-origin images are withheld. A withheld or missing shot fails the run (shot-export.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { checkHelperPins, SHOT_CORE_PINS } from './helper-pins.mjs';

export const PUBLIC_SHOT_PLAN = Object.freeze({
  'PC-catalog-desktop-1440x900': Object.freeze({ project: 'desktop', path: '/courses', width: 1440, height: 900 }),
  'PC-catalog-tablet-768x1024': Object.freeze({ project: 'tablet-768', path: '/courses', width: 768, height: 1024 }),
  'PC-catalog-mobile-390x844': Object.freeze({ project: 'mobile', path: '/courses', width: 390, height: 844 }),
  'PC-rail-desktop-1180x757': Object.freeze({ project: 'desktop', path: '/courses', width: 1180, height: 757 }),
});
export const PUBLIC_SHOT_NAMES = Object.freeze(Object.keys(PUBLIC_SHOT_PLAN));
export const PUBLIC_WITHHELD_REASONS = Object.freeze(['INCOMPLETE', 'PERSONA', 'VIEWPORT', 'ROUTE', 'UNSUPPORTED_SURFACE',
  'DIRTY_BEFORE', 'NAVIGATED', 'MUTATED', 'CHANGED', 'DIRTY_AFTER']);
/** Same value as pairing-producer.mjs PAIRING_TAG_ID (selftest checks equality); written out so this module imports nothing else. */
export const CARRIER_ID = '7e57ca7a-0000-4000-8000-000000000900';

export class ShotError extends Error { constructor(code) { super(code); this.code = code; } }

/** Pin-check, then import the #148 capture core from the runner ref. Absent or drifted bytes refuse before any import. */
export async function loadShotCore(root) {
  const e = checkHelperPins(root, SHOT_CORE_PINS);
  if (e.length) throw new ShotError('PUBLIC_SHOT_E_CORE_PIN');
  const m = await import(pathToFileURL(path.join(root, 'e2e/gradebook-roles/journey/shot-core.mjs')).href);
  return { SHOT_GUARD: m.SHOT_GUARD, captureShot: m.captureShot, scanPage: m.scanPage };
}

/** The exact values a captured page must never contain. A missing value refuses (a scan that checks less is not a scan). */
export function publicShotSecrets(env, stackId) {
  if (typeof stackId !== 'string' || !/^[0-9a-f]{32}$/.test(stackId)) throw new ShotError('PUBLIC_SHOT_E_NO_NONCE');
  if (!/^[0-9a-f]{32}$/.test(env.PUBLIC_ACCEPT_RUN_ID ?? '')) throw new ShotError('PUBLIC_SHOT_E_NO_SECRET');
  const out = [{ label: 'NONCE', value: stackId }, { label: 'RUN', value: env.PUBLIC_ACCEPT_RUN_ID }, { label: 'CARRIER', value: CARRIER_ID }];
  for (const k of ['PUBLIC_ACCEPT_ANON_KEY', 'PUBLIC_ACCEPT_DB_URL']) {
    const v = env[k];
    if (typeof v !== 'string' || v === '') throw new ShotError('PUBLIC_SHOT_E_NO_SECRET');
    out.push({ label: 'CREDENTIAL', value: v });
  }
  return out;
}

const sameSample = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/**
 * The capture decision, pure. obs = { project, viewport: {width,height}, appOrigin, apiOrigin, before, after, armed,
 * guard: { token, n }, navigations, incomplete } (the #148 Sample shape: { url, texts, images, surfaces }).
 * @returns {{ write: true } | { write: false, reason: string }}
 */
export function decidePublicShot(name, obs, secrets, scanPage) {
  const plan = PUBLIC_SHOT_PLAN[name];
  if (!Object.hasOwn(PUBLIC_SHOT_PLAN, name)) throw new ShotError('PUBLIC_SHOT_E_NAME');
  const no = (reason) => ({ write: false, reason });
  if (!obs || obs.incomplete || !obs.before || !obs.after || !obs.guard) return no('INCOMPLETE');
  if (obs.project !== plan.project) return no('PERSONA');
  if (!obs.viewport || obs.viewport.width !== plan.width || obs.viewport.height !== plan.height) return no('VIEWPORT');
  let u;
  try { u = new URL(obs.before.url); } catch { return no('ROUTE'); }
  if (u.origin !== obs.appOrigin || u.pathname !== plan.path || u.search !== '' || u.hash !== '') return no('ROUTE');
  const offOrigin = (src) => { try { const x = new URL(src, obs.appOrigin); return !/^https?:$/.test(x.protocol) || (x.origin !== obs.appOrigin && x.origin !== obs.apiOrigin); } catch { return true; } };
  if (obs.before.surfaces !== 0 || obs.before.images.some(offOrigin)) return no('UNSUPPORTED_SURFACE');
  if (scanPage(obs.before.texts, secrets).length) return no('DIRTY_BEFORE');
  if (obs.navigations !== 0 || obs.guard.token === null || obs.guard.token !== obs.armed) return no('NAVIGATED');
  if (obs.guard.n !== 0) return no('MUTATED');
  if (!sameSample(obs.before, obs.after)) return no('CHANGED');
  if (scanPage(obs.after.texts, secrets).length) return no('DIRTY_AFTER');
  return { write: true };
}

/** The shot dir: absolute, a real directory (not a symlink), 0700, owned by this process. */
export function assertShotDir(dir, uid = process.getuid()) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) throw new ShotError('PUBLIC_SHOT_E_DIR');
  let st;
  try { st = fs.lstatSync(dir); } catch { throw new ShotError('PUBLIC_SHOT_E_DIR'); }
  if (st.isSymbolicLink() || !st.isDirectory() || (st.mode & 0o777) !== 0o700 || st.uid !== uid) throw new ShotError('PUBLIC_SHOT_E_DIR');
  return dir;
}

function writeExclusive(p, data) {
  let fd;
  try { fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600); }
  catch { throw new ShotError('PUBLIC_SHOT_E_EXCLUSIVE_CREATE'); }
  let failed = null;
  try { fs.writeSync(fd, data); fs.fchmodSync(fd, 0o600); } catch { failed = 'PUBLIC_SHOT_E_WRITE'; }
  try { fs.closeSync(fd); } catch { failed = failed ?? 'PUBLIC_SHOT_E_WRITE'; }
  if (failed) throw new ShotError(failed);
}

/** Write one outcome: <name>.png + <name>.scan.json bound to its sha256, or ONLY <name>.withheld.json (buffer dropped). */
export function writePublicShot(dir, name, png, obs, secrets, scanPage) {
  if (!Object.hasOwn(PUBLIC_SHOT_PLAN, name)) throw new ShotError('PUBLIC_SHOT_E_NAME');
  assertShotDir(dir);
  const d = decidePublicShot(name, obs, secrets, scanPage);
  if (d.write && (!Buffer.isBuffer(png) || png.length < 67)) { d.write = false; d.reason = 'INCOMPLETE'; }
  if (!d.write) {
    writeExclusive(path.join(dir, `${name}.withheld.json`), JSON.stringify({ name, withheld: true, reason: d.reason }));
    return { written: 'withheld', reason: d.reason };
  }
  const sha256 = createHash('sha256').update(png).digest('hex');
  writeExclusive(path.join(dir, `${name}.png`), png);
  writeExclusive(path.join(dir, `${name}.scan.json`), JSON.stringify({ name, sha256, verdict: 'clean', scans: 2, window: 'same-document-unchanged' }));
  return { written: 'png', sha256 };
}
