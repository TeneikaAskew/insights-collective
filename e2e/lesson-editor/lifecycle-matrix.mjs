// ABOUTME: Lifecycle-matrix SYNTHETIC arms A to D (LOCAL candidate, unrun): the dummy page server's fixed bodies, the closed
// ABOUTME: context-option table and its Playwright defaults-merge reproduction, and the injectable sequential arm driver.
//
// Design: pr134/e1-lifecycle-matrix-r1/DESIGN-r2.md with r2.1 and r2.2. Investigation value only: a synthetic arm result never
// stands in for E1 (no bridge, app, API, Supabase or authentic storage state; a different spec and workload).
// Listener (disclosed): startDummyServer binds 127.0.0.1:0 inside the lane container's own network namespace, serves exactly
// /blank and /doc (anything else 404), and is closed after arm D with `listening === false` checked. Writers: none.
// Each arm owns ONE browser (the existing sandbox-launch.mjs withSandboxedBrowser, unchanged) and EXACTLY one context, and runs
// inside a fixed per-arm bound equal to E1's test timeout. After every arm the browser's reap must be proven (Node observed the
// owned browser process exit); if it is not, every later arm is NOT_RUN and the matrix is UNRESOLVED. A failure is never
// overwritten. Closing a page does not prove its renderer process exited; no arm claims that.
import { CLOSE_TIMEOUT_MS, bounded, browserExitLine, browserLogLine, pageTeardownRecord, sampleExitShape } from './sandbox-launch.mjs';

export const SYN_ARMS = Object.freeze(['A', 'B', 'C', 'D']);
/** Per-arm body bound: E1's test timeout (playwright.lesson-editor.config.ts `timeout: 120_000`). */
export const ARM_TIMEOUT_MS = 120_000;
/** Backstop for the ONE Playwright test: four arms, each body bound plus launch (60 s + 15 s grace), context and browser close
 *  (10 s each) and server close then kill (10 s each), rounded up. The per-arm bounds fire first. */
export const SYN_TEST_TIMEOUT_MS = 1_000_000;

// --- Dummy server ------------------------------------------------------------------------------------------------------
export const DUMMY_BODIES = Object.freeze({
  '/blank': '<html></html>',
  '/doc': '<!doctype html><html><head><title>syn</title></head><body><input id="t" aria-label="title"><div id="b" contenteditable="true" aria-label="body"></div></body></html>',
});
/** The request handler: GET or HEAD of exactly /blank or /doc gets its fixed body; anything else is 404. No script anywhere. */
export function dummyHandler(req, res) {
  const body = (req.method === 'GET' || req.method === 'HEAD') && Object.prototype.hasOwnProperty.call(DUMMY_BODIES, req.url) ? DUMMY_BODIES[req.url] : null;
  if (body === null) { res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(req.method === 'HEAD' ? undefined : body);
}
/** Start the dummy server on 127.0.0.1:0. { origin, port, close() -> Promise<boolean absent> }. */
export async function startDummyServer(http) {
  const server = http.createServer(dummyHandler);
  const sockets = new Set();
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); s.on('error', () => s.destroy()); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  const port = server.address().port;
  const close = async () => {
    for (const s of sockets) s.destroy();
    await bounded(new Promise((r) => server.close(() => r())), CLOSE_TIMEOUT_MS, 'SYN_E_DUMMY_CLOSE').catch(() => {});
    return server.listening === false;
  };
  return { origin: `http://127.0.0.1:${port}`, port, close };
}
/** The egress proxy's and boundary's allowed set for the dummy: exactly its http origin and ws twin (egress-boundary.ts). */
export function dummyOriginOk(origin) {
  return typeof origin === 'string' && /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.test(origin) && Number(origin.split(':')[2]) <= 65535;
}

// --- Context options ---------------------------------------------------------------------------------------------------
/** Desktop Chrome descriptor userAgent in playwright-core 1.59.1 (deviceDescriptorsSource.json), as E1 gets it. */
export const DESKTOP_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.15 Safari/537.36';
/** DESIGN-r2.1 B table minus baseURL and storageState: the exact effective options of every synthetic context. */
export const SYN_CONTEXT_TABLE = Object.freeze({
  acceptDownloads: true, bypassCSP: false, colorScheme: 'light', deviceScaleFactor: 1, hasTouch: false, isMobile: false,
  ignoreHTTPSErrors: false, javaScriptEnabled: true, locale: 'en-US', offline: false, serviceWorkers: 'block',
  userAgent: DESKTOP_CHROME_UA, viewport: Object.freeze({ width: 1440, height: 900 }),
});
/** The synthetic config's top-level `use` (DESIGN-r2.2 B): the table, contextOptions {}, artifacts off, E1's timeouts. No proxy,
 *  storageState, baseURL, extraHTTPHeaders, geolocation, httpCredentials, permissions, timezoneId, clientCertificates or video. */
