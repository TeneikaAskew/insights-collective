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
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';


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
function canRun(path: string): boolean {
  try {
    execFileSync(path, ['--version'], { stdio: 'ignore', timeout: 20_000 });
    return true;
  } catch {
    return false;
  }
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

  const fallback = SYSTEM_CANDIDATES.find((path) => existsSync(path) && canRun(path));
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
      `${SYSTEM_CANDIDATES.join(', ')}. Install one, or set ` +
      'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to a working binary.',
  );
}

/** `launchOptions`-shaped fragment, empty when the bundled browser is fine. */
export function chromiumExecutableOption(): { executablePath?: string } {
  const path = resolveChromiumExecutable();
  return path ? { executablePath: path } : {};
}
