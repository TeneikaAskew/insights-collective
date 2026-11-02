// ABOUTME: Fail-closed pin check for the shared and lane helpers this lane IMPORTS as-is (never copies or edits): each file must
// ABOUTME: exist as a regular file and hash to its pinned git blob id. Any absence or drift refuses before a browser starts.
//
// Composition (agreed with the PR134 runner owner, 23:47Z): the runner ref must contain #145 + #142 + #152 + #150, each named
// by head SHA. If #152's helpers change in review they are RE-PINNED here, never forked.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const HELPER_PINS = {
  'e2e/support/chromium-executable.ts': 'ce26c40ebdc6e7893a7bcd502f71fe0bf136dd45', // main 32ccf7df (shared, PR134 owner)
  'e2e/lesson-editor/egress-test.ts': 'edd43ce455da6cd27252a6373ffff8956fdc18b6', // #152 c74986bc
  'e2e/lesson-editor/egress-boundary.ts': '7b0474fe170760f6cec6bb34e995053c6de5c9ab', // #152 c74986bc
  'e2e/lesson-editor/egress-proxy.ts': '8934885bba89dc81729bfc01aa8a1e594edb4e18', // #152 c74986bc
};
/** Served-app helpers the runner EXECUTES in the hermetic step (shared owner, PR134 thread). Checked by run.sh before use, not
 *  at config load. hermetic-dist.mjs is the f169429 contract; the avatar fixture is local/avatar-fixture-r1 2845dea4. */
export const SERVED_APP_PINS = {
  'scripts/served-app/hermetic-dist.mjs': '9db9bf1b8502681d73fcd63d7d653816ebbad0d2',
  'scripts/served-app/avatar-fixture.mjs': '49c4b88cf3465be9b31dfe9cae89e282edc311ff',
  'scripts/served-app/avatars/avatar-fixture-11.svg': 'f2716c1b401ce5a7271905a64cf7542ed0619ccf',
  'scripts/served-app/avatars/avatar-fixture-20.svg': '99165ac6ba81ee7cccdb2aea0a1737e2bdba7d84',
  'scripts/served-app/avatars/avatar-fixture-13.svg': 'baa1804a0666ac315393dcba3a682294fb341fcc',
};
/** D1 stack ownership record (shared owner, draft #154 head 7e31eecf). Imported only after this pin passes. */
export const D1_PINS = {
  'scripts/e2e/stack-ownership.mjs': 'ea39300dda9673b66fc6918b75929ca1b5e5d467',
};
export const gitBlobId = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

export function checkHelperPins(root, pins = HELPER_PINS) {
  const errors = [];
  for (const [rel, want] of Object.entries(pins)) {
    const p = path.join(root, rel);
    let st;
    try { st = lstatSync(p); } catch { errors.push(`PUBLIC_CATALOG_E_HELPER_ABSENT: ${rel}`); continue; }
    if (!st.isFile()) { errors.push(`PUBLIC_CATALOG_E_HELPER_NOT_FILE: ${rel}`); continue; }
    if (gitBlobId(readFileSync(p)) !== want) errors.push(`PUBLIC_CATALOG_E_HELPER_DRIFT: ${rel}`);
  }
  return errors;
}
