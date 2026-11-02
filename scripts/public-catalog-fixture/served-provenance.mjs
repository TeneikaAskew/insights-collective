// ABOUTME: Loads the hermetic served-app provenance (scripts/served-app f169429 contract) through the private-file reader and
// ABOUTME: answers "what must this served path hash to?". Used by the PRE check and by the per-response binding in the specs.
import { createHash } from 'node:crypto';
import { lstatSync } from 'node:fs';
import path from 'node:path';
import { readPrivateFile } from './private-file.mjs';

export const LABEL = 'TEST-SERVED MODIFICATION: product build minus the Lovable editor CDN script tag in index.html; NOT production bytes';
export const sha256 = (b) => createHash('sha256').update(b).digest('hex');

/** The shared owner's TEST-SERVED avatar fixture (scripts/served-app/avatar-fixture.mjs, PR134 thread, local/avatar-fixture-r1
 *  b8d2b5b7, module blob f7cbca3e). The lane does not trust AVATAR-PROVENANCE.json for these values: the substitutions, their
 *  order, the targets and the three asset digests are hardcoded here and the file must match them exactly. */
export const AVATAR_LABEL = 'TEST-SERVED AVATAR FIXTURE: hermetic copy with the three CommunityShowcase i.pravatar.cc URLs replaced by fixed local SVGs; NOT production bytes; product avatar provider integration and the AvatarFallback path UNVERIFIED';
export const AVATAR_SUBS = Object.freeze([11, 20, 13].map((n) => Object.freeze({ from: `https://i.pravatar.cc/150?img=${n}`, to: `/hermetic-avatars/avatar-fixture-${n}.svg` })));
export const AVATAR_ASSETS = Object.freeze({
  'hermetic-avatars/avatar-fixture-11.svg': '701b973409c1a035128f674787c79922ad5bfa713c000e2e54b490c27dc863c4',
  'hermetic-avatars/avatar-fixture-20.svg': '4afb4812c4753904a4ad84b0b84b186c8483704febcc27780526af359fe557ee',
  'hermetic-avatars/avatar-fixture-13.svg': 'ff48716bdc32cbfa4d8713fdeeb19b9f9c2a0c8ff32376efc72f55726b239447',
});
const NEVER_SERVED = new Set(['HERMETIC-PROVENANCE.json', 'AVATAR-PROVENANCE.json']);
const HEX = /^[0-9a-f]{64}$/;
const readJson = (file, max) => {
  const r = readPrivateFile(file, { max, privateMode: false });
  if (r.error) return { error: r.error };
  try { return { json: JSON.parse(r.buf.toString('utf8')) }; } catch { return { error: 'JSON' }; }
};

/** Pure: the expected served map for the fixture copy, or an error code. Per-file chain in recorded (= application) order:
 *  the first before equals the HERMETIC pin, each later before equals the previous after. Every sha256_after but the last is
 *  an intermediate and is never bound. The bound value is final_files[file], which must exist for exactly the substituted
 *  files and equal the chain's end. It is build-specific: it comes from the provenance this job's avatar verify re-derived,
 *  never from a constant carried over from another build. */