export const SYN_USE = Object.freeze({
  trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 30_000, navigationTimeout: 30_000,
  ...SYN_CONTEXT_TABLE, viewport: { width: 1440, height: 900 }, contextOptions: {},
});
/** Arm B's explicit storage state (the key is present, so the defaults merge cannot replace it). */
export const armBStorage = (dummy) => ({ cookies: [], origins: [{ origin: dummy, localStorage: [{ name: 'k', value: 'v' }] }] });
/** The caller options each arm passes to its ONE newContext: none for A, C and D; only storageState for B. Never a proxy. */
export function armCallerOptions(arm, dummy) {
  if (!SYN_ARMS.includes(arm) || !dummyOriginOk(dummy)) throw new Error('armCallerOptions: arm and dummy origin');
  return arm === 'B' ? { storageState: armBStorage(dummy) } : {};
}

/**
 * Reproduction of @playwright/test 1.59.1 lib/index.js: the option fixtures' defaults (L117-L143, each reading `contextOptions`),
 * `baseURL` from PLAYWRIGHT_TEST_BASE_URL (L140-L142), `_combinedContextOptions` (L145-L218: only defined values, clientCertificates
 * only when non-empty, then `{ ...contextOptions, ...options }`). `use` is the resolved top-level+project `use`; `env` the runner env.
 */
export function combinedContextOptions(use, env) {
  const co = use.contextOptions ?? {};
  const pick = (k, dflt) => (use[k] !== undefined ? use[k] : dflt);
  const v = {
    acceptDownloads: pick('acceptDownloads', co.acceptDownloads ?? true), bypassCSP: pick('bypassCSP', co.bypassCSP ?? false),
    colorScheme: pick('colorScheme', co.colorScheme === undefined ? 'light' : co.colorScheme), deviceScaleFactor: pick('deviceScaleFactor', co.deviceScaleFactor),
    extraHTTPHeaders: pick('extraHTTPHeaders', co.extraHTTPHeaders), geolocation: pick('geolocation', co.geolocation), hasTouch: pick('hasTouch', co.hasTouch ?? false),
    httpCredentials: pick('httpCredentials', co.httpCredentials), ignoreHTTPSErrors: pick('ignoreHTTPSErrors', co.ignoreHTTPSErrors ?? false),
    isMobile: pick('isMobile', co.isMobile ?? false), javaScriptEnabled: pick('javaScriptEnabled', co.javaScriptEnabled ?? true),
    locale: pick('locale', co.locale ?? 'en-US'), offline: pick('offline', co.offline ?? false), permissions: pick('permissions', co.permissions),
    proxy: pick('proxy', co.proxy), storageState: pick('storageState', co.storageState), clientCertificates: pick('clientCertificates', co.clientCertificates),
    timezoneId: pick('timezoneId', co.timezoneId), userAgent: pick('userAgent', co.userAgent),
    viewport: pick('viewport', co.viewport === undefined ? { width: 1280, height: 720 } : co.viewport),
    baseURL: pick('baseURL', env.PLAYWRIGHT_TEST_BASE_URL), serviceWorkers: pick('serviceWorkers', co.serviceWorkers ?? 'allow'),
  };
  const options = {};
  for (const k of ['acceptDownloads', 'bypassCSP', 'colorScheme', 'deviceScaleFactor', 'extraHTTPHeaders', 'geolocation', 'hasTouch', 'httpCredentials',
    'ignoreHTTPSErrors', 'isMobile', 'javaScriptEnabled', 'locale', 'offline', 'permissions', 'proxy', 'storageState']) if (v[k] !== undefined) options[k] = v[k];
  if (v.clientCertificates?.length) options.clientCertificates = v.clientCertificates;
  for (const k of ['timezoneId', 'userAgent', 'viewport', 'baseURL', 'serviceWorkers']) if (v[k] !== undefined) options[k] = v[k];
  return { ...co, ...options };
}
/** lib/index.js L283-L288, runBeforeCreateBrowserContext: every combined key NOT `in` the caller's options is filled in. */
export function mergeDefaults(combined, callerOptions) {
  const options = { ...callerOptions };
  for (const [key, value] of Object.entries(combined)) if (!(key in options)) options[key] = value;
  return options;
}
/** The effective options of one arm's context, from the arm, the dummy origin, the resolved `use` and the runner env. */
export const effectiveArmOptions = (arm, dummy, use, env) => mergeDefaults(combinedContextOptions(use, env), armCallerOptions(arm, dummy));

