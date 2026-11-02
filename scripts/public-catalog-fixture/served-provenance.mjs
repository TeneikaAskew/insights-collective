// ABOUTME: Loads the hermetic served-app provenance (scripts/served-app f169429 contract) through the private-file reader and
// ABOUTME: answers "what must this served path hash to?". Used by the PRE check and by the per-response binding in the specs.
import { createHash } from 'node:crypto';
import path from 'node:path';
import { readPrivateFile } from './private-file.mjs';

export const LABEL = 'TEST-SERVED MODIFICATION: product build minus the Lovable editor CDN script tag in index.html; NOT production bytes';
export const sha256 = (b) => createHash('sha256').update(b).digest('hex');

/** { prov } or { error: code }. The provenance is written by hermetic-dist.mjs (not private), so mode is not required 0600, but
 *  it must still be a regular single-link file owned by this uid, opened no-follow and non-blocking, at most 4 MiB. */
export function loadProvenance(dir) {
  if (!dir) return { error: 'NO_DIR' };
  const r = readPrivateFile(path.join(dir, 'HERMETIC-PROVENANCE.json'), { max: 4 * 1024 * 1024, privateMode: false });
  if (r.error) return { error: `PROVENANCE_${r.error}` };
  let prov; try { prov = JSON.parse(r.buf.toString('utf8')); } catch { return { error: 'PROVENANCE_JSON' }; }
  const hex = /^[0-9a-f]{64}$/;
  if (prov.label !== LABEL || !prov.files || typeof prov.files !== 'object' || !hex.test(prov.served_index_sha256 ?? '')
      || !Object.values(prov.files).every((h) => hex.test(h)) || !Object.hasOwn(prov.files, 'index.html')) return { error: 'BAD_PROVENANCE' };
  return { prov };
}

/** The sha256 a served URL path must have. A path with a pinned file maps to it (index.html maps to the SERVED index); any other
 *  path is an SPA route and must be the served index. Returns null for a path that tries to escape (.., encoded separators). */
export function expectedHash(prov, urlPath) {
  let rel; try { rel = decodeURIComponent(urlPath).replace(/^\/+/, ''); } catch { return null; }
  if (rel.split('/').some((s) => s === '..' || s === '.') || /[\\\0]/.test(rel)) return null;
  if (rel === '' || rel === 'index.html') return prov.served_index_sha256;
  if (rel === 'HERMETIC-PROVENANCE.json') return null; // never part of the served app
  if (Object.hasOwn(prov.files, rel)) return prov.files[rel];
  return path.extname(rel) ? null : prov.served_index_sha256; // an extension-bearing path outside the manifest is unpinned
}