export function applyAvatarProvenance(hermetic, av) {
  const keys = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.keys(o).sort().join() : '');
  if (!av || av.label !== AVATAR_LABEL) return { error: 'AVATAR_LABEL' };
  if (!av.hermetic || av.hermetic.served_index_sha256 !== hermetic.served_index_sha256) return { error: 'AVATAR_HERMETIC_INDEX' };
  if (!HEX.test(hermetic.product_manifest_sha256 ?? '') || av.hermetic.product_manifest_sha256 !== hermetic.product_manifest_sha256) return { error: 'AVATAR_HERMETIC_MANIFEST' };
  if (!Array.isArray(av.substitutions) || av.substitutions.length !== AVATAR_SUBS.length) return { error: 'AVATAR_SUB_COUNT' };
  const files = { ...hermetic.files }; const head = {};
  for (let i = 0; i < AVATAR_SUBS.length; i++) {
    const s = av.substitutions[i]; const want = AVATAR_SUBS[i];
    if (!s || s.from !== want.from || s.to !== want.to || s.count !== 1) return { error: 'AVATAR_SUB_SHAPE' };
    if (typeof s.file !== 'string' || !/^assets\/[A-Za-z0-9._-]+\.js$/.test(s.file)) return { error: 'AVATAR_SUB_TARGET' }; // never index.html
    if (!Object.hasOwn(hermetic.files, s.file)) return { error: 'AVATAR_SUB_UNPINNED_FILE' };
    if (!HEX.test(s.sha256_before ?? '') || !HEX.test(s.sha256_after ?? '')) return { error: 'AVATAR_SUB_SHAPE' };
    const expectBefore = Object.hasOwn(head, s.file) ? head[s.file] : hermetic.files[s.file];
    if (s.sha256_before !== expectBefore) return { error: 'AVATAR_SUB_CHAIN' };
    head[s.file] = s.sha256_after;
  }
  const finals = av.final_files;
  if (keys(finals) !== keys(head)) return { error: 'AVATAR_FINAL_SET' };
  for (const [f, h] of Object.entries(head)) {
    if (!HEX.test(finals[f] ?? '') || finals[f] !== h) return { error: 'AVATAR_FINAL_CHAIN' };
    files[f] = finals[f];
  }
  if (keys(av.assets) !== keys(AVATAR_ASSETS)) return { error: 'AVATAR_ASSET_SET' };
  for (const [rel, h] of Object.entries(AVATAR_ASSETS)) {
    if (av.assets[rel] !== h) return { error: 'AVATAR_ASSET_HASH' };
    if (Object.hasOwn(hermetic.files, rel)) return { error: 'AVATAR_ASSET_COLLISION' };
    files[rel] = h;
  }
  return { prov: { ...hermetic, files, avatar_fixture: true } };
}

/** { prov } or { error: code }. The provenance is written by hermetic-dist.mjs (not private), so mode is not required 0600, but
 *  it must still be a regular single-link file owned by this uid, opened no-follow and non-blocking, at most 4 MiB.
 *  The avatar fixture is an explicit choice both ways: with PUBLIC_ACCEPT_AVATAR_FIXTURE=1 AVATAR-PROVENANCE.json must be present
 *  and exact; without it the file must be absent (a fixture copy is never bound against the plain hermetic map). */
export function loadProvenance(dir, { avatar = process.env.PUBLIC_ACCEPT_AVATAR_FIXTURE === '1' } = {}) {
  if (!dir) return { error: 'NO_DIR' };
  const r = readJson(path.join(dir, 'HERMETIC-PROVENANCE.json'), 4 * 1024 * 1024);
  if (r.error) return { error: r.error === 'JSON' ? 'PROVENANCE_JSON' : `PROVENANCE_${r.error}` };
  const prov = r.json;
  if (prov.label !== LABEL || !prov.files || typeof prov.files !== 'object' || !HEX.test(prov.served_index_sha256 ?? '')
      || !Object.values(prov.files).every((h) => HEX.test(h)) || !Object.hasOwn(prov.files, 'index.html')) return { error: 'BAD_PROVENANCE' };
  const avFile = path.join(dir, 'AVATAR-PROVENANCE.json');
  if (!avatar) {
    let present = true; try { lstatSync(avFile); } catch (e) { present = !(e && e.code === 'ENOENT'); }
    return present ? { error: 'AVATAR_UNEXPECTED' } : { prov };
  }
  const a = readJson(avFile, 4 * 1024 * 1024);
  if (a.error) return { error: a.error === 'JSON' ? 'AVATAR_JSON' : `AVATAR_${a.error}` };
  return applyAvatarProvenance(prov, a.json);
}

/** The sha256 a served URL path must have. A path with a pinned file maps to it (index.html maps to the SERVED index); any other
 *  path is an SPA route and must be the served index. Returns null for a path that tries to escape (.., encoded separators). */
export function expectedHash(prov, urlPath) {
  let rel; try { rel = decodeURIComponent(urlPath).replace(/^\/+/, ''); } catch { return null; }
  if (rel.split('/').some((s) => s === '..' || s === '.') || /[\\\0]/.test(rel)) return null;
  if (rel === '' || rel === 'index.html') return prov.served_index_sha256;
  if (NEVER_SERVED.has(rel)) return null; // never part of the served app
  if (Object.hasOwn(prov.files, rel)) return prov.files[rel];
  return path.extname(rel) ? null : prov.served_index_sha256; // an extension-bearing path outside the manifest is unpinned
}
