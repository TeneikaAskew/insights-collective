#!/usr/bin/env node
// ABOUTME: REVIEW DIFF (unapplied). Enforces the ONE reviewed browser before build/start: the exact resolved Playwright
// ABOUTME: chain, the declared revision/version, the --version line and the binary sha256. Fixed codes only; fail closed.
//
//   browser-pin.mjs <expected shell path> [repo]   -> BPIN_<K> OK lines, then BPIN_OK (exit 0) or BPIN_E_<K> lines, BPIN_FAIL (exit 1)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { BROWSER_PATH_RE, BROWSER_PIN } from './expect.mjs';
import { resolveHeadlessShell } from '../../local-stack/quiz-lifecycle/headless-shell.mjs';

export const BPIN_ORDER = Object.freeze(['RESOLVE', 'PLAYWRIGHT_TEST', 'PLAYWRIGHT', 'PLAYWRIGHT_CORE', 'CORE_SAME', 'PROBE_CORE', 'REVISION', 'BROWSER_VERSION', 'VERSION_LINE', 'PATH', 'SHA256', 'TEST_OVERRIDE']);

/** The versions actually resolved from `fromFile`: @playwright/test -> playwright -> playwright-core (the runtime chain). */
export function resolvedChain(fromFile, readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8')), mk = createRequire) {
  const t = mk(fromFile).resolve('@playwright/test/package.json');
  const p = mk(t).resolve('playwright/package.json');
  const c = mk(p).resolve('playwright-core/package.json');
  return { test: readJson(t).version, playwright: readJson(p).version, core: readJson(c).version, coreDir: path.dirname(c) };
}

/** The playwright-core directory the in-container probe actually loads: inner-probe.mjs resolves 'playwright-core' from
 * <repo>/package.json, which is NOT the @playwright/test chain, so the two must be proven to be the same install. */
export function probeCoreDir(repo, mk = createRequire) {
  return path.dirname(mk(path.join(repo, 'package.json')).resolve('playwright-core/package.json'));
}

const attempt = (f) => { try { return f(); } catch { return null; } };

/** Pure verdict. `r` is resolveHeadlessShell()'s result (or null if it refused); `chain` is resolvedChain() (or null). */
export function verdict(r, chain, expectedPath, probeDir) {
  const ok = {
    RESOLVE: r != null && chain != null,
    PLAYWRIGHT_TEST: chain?.test === BROWSER_PIN.PLAYWRIGHT_TEST,
    PLAYWRIGHT: chain?.playwright === BROWSER_PIN.PLAYWRIGHT,
    PLAYWRIGHT_CORE: chain?.core === BROWSER_PIN.PLAYWRIGHT_CORE && r?.playwrightCore === BROWSER_PIN.PLAYWRIGHT_CORE,
    CORE_SAME: typeof r?.browsersJson === 'string' && typeof chain?.coreDir === 'string' && path.dirname(r.browsersJson) === chain.coreDir,
    PROBE_CORE: typeof probeDir === 'string' && typeof chain?.coreDir === 'string' && probeDir === chain.coreDir,
    REVISION: r?.revision === BROWSER_PIN.REVISION,
    BROWSER_VERSION: r?.browserVersion === BROWSER_PIN.BROWSER_VERSION,
    VERSION_LINE: r?.version === BROWSER_PIN.VERSION_LINE,
    PATH: typeof r?.path === 'string' && r.path === expectedPath && BROWSER_PATH_RE.test(r.path),
    SHA256: r?.sha256 === BROWSER_PIN.SHA256,
    TEST_OVERRIDE: r?.testOverride === false,
  };
  const lines = BPIN_ORDER.map((k) => (ok[k] ? `BPIN_${k} OK` : `BPIN_E_${k}`));
  const pass = BPIN_ORDER.every((k) => ok[k]);
  lines.push(pass ? 'BPIN_OK' : 'BPIN_FAIL');
  return { ok: pass, lines };
}

if (process.argv[1] && /browser-pin\.mjs$/.test(process.argv[1])) {
  const [expectedPath, repoArg] = process.argv.slice(2);
  const repo = path.resolve(repoArg ?? '.');
  const r = attempt(() => resolveHeadlessShell());
  // Resolve from headless-shell.mjs, exactly as resolveHeadlessShell() does, so CORE_SAME compares like with like.
  const chain = attempt(() => resolvedChain(path.join(repo, 'scripts/local-stack/quiz-lifecycle/headless-shell.mjs')));
  const probeDir = attempt(() => probeCoreDir(repo));
  const { ok, lines } = verdict(r, chain, expectedPath, probeDir);
  for (const l of lines) console.log(l);
  process.exit(ok ? 0 : 1);
}