// --- Arms ----------------------------------------------------------------------------------------------------------------
/**
 * One arm. `d` (all injected): withBrowser(onState, use) -> withSandboxedBrowser with readLabel and onAppArmor bound;
 * installBoundary(context, allowed); allowed (the dummy's set); dummy (origin); timeoutMs (per-arm body bound).
 * Order (DESIGN-r2 section 4): A newContext, newPage, goto /doc, visible, type 3 characters. B the same with explicit storageState
 * (Playwright creates and closes its internal page inside newContext). C newContext, P0 newPage, goto /blank, P0 close AWAITED,
 * then the final newPage. D newContext, newPage, goto /blank, set the storage item, goto /doc on the same page.
 * Returns { line, status, milestone, reap } with `line` the closed arm body (synthetic.mjs parseSynArm).
 */
export async function runArm(arm, d) {
  let milestone = 'NONE', state = null, page = null, crashed = false, pageTeardown = null, bodyDone = false, failed = false;
  const body = async (browser) => {
    const context = await browser.newContext(armCallerOptions(arm, d.dummy));
    try {
      context.setDefaultTimeout(30_000);
      context.setDefaultNavigationTimeout(30_000);
      const b = await d.installBoundary(context, d.allowed);
      milestone = 'CONTEXT';
      if (arm === 'C') {
        const p0 = await context.newPage();
        await p0.goto(`${d.dummy}/blank`);
        await p0.close();
      }
      page = await context.newPage();
      try { page.once('crash', () => { crashed = true; }); } catch { /* observation only */ }
      if (arm === 'D') {
        await page.goto(`${d.dummy}/blank`);
        await page.evaluate(() => { globalThis.localStorage.setItem('k', 'v'); });
      }
      milestone = 'PRELIM';
      await page.goto(`${d.dummy}/doc`);
      milestone = 'FINAL_GOTO';
      await page.locator('#t').waitFor({ state: 'visible' });
      await page.locator('#b').waitFor({ state: 'visible' });
      milestone = 'VISIBLE';
      await page.locator('#b').click();
      await page.keyboard.type('abc');
      milestone = 'TYPED';
      if (b.violations.length !== 0) throw new Error('SYN_E_BOUNDARY');
      bodyDone = true;
    } finally {
      pageTeardown = page ? pageTeardownRecord(state, page, crashed) : null;
      await bounded(context.close(), CLOSE_TIMEOUT_MS, 'SYN_E_CONTEXT_CLOSE');
    }
  };
  try {
    await d.withBrowser((s) => { state = s; }, (browser) => bounded(body(browser), d.timeoutMs, 'SYN_E_ARM_TIMEOUT'));
  } catch { failed = true; }
  if (bodyDone) milestone = 'DONE';
  const shape = state ? sampleExitShape(state) : 'UNKNOWN';
  const reap = shape.startsWith('CODE_') || shape.startsWith('SIG') ? 'PROVEN' : 'UNPROVEN';
  const status = !failed && bodyDone && reap === 'PROVEN' ? 'DONE' : 'FAILED';
  const exit = state ? browserExitLine(state, pageTeardown) : 'UNKNOWN';
  const log = state ? browserLogLine(state) : 'UNKNOWN';
  return { status, milestone, reap, line: `ARM ${arm} STATUS ${status} M ${milestone} REAP ${reap} BROWSER_EXIT ${exit} BROWSER_LOG ${log}` };
}

/** Arms A to D in order. After an arm whose reap is not PROVEN, every later arm is NOT_RUN (never started). `note(line)` records each. */
export async function runMatrix(d, note) {
  const results = [];
  let stop = false;
  for (const arm of SYN_ARMS) {
    if (stop) {
      const line = `ARM ${arm} STATUS NOT_RUN M NONE REAP NOT_RUN BROWSER_EXIT NOT_RUN BROWSER_LOG NOT_RUN`;
      results.push({ status: 'NOT_RUN', milestone: 'NONE', reap: 'NOT_RUN', line });
      note(line);
      continue;
    }
    const r = await (d.runArm ?? runArm)(arm, d);
    results.push(r);
    note(r.line);
    if (r.reap !== 'PROVEN') stop = true;
  }
  return { results, allDone: results.every((r) => r.status === 'DONE') };
}
