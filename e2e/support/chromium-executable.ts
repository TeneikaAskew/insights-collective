// ABOUTME: Resolves a Chromium binary that can actually launch in this environment.
// ABOUTME: Shared by playwright.config.ts and e2e/global-setup.ts so both agree on the browser.
//
// Why this exists
// ---------------
// Playwright's bundled `chrome-headless-shell` is dynamically linked against the
// host's GTK/glib stack. On a sandbox without those libraries it exits 127 with:
//
//   error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file
//
// Playwright surfaces that as `browserType.launch: Target page, context or
// browser has been closed`, which reads like a flaky browser rather than a
// missing dependency. Worse, it hits global-setup first: the sign-in step cannot
// open a browser, so no storage state is written and every role-scoped project
// then runs SIGNED OUT — the app renders "We couldn't load your account's
// permissions" and specs fail on assertions that have nothing to do with their
// subject.
//
// Setting PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH by hand fixed it, but a suite that
// only works when someone remembers an env var is not a suite you can trust. So
// probe instead: try the bundled binary, and if it cannot even print --version,
// fall back to a system Chromium. The env var still wins when set explicitly.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';


/** Candidate system browsers, in preference order. */
const SYSTEM_CANDIDATES = [
  '/bin/chromium',
  '/usr/bin/chromium',
  '/bin/chromium-browser',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
];

/**
 * A binary that exists is not a binary that runs — the whole failure mode here
 * is an existing file that dies on a missing .so. `--version` is the cheapest
 * launch-equivalent check: it loads the same shared libraries and exits.
 */
function canRun(binary: string): boolean {
  try {
    execFileSync(binary, ['--version'], { stdio: 'ignore', timeout: 20_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Chromium builds already sitting in Playwright's browsers directory.
 *
 * `chromium.executablePath()` is version-stamped — it names the build this
 * Playwright wants (chromium-1217) — so an image that pre-installs a different
 * one leaves it pointing at a path that does not exist. That is not a broken
 * environment; the browser is right there under a neighbouring version number.
 * Measured here: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers holds chromium-1194,
 * which launches and drives the whole suite, while executablePath() named
 * chromium-1217 and the run died claiming no Chromium existed.
 *
 * Newest build first, and the full browser ahead of the headless shell — the
 * shell is the one with the GTK/glib dependency this module exists to route
 * around.
 */
function installedChromiumCandidates(): string[] {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(homedir(), '.cache', 'ms-playwright'),
  ].filter((root): root is string => !!root);

  const found: string[] = [];
  for (const root of roots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    const builds = entries
      .filter((entry) => entry.startsWith('chromium'))
      .sort()
      .reverse()
      .sort((a, b) => Number(a.includes('headless')) - Number(b.includes('headless')));

    for (const build of builds) {
      for (const dir of ['chrome-linux64', 'chrome-linux']) {
        for (const binary of ['chrome', 'headless_shell']) {
          const candidate = path.join(root, build, dir, binary);
          if (existsSync(candidate)) found.push(candidate);
        }
      }
    }
  }
  return found;
}

let cached: string | null | undefined;

/**
 * The Chromium to launch, or `null` to let Playwright use its own default.
 *
 * `null` means "the bundled browser works", which is the normal case in CI and
 * on a developer machine; this whole module is then a no-op.
 */
export function resolveChromiumExecutable(): string | null {
  if (cached !== undefined) return cached;

  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new Error(
        `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH points at a file that does not exist: ${explicit}`,
      );
    }
    cached = explicit;
    return cached;
  }

  // Ask Playwright where its own Chromium lives, and probe it. Resolved through
  // createRequire because this module is imported from an ESM config, where a
  // bare `require` does not exist.
  let bundled: string | undefined;
  try {
    const { chromium } = createRequire(import.meta.url)('@playwright/test');
    bundled = chromium.executablePath();
  } catch {
    bundled = undefined;
  }


  if (bundled && existsSync(bundled) && canRun(bundled)) {
    cached = null;
    return cached;
  }

  const fallback = [...installedChromiumCandidates(), ...SYSTEM_CANDIDATES].find(
    (candidate) => existsSync(candidate) && canRun(candidate),
  );
  if (fallback) {
    console.error(
      `[e2e] Playwright's bundled Chromium cannot launch here${
        bundled ? ` (${bundled})` : ''
      }; using ${fallback} instead.`,
    );
    cached = fallback;
    return cached;
  }

  // Fail loudly. The alternative — returning null and letting the launch fail
  // inside global-setup — is what produced the signed-out runs this module
  // exists to prevent.
  throw new Error(
    '[e2e] No launchable Chromium found. The bundled browser fails to start (usually a ' +
      'missing system library such as libglib-2.0.so.0) and none of these exist or run: ' +
      `${[...installedChromiumCandidates(), ...SYSTEM_CANDIDATES].join(', ')}. Install one, or set ` +
      'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to a working binary.',
  );
}

/** `launchOptions`-shaped fragment, empty when the bundled browser is fine. */
export function chromiumExecutableOption(): { executablePath?: string } {
  const path = resolveChromiumExecutable();
  return path ? { executablePath: path } : {};
}

// ---------------------------------------------------------------------------
// Firefox
// ---------------------------------------------------------------------------
//
// Same failure mode, different browser. `firefox.executablePath()` is
// version-stamped (firefox-1511) while the environment provisions a
// neighbouring build (firefox-1495), and the stamped one dies on a missing
// libgtk-3.so.0 — which Playwright reports as "Target page, context or browser
// has been closed" and every firefox-project spec then fails in a few ms.

/** Candidate system Firefox binaries, in preference order. */
const SYSTEM_FIREFOX_CANDIDATES = [
  '/bin/firefox',
  '/usr/bin/firefox',
  '/usr/bin/firefox-esr',
];

/** Firefox builds already sitting in Playwright's browsers directory. */
function installedFirefoxCandidates(): string[] {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(homedir(), '.cache', 'ms-playwright'),
  ].filter((root): root is string => !!root);

  const found: string[] = [];
  for (const root of roots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    const builds = entries
      .filter((entry) => entry.startsWith('firefox'))
      .sort()
      .reverse();

    for (const build of builds) {
      const candidate = path.join(root, build, 'firefox', 'firefox');
      if (existsSync(candidate)) found.push(candidate);
    }
  }
  return found;
}

