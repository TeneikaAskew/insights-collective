// ABOUTME: Builder-authoring screenshot decision and private write (UNRUN). The capture window, guard and page scan are the
// ABOUTME: gradebook journey's qualified shot-core functions, imported unchanged; only the shot names and routes are this lane's.
//
// shot-core's decideShot/writeShot are bound to the journey's 16 names, so this file carries the SAME decision, in the
// same order, for the builder plan (ids.mjs SHOT_PLAN). The only difference: a builder route carries one exact query
// (?view=curriculum), so the URL check compares the exact search string the plan expects instead of requiring none.
// tests/shot-selftest.mjs drives decideShot and decideBaShot with identical observations to show they agree.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { scanPage, assertShotDir, mutationDiag } from '../../e2e/gradebook-roles/journey/shot-core.mjs';
import { JourneyGateError } from '../../e2e/gradebook-roles/journey/private-dir.mjs';
import { SHOT_PLAN, SHOT_NAMES } from './ids.mjs';

const SHOT_SET = new Set(SHOT_NAMES);
const sameSample = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** obs as in shot-core decideShot, plus expectedSearch ('' or '?view=curriculum'). Pure. */
export function decideBaShot(name, obs, secrets) {
  if (!SHOT_SET.has(name)) throw new JourneyGateError('BA_SHOT_E_NAME');
  const no = (reason) => ({ write: false, reason });
  if (!obs || obs.incomplete || !obs.before || !obs.after || !obs.guard) return no('INCOMPLETE');
  if (obs.project !== SHOT_PLAN[name][0]) return no('PERSONA');
  let u;
  try { u = new URL(obs.before.url); } catch { return no('ROUTE'); }
  if (u.origin !== obs.appOrigin || u.pathname !== obs.expectedPath || u.search !== (obs.expectedSearch ?? '') || u.hash !== '') return no('ROUTE');
  const offOrigin = (src) => { try { const x = new URL(src, obs.appOrigin); return !/^https?:$/.test(x.protocol) || (x.origin !== obs.appOrigin && x.origin !== obs.apiOrigin); } catch { return true; } };
  if (obs.before.surfaces !== 0 || obs.before.images.some(offOrigin)) return no('UNSUPPORTED_SURFACE');
  if (scanPage(obs.before.texts, secrets).length) return no('DIRTY_BEFORE');
  if (obs.navigations !== 0 || obs.guard.token === null || obs.guard.token !== obs.armed) return no('NAVIGATED');
  if (obs.guard.n !== 0) return no('MUTATED');
  if (!sameSample(obs.before, obs.after)) return no('CHANGED');
  if (scanPage(obs.after.texts, secrets).length) return no('DIRTY_AFTER');
  return { write: true };
}

function writeExclusive(p, data) {
  let fd;
  try { fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600); }
  catch { throw new JourneyGateError('BA_SHOT_E_EXCLUSIVE_CREATE'); }
  let failed = null;
  try { fs.writeSync(fd, data); fs.fchmodSync(fd, 0o600); } catch { failed = 'BA_SHOT_E_WRITE'; }
  try { fs.closeSync(fd); } catch { failed = failed ?? 'BA_SHOT_E_WRITE'; }
  if (failed) throw new JourneyGateError(failed);
}

/** Same record shapes as shot-core writeShot: <name>.png + <name>.scan.json, or only <name>.withheld.json. */
export function writeBaShot(dir, name, png, obs, secrets) {
  if (!SHOT_SET.has(name)) throw new JourneyGateError('BA_SHOT_E_NAME');
  assertShotDir(dir);
  const d = decideBaShot(name, obs, secrets);
  if (d.write && (!Buffer.isBuffer(png) || png.length < 67)) d.write = false, d.reason = 'INCOMPLETE';
  if (!d.write) {
    const rec = { name, withheld: true, reason: d.reason };
    if (d.reason === 'MUTATED') rec.diag = mutationDiag(obs);
    writeExclusive(path.join(dir, `${name}.withheld.json`), JSON.stringify(rec));
    return { written: 'withheld', reason: d.reason };
  }
  const sha256 = createHash('sha256').update(png).digest('hex');
  writeExclusive(path.join(dir, `${name}.png`), png);
  writeExclusive(path.join(dir, `${name}.scan.json`), JSON.stringify({ name, sha256, verdict: 'clean', scans: 2, window: 'same-document-unchanged' }));
  return { written: 'png', sha256 };
}
