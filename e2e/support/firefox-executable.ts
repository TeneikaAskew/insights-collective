// ABOUTME: Decides whether the cross-browser Firefox project can run at all here.
// ABOUTME: A browser that cannot start should skip, not report failures with no signal.
//
// Why this exists
// ---------------
// A full relay run in the Lovable sandbox reported 22 failures, every one of
// them `[firefox]`, every one failing in 3-17ms — far too fast to have loaded a
// page. That is not a broken application and not a broken spec: it is a browser
// that never launched, and Playwright surfaces it per-test rather than once.
//
// The cost is not the red count, it is what the red count does to a reader.
// Someone triaging that run has to open 22 results, notice they are all one
// browser, notice the impossible durations, and conclude by hand that none of
// them carry information either way. Meanwhile a genuine Firefox regression
// would look exactly the same, so the noise cannot be distinguished from signal.
//
// So probe, following the pattern e2e/support/chromium-executable.ts already
// sets for the same class of problem: an existing binary is not a runnable one.
// If Firefox cannot start, drop the project and say so loudly, once.
//
// This deliberately does NOT weaken CI. .github/workflows/e2e.yml installs the
// browser explicitly:
//
//     npx playwright install --with-deps chromium firefox
//
// so a CI runner always has a launchable Firefox and this module is a no-op
// there. If that install ever breaks, the install step fails first — CI never
// silently loses cross-browser coverage to this check.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

let cached: boolean | undefined;

/**
 * `--version` is the cheapest launch-equivalent check: it loads the same shared
 * libraries the real launch would and exits immediately. Verified against the
 * working binary here, which answers "Mozilla Firefox 148.0.2" and exits 0.
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
 * Whether Playwright's Firefox can actually start in this environment.
 *
 * Resolved through createRequire because this is imported from an ESM config,
 * where a bare `require` does not exist — same reason chromium-executable.ts
 * does it.
 */
export function firefoxCanLaunch(): boolean {
  if (cached !== undefined) return cached;

  // An explicit opt-out, for running the rest of the suite quickly without
  // waiting on a browser you do not care about right now.
  if (process.env.E2E_SKIP_FIREFOX === '1') {
    cached = false;
    return cached;
  }

  let bundled: string | undefined;
  try {
    const { firefox } = createRequire(import.meta.url)('@playwright/test');
    bundled = firefox.executablePath();
  } catch {
    bundled = undefined;
  }

  cached = !!bundled && existsSync(bundled) && canRun(bundled);
  return cached;
}
