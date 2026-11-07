// ABOUTME: Pure load-time contract of playwright.sealed-video.config.ts (DESIGN r2 section 5, ADDENDUM r2.1 C3/C4): the exact lane
// ABOUTME: environment, the validated pinned shell carried in launchOptions, and the one list-only mode. Throws fixed codes.
//
// No I/O of its own: the caller passes `isFile` (one stat). Nothing here imports e2e/support/chromium-executable, so loading
// the sealed config never runs a browser binary (not even `--version`).
import path from 'node:path';
import { BROWSER_PATH_RE } from '../le-iso/expect.mjs';
import { APP_ORIGIN } from './contract.mjs';
import { VIDEO_SPEC_REL, videoPaths } from './kinds.mjs';
import { RESOLVER_ARG } from '../../../e2e/lesson-editor/sandbox-launch.mjs';

export const SEALED_VIDEO_TEST_DIR = 'e2e/stubbed';
export const SEALED_VIDEO_TEST_MATCH = /(^|\/)wp09a-video-embed\.spec\.ts$/;
/** Keys the config reads from the lane environment (video-entry passes exactly VIDEO_ENV_KEYS plus PATH/HOSTNAME). */
const LANE_KEYS = ['LE_KIND', 'LE_APP_ORIGIN', 'LE_SOCK_DIR', 'LE_LANE_DIR', 'LE_OUT_DIR', 'LE_OUTPUT_DIR', 'LE_REPORT_JSON', 'LE_EGRESS_DIR',
  'E2E_EVIDENCE_COMMIT', 'E2E_EVIDENCE_ENVIRONMENT', 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'];

export class SealedVideoConfigError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const refuse = (code) => { throw new SealedVideoConfigError(code); };

/** C4: absolute, normalized, no NUL/newline, the pinned layout, and an existing regular file. Returns a code or null. */
export function shellProblem(shell, isFile) {
  if (typeof shell !== 'string' || !path.isAbsolute(shell) || shell !== path.normalize(shell) || /[\0\n]/.test(shell)) return 'SEALED_VIDEO_E_SHELL';
  if (!BROWSER_PATH_RE.test(shell)) return 'SEALED_VIDEO_E_SHELL';
  let file = false;
  try { file = isFile(shell) === true; } catch { file = false; }
  return file ? null : 'SEALED_VIDEO_E_SHELL';
}

/** The ONLY launchOptions the sealed config passes: the validated shell and the resolver rule. sandbox-launch adds the rest. */
export const videoLaunchOptions = (shell) => ({ executablePath: shell, args: [RESOLVER_ARG] });

/**
 * Settings for one config load. Modes:
 *   lane (runner): every LANE_KEYS value exact for this repo, PUBLIC_VIDEO_SEALED NOT preset (the config sets it).
 *   lane (worker, TEST_WORKER_INDEX set by Playwright): the same values, and PUBLIC_VIDEO_SEALED exactly '1' from the runner.
 *   list-only: VIDEO_SEALED_LIST_ONLY=1 AND `--list` in the runner argv AND no lane key at all; never in a worker.
 * Anything else throws SealedVideoConfigError with a fixed code.
 */
export function sealedVideoSettings({ env, argv, repo, isFile }) {
  if (!env || typeof env !== 'object' || typeof repo !== 'string' || !path.isAbsolute(repo)) refuse('SEALED_VIDEO_E_ENV');
  const worker = env.TEST_WORKER_INDEX !== undefined;
  if (env.VIDEO_SEALED_LIST_ONLY !== undefined) {
    if (env.VIDEO_SEALED_LIST_ONLY !== '1' || worker || !Array.isArray(argv) || !argv.includes('--list')) refuse('SEALED_VIDEO_E_LIST_ONLY');
    if (LANE_KEYS.some((k) => env[k] !== undefined) || env.PUBLIC_VIDEO_SEALED !== undefined) refuse('SEALED_VIDEO_E_LIST_ONLY');
    return { mode: 'list-only', outputDir: '/nonexistent-sealed-video-list', reportJson: null, launchOptions: { args: [RESOLVER_ARG] } };
  }
  if (worker ? env.PUBLIC_VIDEO_SEALED !== '1' : env.PUBLIC_VIDEO_SEALED !== undefined) refuse('SEALED_VIDEO_E_PRESET');
  for (const k of LANE_KEYS) if (typeof env[k] !== 'string' || env[k] === '') refuse('SEALED_VIDEO_E_ENV');
  if (env.LE_KIND !== 'video' || env.LE_APP_ORIGIN !== APP_ORIGIN || env.E2E_EVIDENCE_ENVIRONMENT !== 'sealed-stubbed' || !/^[0-9a-f]{40}$/.test(env.E2E_EVIDENCE_COMMIT)) refuse('SEALED_VIDEO_E_ENV');
  let V;
  try { V = videoPaths(path.dirname(env.LE_LANE_DIR), '/nonexistent-ctl', repo); } catch { refuse('SEALED_VIDEO_E_ENV'); }
  if (env.LE_LANE_DIR !== V.lane || env.LE_SOCK_DIR !== V.sock || env.LE_OUT_DIR !== V.out || env.LE_OUTPUT_DIR !== V.output
    || env.LE_REPORT_JSON !== V.report || env.LE_EGRESS_DIR !== V.egressDir) refuse('SEALED_VIDEO_E_ENV');
  const shell = env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const sp = shellProblem(shell, isFile);
  if (sp) refuse(sp);
  return { mode: 'lane', outputDir: V.output, reportJson: V.report, launchOptions: videoLaunchOptions(shell) };
}

export { VIDEO_SPEC_REL };
