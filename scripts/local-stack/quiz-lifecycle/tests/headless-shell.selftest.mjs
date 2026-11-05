// ABOUTME: Refusal and positive cases for the headless-shell pin, on fake browser layouts: every refusal happens before any
// ABOUTME: launch (the fake binary records every non --version invocation, and those must stay at zero).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { resolveHeadlessShell, Refused } from '../headless-shell.mjs';

const REV = '9999';
const VER = '1.2.3.4';

function layout({ rev = REV, version = VER, marker = true, mode = 0o755, symlink = false, binName = 'chrome-headless-shell', subdir = 'chrome-headless-shell-linux64' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-'));
  const launches = path.join(root, 'launches');
  fs.writeFileSync(launches, '');
  const json = path.join(root, 'browsers.json');
  fs.writeFileSync(json, JSON.stringify({ browsers: [{ name: 'chromium-headless-shell', revision: REV, browserVersion: VER }] }));
  const dir = path.join(root, `chromium_headless_shell-${rev}`);
  fs.mkdirSync(path.join(dir, subdir), { recursive: true });
  if (marker) fs.writeFileSync(path.join(dir, 'INSTALLATION_COMPLETE'), '');
  const script = `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "Google Chrome for Testing ${version}"; exit 0; fi\necho "$@" >> "${launches}"\n`;
  const bin = path.join(dir, subdir, binName);
  if (symlink) {
    const target = path.join(root, 'elsewhere');
    fs.writeFileSync(target, script, { mode });
    fs.symlinkSync(target, bin);
  } else fs.writeFileSync(bin, script, { mode });
  const env = { PLAYWRIGHT_BROWSERS_PATH: root, QLC_TEST_BROWSERS_JSON: json };
  return { root, dir, bin: path.join(dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell'), env, launches };
}

const refused = (fn, re) => assert.throws(fn, (e) => e instanceof Refused && re.test(e.message));
const noLaunch = (l) => assert.equal(fs.readFileSync(l.launches, 'utf8'), '', 'the binary was invoked beyond --version');

test('H1 positive: exact revision, layout, marker and version resolve to the pinned path', () => {
  const l = layout();
  const r = resolveHeadlessShell(l.env, 'linux', 'x64');
  assert.equal(r.path, l.bin);
  assert.equal(r.revision, REV);
  assert.equal(r.version, `Google Chrome for Testing ${VER}`);
  assert.match(r.sha256, /^[0-9a-f]{64}$/);
  assert.equal(r.testOverride, true);
  noLaunch(l);
});

test('H2 missing revision directory (only another revision installed): REFUSED', () => {
  const l = layout({ rev: '1111' });
  refused(() => resolveHeadlessShell(l.env, 'linux', 'x64'), /revision 9999 is not installed/);
  noLaunch(l);
});

test('H3 no INSTALLATION_COMPLETE marker: REFUSED', () => {
  const l = layout({ marker: false });
  refused(() => resolveHeadlessShell(l.env, 'linux', 'x64'), /INSTALLATION_COMPLETE/);
  noLaunch(l);
});

test('H4 unsupported layout (full-browser chrome-linux64/chrome only): REFUSED', () => {
  const l = layout({ subdir: 'chrome-linux64', binName: 'chrome' });
  refused(() => resolveHeadlessShell(l.env, 'linux', 'x64'), /unsupported layout/);
  noLaunch(l);
});

test('H5 binary is a symlink: REFUSED', () => {
  const l = layout({ symlink: true });
  refused(() => resolveHeadlessShell(l.env, 'linux', 'x64'), /symlink/);
});

test('H6 binary not executable: REFUSED', () => {
  const l = layout({ mode: 0o644 });
  refused(() => resolveHeadlessShell(l.env, 'linux', 'x64'), /not executable/);
});

test('H7 tampered binary reporting another version: REFUSED, never launched', () => {
  const l = layout({ version: '9.9.9.9' });
  refused(() => resolveHeadlessShell(l.env, 'linux', 'x64'), /expected "Google Chrome for Testing 1\.2\.3\.4"/);
  noLaunch(l);
});

test('H8 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH pointing elsewhere (e.g. /bin/chromium): REFUSED', () => {
  const l = layout();
  refused(() => resolveHeadlessShell({ ...l.env, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/bin/chromium' }, 'linux', 'x64'), /not the pinned headless shell/);
  noLaunch(l);
});

test('H8b PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH equal to the pin is accepted', () => {
  const l = layout();
  assert.equal(resolveHeadlessShell({ ...l.env, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: l.bin }, 'linux', 'x64').path, l.bin);
});

test('H9 unsupported platform: REFUSED', () => {
  const l = layout();
  refused(() => resolveHeadlessShell(l.env, 'darwin', 'arm64'), /unsupported platform/);
});

test('H10 the test-only browsers.json override is REFUSED in CI', () => {
  const l = layout();
  refused(() => resolveHeadlessShell({ ...l.env, CI: 'true' }, 'linux', 'x64'), /test-only/);
  refused(() => resolveHeadlessShell({ ...l.env, GITHUB_ACTIONS: 'true' }, 'linux', 'x64'), /test-only/);
});

test('H11 without the override, the declared playwright-core browsers.json is used (no environment can choose the revision)', () => {
  const l = layout();
  const env = { PLAYWRIGHT_BROWSERS_PATH: l.root };
  // The installed playwright-core declares a real revision (not 9999), so this fake root has nothing to offer: REFUSED.
  refused(() => resolveHeadlessShell(env, 'linux', 'x64'), /is not installed under/);
});

test('H12 agreement: the pinned path is exactly the one Playwright\'s own registry names for chromium-headless-shell', () => {
  // Uses playwright-core's registry (internal module) only in this test, to prove the layout this module accepts is the one
  // Playwright itself installs and launches for this package revision. Same PLAYWRIGHT_BROWSERS_PATH in both.
  const req = createRequire(import.meta.url);
  const pw = createRequire(req.resolve('@playwright/test/package.json')).resolve('playwright/package.json');
  const core = path.dirname(createRequire(pw).resolve('playwright-core/package.json'));
  const { registry } = req(path.join(core, 'lib/server/registry/index.js'));
  const expected = registry.findExecutable('chromium-headless-shell').executablePath('javascript');
  const declaredRev = JSON.parse(fs.readFileSync(path.join(core, 'browsers.json'), 'utf8')).browsers.find((b) => b.name === 'chromium-headless-shell').revision;
  assert.ok(expected.includes(`chromium_headless_shell-${declaredRev}${path.sep}chrome-headless-shell-linux64${path.sep}chrome-headless-shell`), expected);
  // Build that exact layout (fake binary) under the same root the registry used, and resolve it with NO override.
  const root = expected.split(`${path.sep}chromium_headless_shell-`)[0];
  if (!fs.existsSync(path.dirname(expected))) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-reg-'));
    const bin = path.join(tmp, `chromium_headless_shell-${declaredRev}`, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(path.join(tmp, `chromium_headless_shell-${declaredRev}`, 'INSTALLATION_COMPLETE'), '');
    const ver = JSON.parse(fs.readFileSync(path.join(core, 'browsers.json'), 'utf8')).browsers.find((b) => b.name === 'chromium-headless-shell').browserVersion;
    fs.writeFileSync(bin, `#!/bin/sh\necho "Google Chrome for Testing ${ver}"\n`, { mode: 0o755 });
    const r = resolveHeadlessShell({ PLAYWRIGHT_BROWSERS_PATH: tmp }, 'linux', 'x64');
    assert.equal(path.relative(tmp, r.path), path.relative(root, expected));
  } else {
    assert.equal(resolveHeadlessShell({ PLAYWRIGHT_BROWSERS_PATH: root }, 'linux', 'x64').path, expected);
  }
});
