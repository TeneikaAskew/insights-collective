#!/usr/bin/env node
// ABOUTME: Resolves the ONE browser the confined quiz-lifecycle modes may launch: the Chrome Headless Shell build that the
// ABOUTME: Playwright in use declares (playwright-core/browsers.json), at its installed layout, or refuses before any launch.
//
// Why: run 41344646821 installed only the headless shell; the shared resolver (e2e/support/chromium-executable.ts) probed
// the FULL chromium path, did not know the headless-shell layout, and fell back to the runner's system /bin/chromium, whose
// background services contacted accounts.google.com / www.google.com (refused by the proxy). This module has NO fallback:
//   - expected revision and browserVersion come from the browsers.json of the playwright-core that @playwright/test uses;
//   - root is PLAYWRIGHT_BROWSERS_PATH, else ~/.cache/ms-playwright (Playwright's own default on Linux);
//   - the only accepted layout is <root>/chromium_headless_shell-<rev>/chrome-headless-shell-linux64/chrome-headless-shell
//     on linux x64, with Playwright's INSTALLATION_COMPLETE marker;
//   - the binary must be a regular file (no symlink), executable, inside that directory, and `--version` must print exactly
//     "Google Chrome for Testing <browserVersion>";
//   - PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, if set, must equal the resolved path (it can never select another browser).
// Test-only: QLC_TEST_BROWSERS_JSON replaces the declared browsers.json (local controls where the preinstalled build has a
// different revision). It is REFUSED when CI or GITHUB_ACTIONS is set, and every receipt names it.
//
//   node headless-shell.mjs receipt     -> prints a receipt; last line "path=<abs path>"; exit 0, or "REFUSED ..." exit 1
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export class Refused extends Error {}
const refuse = (m) => { throw new Refused(m); };

function declared(env) {
  const override = env.QLC_TEST_BROWSERS_JSON;
  if (override) {
    if (env.CI || env.GITHUB_ACTIONS) refuse('QLC_TEST_BROWSERS_JSON is test-only and refused in CI');
    return { file: override, core: 'test-override', json: JSON.parse(fs.readFileSync(override, 'utf8')) };
  }
  const req = createRequire(import.meta.url);
  let file;
  try {
    // @playwright/test -> playwright -> playwright-core (browsers.json is not an exported subpath, so go via package.json).
    const pwTest = req.resolve('@playwright/test/package.json');
    const pw = createRequire(pwTest).resolve('playwright/package.json');
    file = path.join(path.dirname(createRequire(pw).resolve('playwright-core/package.json')), 'browsers.json');
    fs.accessSync(file);
  } catch { refuse('cannot locate the browsers.json of the playwright-core that @playwright/test uses'); }
  const core = JSON.parse(fs.readFileSync(path.join(path.dirname(file), 'package.json'), 'utf8')).version;
  return { file, core, json: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

export function resolveHeadlessShell(env = process.env, platform = process.platform, arch = process.arch) {
  if (platform !== 'linux' || arch !== 'x64') refuse(`unsupported platform ${platform}/${arch}: only the linux x64 headless-shell layout is accepted`);
  const d = declared(env);
  const entry = (d.json.browsers || []).find((b) => b.name === 'chromium-headless-shell');
  if (!entry || !/^\d+$/.test(String(entry.revision)) || !entry.browserVersion) refuse('declared browsers.json has no usable chromium-headless-shell entry');
  const root = env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== '0'
    ? env.PLAYWRIGHT_BROWSERS_PATH
    : path.join(os.homedir(), '.cache', 'ms-playwright');
  const dir = path.join(root, `chromium_headless_shell-${entry.revision}`);
  const bin = path.join(dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
  if (!fs.existsSync(dir)) refuse(`headless shell revision ${entry.revision} is not installed under ${root}`);
  if (!fs.existsSync(path.join(dir, 'INSTALLATION_COMPLETE'))) refuse(`${dir} has no INSTALLATION_COMPLETE marker`);
  let st;
  try { st = fs.lstatSync(bin); } catch { refuse(`unsupported layout: ${bin} does not exist`); }
  if (st.isSymbolicLink()) refuse(`${bin} is a symlink`);
  if (!st.isFile()) refuse(`${bin} is not a regular file`);
  if ((st.mode & 0o111) === 0) refuse(`${bin} is not executable`);
  const real = fs.realpathSync(bin);
  if (!real.startsWith(fs.realpathSync(dir) + path.sep)) refuse(`${bin} resolves outside its revision directory`);
  const explicit = env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (explicit && path.resolve(explicit) !== bin) refuse(`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH (${explicit}) is not the pinned headless shell`);
  let out;
  try { out = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { refuse(`${bin} --version failed`); }
  const want = `Google Chrome for Testing ${entry.browserVersion}`;
  if (out !== want) refuse(`${bin} --version printed "${out}", expected "${want}"`);
  const sha256 = createHash('sha256').update(fs.readFileSync(bin)).digest('hex');
  return { path: bin, revision: String(entry.revision), browserVersion: entry.browserVersion, playwrightCore: d.core, browsersJson: d.file, version: out, sha256, testOverride: Boolean(env.QLC_TEST_BROWSERS_JSON) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  try {
    if (process.argv[2] !== 'receipt') { console.log('usage: headless-shell.mjs receipt'); process.exit(2); }
    const r = resolveHeadlessShell();
    console.log(`HEADLESS-SHELL playwright-core ${r.playwrightCore}${r.testOverride ? ' (TEST OVERRIDE of browsers.json, local only)' : ''}`);
    console.log(`HEADLESS-SHELL declared chromium-headless-shell revision ${r.revision}, browserVersion ${r.browserVersion}`);
    console.log(`HEADLESS-SHELL binary ${r.path} sha256 ${r.sha256}`);
    console.log(`HEADLESS-SHELL --version: ${r.version}`);
    console.log(`path=${r.path}`);
  } catch (e) {
    console.log(`REFUSED headless shell: ${e instanceof Refused ? e.message : 'unexpected error'}`);
    process.exit(1);
  }
}