let cachedFirefox: string | null | undefined;

/** The Firefox to launch, or `null` to let Playwright use its own default. */
export function resolveFirefoxExecutable(): string | null {
  if (cachedFirefox !== undefined) return cachedFirefox;

  const explicit = process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH;
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new Error(
        `PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH points at a file that does not exist: ${explicit}`,
      );
    }
    cachedFirefox = explicit;
    return cachedFirefox;
  }

  let bundled: string | undefined;
  try {
    const { firefox } = createRequire(import.meta.url)('@playwright/test');
    bundled = firefox.executablePath();
  } catch {
    bundled = undefined;
  }

  if (bundled && existsSync(bundled) && canRun(bundled)) {
    cachedFirefox = null;
    return cachedFirefox;
  }

  const fallback = [...installedFirefoxCandidates(), ...SYSTEM_FIREFOX_CANDIDATES].find(
    (candidate) => existsSync(candidate) && canRun(candidate),
  );
  if (fallback) {
    console.error(
      `[e2e] Playwright's bundled Firefox cannot launch here${
        bundled ? ` (${bundled})` : ''
      }; using ${fallback} instead.`,
    );
    cachedFirefox = fallback;
    return cachedFirefox;
  }

  throw new Error(
    '[e2e] No launchable Firefox found. The bundled browser fails to start (usually a ' +
      'missing system library such as libgtk-3.so.0) and none of these exist or run: ' +
      `${[...installedFirefoxCandidates(), ...SYSTEM_FIREFOX_CANDIDATES].join(', ')}. Install one, or ` +
      'set PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH to a working binary.',
  );
}

/** `launchOptions`-shaped fragment, empty when the bundled Firefox is fine. */
export function firefoxExecutableOption(): { executablePath?: string } {
  const resolved = resolveFirefoxExecutable();
  return resolved ? { executablePath: resolved } : {};
}
