// ABOUTME: Lifecycle-matrix SYNTHETIC arm (LOCAL candidate, unrun): the dummy page server's fixed bodies, the closed context-option
// ABOUTME: table and its Playwright defaults-merge reproduction, and the injectable, cancellable driver for ONE arm per container.
//
// Design: pr134/e1-lifecycle-matrix-r1/DESIGN-r3.md (with DESIGN-r2, r2.1, r2.2 where r3 keeps them) and the five review
// constraints. Investigation value only: a synthetic arm result never stands in for E1 (no bridge, app, API, Supabase or
// authentic storage state; a different spec and workload).
// One container runs ONE arm (LE_SYN_ARM). Listeners (disclosed, inside that container's own network namespace, loopback only):
// the dummy server (startDummyServer, 127.0.0.1:0, exactly /blank and /doc) and the egress proxy, both started and closed per
// container. Writers: none. The arm owns ONE browser (sandbox-launch.mjs withSandboxedBrowser, unchanged) and its contexts.
// Cancellation (review constraint 5): every browser-facing call, the boundary installation included, goes through guard(), which
// refuses once the arm is aborted, before AND after the call; a handle that resolves late is still retained so cleanup closes it.
// Cleanup is never guarded. A bound that fires aborts, closes, then JOINS the pending work for at most JOIN_MS and records
// JOIN SETTLED or UNRESOLVED. BROWSER_EXIT_OBSERVED is Node seeing the owned browser process exit: NOT a reap of its
// descendants. Per arm, "nothing left" is the host's proof that the container is absent (DESIGN-r3 section 1).
import { CLOSE_TIMEOUT_MS, browserExitLine, browserLogLine, pageTeardownRecord } from './sandbox-launch.mjs';

export const SYN_ARMS = Object.freeze(['A', 'B', 'C', 'D']);
/** Body bound: E1's test timeout (playwright.lesson-editor.config.ts `timeout: 120_000`). */
export const ARM_TIMEOUT_MS = 120_000;
/** How long a bound that fired waits for the pending work to settle before recording JOIN UNRESOLVED. */
export const JOIN_MS = 15_000;
/** Outer bound of the whole arm (launch 60 s + grace 15 s, connect 15 s, body 120 s, context and browser close 10 s each, join
 *  15 s, server close then kill 10 s each). sandbox-launch's own launch bounds fire first. */
export const ARM_OUTER_MS = 265_000;
/** Backstop for the ONE Playwright test: the outer bound plus the proxy and dummy closes (10 s each), rounded up. */
export const SYN_TEST_TIMEOUT_MS = 300_000;

/** Settle `p` (a promise, or a function returning one; a synchronous throw is an error) within `ms` using its OWN timer:
 *  { state: 'OK', value } | { state: 'ERROR', error } | { state: 'TIMEOUT' }. A late settlement is absorbed, never unhandled. */
export function settleWithin(p, ms) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve({ state: 'TIMEOUT' }); } }, ms);
    const fin = (r) => { if (!done) { done = true; clearTimeout(t); resolve(r); } };
    let q;
    try { q = typeof p === 'function' ? Promise.resolve(p()) : Promise.resolve(p); } catch (error) { q = Promise.reject(error); }
    q.then((value) => fin({ state: 'OK', value }), (error) => fin({ state: 'ERROR', error }));
  });
}
const closeState = (r) => (r.state === 'OK' ? 'CLOSED' : r.state);
/** A fixed code from an error: `<CODE>` or `Error: <CODE>` with an upper-case code, else SYN_E_UNCLASSIFIED. */
export function codeOf(e) {
  const m = /^(?:Error: )?([A-Z][A-Z0-9_]{2,63})$/.exec(String(e?.message ?? ''));
  return m ? m[1] : 'SYN_E_UNCLASSIFIED';
}

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
/**
 * Start the dummy server on 127.0.0.1:0. { origin, port, close() -> Promise<'CLOSED'|'TIMEOUT'|'ERROR'> }. close() destroys every
 * tracked socket, then decides from server.close's OWN completion callback (review finding 4), never from `listening`: CLOSED
 * when the callback ran without an error and every still-tracked socket is destroyed; ERROR when it gave an error, threw, or a
 * tracked socket is NOT destroyed; TIMEOUT when the bound (its own timer) fired first. Node 20 runs the callback before a destroyed
 * socket's own 'close' listener untracks it (probe pr134/le-dummy-close-probe-r1: keep-alive and open-request cases 40 of 40), so
 * set membership alone misread every clean close with a live client connection as ERROR.
 */
export async function startDummyServer(http, ms = CLOSE_TIMEOUT_MS) {
  const server = http.createServer(dummyHandler);
  const sockets = new Set();
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); s.on('error', () => s.destroy()); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  const port = server.address().port;
  const close = () => new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } };
    const t = setTimeout(() => fin('TIMEOUT'), ms);
    for (const s of sockets) { try { s.destroy(); } catch { /* still tracked: ERROR below */ } }
    try { server.close((err) => fin(err ? 'ERROR' : [...sockets].every((s) => s.destroyed === true) ? 'CLOSED' : 'ERROR')); } catch { fin('ERROR'); }
  });
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

// --- One arm ------------------------------------------------------------------------------------------------------------
/**
 * One arm. `d` (all injected): withBrowser(onState, use) -> withSandboxedBrowser with readLabel and onAppArmor bound;
 * installBoundary(context, allowed); allowed (the dummy's set); dummy (origin); timeoutMs (body bound), joinMs, closeMs, outerMs;
 * onCall(name) observes each browser-facing call that guard() lets through (controls only).
 * Order (DESIGN-r2 section 4): A newContext, newPage, goto /doc, visible, type 3 characters. B the same with explicit storageState.
 * C newContext, P0 newPage, goto /blank, P0 close AWAITED, then the final newPage. D newContext, newPage, goto /blank, set the
 * storage item, goto /doc on the same page.
 * Returns { arm, status, milestone, exit, log, join, context, browser, primary, line } with `line` the closed arm body.
 * DONE needs: the body completed un-aborted, no failure, JOIN SETTLED, every context and the browser CLOSED, and an observed exit.
 */
export async function runArm(arm, d) {
  const abort = { signaled: false };
  const contexts = [], pages = [];
  const closed = new Set();
  let milestone = 'NONE', state = null, crashed = false, pageTeardown = null, bodyDone = false, primary = null;
  let join = 'SETTLED', contextState = 'NONE', browserState = 'NONE';
  const first = (code) => { primary ??= code; };
  const guard = async (name, fn, keep) => {
    if (abort.signaled) throw new Error('SYN_E_ABORTED');
    d.onCall?.(name);
    const v = await fn();
    if (keep) keep(v); // retained even when the abort came while it was pending, so cleanup can close it
    if (abort.signaled) throw new Error('SYN_E_ABORTED');
    return v;
  };
  const keepPage = (p) => { pages.push(p); try { p.once('crash', () => { crashed = true; }); } catch { /* observation only */ } };
  /** Close every retained context not yet closed (never guarded). Worst state wins: TIMEOUT, then ERROR, then CLOSED. */
  const closeContexts = async () => {
    for (const c of contexts) {
      if (closed.has(c)) continue;
      closed.add(c);
      const s = closeState(await settleWithin(() => c.close(), d.closeMs));
      contextState = contextState === 'TIMEOUT' || s === 'TIMEOUT' ? 'TIMEOUT' : contextState === 'ERROR' || s === 'ERROR' ? 'ERROR' : 'CLOSED';
    }
  };
  const body = async (browser) => {
    const context = await guard('newContext', () => browser.newContext(armCallerOptions(arm, d.dummy)), (c) => contexts.push(c));
    context.setDefaultTimeout(30_000);
    context.setDefaultNavigationTimeout(30_000);
    const b = await guard('installBoundary', () => d.installBoundary(context, d.allowed));
    milestone = 'CONTEXT';
    if (arm === 'C') {
      const p0 = await guard('newPage', () => context.newPage(), keepPage);
      await guard('goto', () => p0.goto(`${d.dummy}/blank`));
      await guard('pageClose', () => p0.close());
    }
    const page = await guard('newPage', () => context.newPage(), keepPage);
    if (arm === 'D') {
      await guard('goto', () => page.goto(`${d.dummy}/blank`));
      await guard('evaluate', () => page.evaluate(() => { globalThis.localStorage.setItem('k', 'v'); }));
    }
    milestone = 'PRELIM';
    await guard('goto', () => page.goto(`${d.dummy}/doc`));
    milestone = 'FINAL_GOTO';
    await guard('waitFor', () => page.locator('#t').waitFor({ state: 'visible' }));
    await guard('waitFor', () => page.locator('#b').waitFor({ state: 'visible' }));
    milestone = 'VISIBLE';
    await guard('click', () => page.locator('#b').click());
    await guard('type', () => page.keyboard.type('abc'));
    milestone = 'TYPED';
    if (b.violations.length !== 0) throw new Error('SYN_E_BOUNDARY');
    if (abort.signaled) throw new Error('SYN_E_ABORTED');
    bodyDone = true;
  };
  const use = async (browser) => {
    const bodyP = body(browser);
    const t = await settleWithin(bodyP, d.timeoutMs);
    if (t.state === 'ERROR') first(codeOf(t.error));
    if (t.state === 'TIMEOUT') {
      abort.signaled = true;
      first('SYN_E_ARM_TIMEOUT');
      await closeContexts();
      browserState = closeState(await settleWithin(() => browser.close(), d.closeMs)); // pending protocol calls now reject
      const j = await settleWithin(bodyP, d.joinMs);
      if (j.state === 'TIMEOUT') join = 'UNRESOLVED';
    }
    const last = pages.at(-1) ?? null;
    pageTeardown = last ? pageTeardownRecord(state, last, crashed) : null;
    await closeContexts(); // late handles retained during the join are closed here
    if (browserState === 'NONE') browserState = closeState(await settleWithin(() => browser.close(), d.closeMs));
  };
  let wbP;
  try { wbP = Promise.resolve(d.withBrowser((s) => { state = s; }, use)); } catch (e) { wbP = Promise.reject(e); }
  const o = await settleWithin(wbP, d.outerMs);
  if (o.state === 'ERROR') first(codeOf(o.error));
  if (o.state === 'TIMEOUT') {
    abort.signaled = true; // a browser that resolves later gets no call but close (guard refuses), whatever happens next
    first('SYN_E_ARM_OUTER_TIMEOUT');
    const j = await settleWithin(wbP, d.joinMs);
    if (j.state === 'TIMEOUT') join = 'UNRESOLVED';
  }
  if (bodyDone) milestone = 'DONE';
  const exit = state ? browserExitLine(state, pageTeardown) : 'UNKNOWN';
  const log = state ? browserLogLine(state) : 'UNKNOWN';
  const seen = /^SHAPE (CODE_\d+|SIG[A-Z_]+) /.test(exit);
  const status = !primary && bodyDone && join === 'SETTLED' && contextState === 'CLOSED' && browserState === 'CLOSED' && seen ? 'DONE' : 'FAILED';
  return { arm, status, milestone, exit, log, join, context: contextState, browser: browserState, primary,
    line: `ARM ${arm} STATUS ${status} M ${milestone} BROWSER_EXIT_OBSERVED ${exit} BROWSER_LOG ${log}` };
}

/**
 * ONE container's arm (DESIGN-r3 sections 2 and 5): its own dummy server and egress proxy, the arm, then the proxy and dummy
 * closes with their tri-states. The FIRST failure stays primary; every cleanup still runs and is recorded; a cleanup state other
 * than CLOSED or SETTLED makes the arm FAILED but never replaces the primary failure.
 * `d`: startDummy(), allowedOrigins(origin), startProxy(allowed) -> { url, close }, withBrowser(proxyUrl) -> (onState, use) => ...,
 * installBoundary, and the bounds. Returns { armLine, cleanupLine, primary, done }.
 */
export async function runContainerArm(arm, d) {
  if (!SYN_ARMS.includes(arm)) return { armLine: null, cleanupLine: null, primary: 'SYN_E_ARM_SELECT', done: false };
  const ms = { timeoutMs: d.timeoutMs ?? ARM_TIMEOUT_MS, joinMs: d.joinMs ?? JOIN_MS, closeMs: d.closeMs ?? CLOSE_TIMEOUT_MS, outerMs: d.outerMs ?? ARM_OUTER_MS };
  let dummy = null, proxy = null, r = null, primary = null, dummyState = 'NONE', proxyState = 'NONE';
  try {
    dummy = await d.startDummy();
    if (!dummyOriginOk(dummy.origin)) throw new Error('SYN_E_DUMMY');
    const allowed = d.allowedOrigins(dummy.origin);
    proxy = await d.startProxy(allowed);
    r = await runArm(arm, { ...ms, dummy: dummy.origin, allowed, installBoundary: d.installBoundary, withBrowser: d.withBrowser(proxy.url), onCall: d.onCall });
    primary = r.primary;
  } catch (e) { primary ??= codeOf(e); } finally {
    if (proxy) proxyState = closeState(await settleWithin(() => proxy.close(), ms.closeMs));
    if (dummy) dummyState = await settleWithin(() => dummy.close(), ms.closeMs).then((x) => (x.state === 'OK' && ['CLOSED', 'TIMEOUT', 'ERROR'].includes(x.value) ? x.value : x.state === 'TIMEOUT' ? 'TIMEOUT' : 'ERROR'));
  }
  const cleanups = { join: r?.join ?? 'SETTLED', context: r?.context ?? 'NONE', browser: r?.browser ?? 'NONE', dummy: dummyState, proxy: proxyState };
  const clean = cleanups.join === 'SETTLED' && ['context', 'browser', 'dummy', 'proxy'].every((k) => cleanups[k] === 'CLOSED');
  const done = !!r && r.status === 'DONE' && clean && !primary;
  if (!primary && !clean) primary = 'SYN_E_CLEANUP';
  const status = done ? 'DONE' : 'FAILED';
  const armLine = r ? `ARM ${arm} STATUS ${status} M ${r.milestone} BROWSER_EXIT_OBSERVED ${r.exit} BROWSER_LOG ${r.log}`
    : `ARM ${arm} STATUS FAILED M NONE BROWSER_EXIT_OBSERVED NOT_RUN BROWSER_LOG NOT_RUN`;
  const cleanupLine = `CLEANUP JOIN ${cleanups.join} CONTEXT ${cleanups.context} BROWSER ${cleanups.browser} DUMMY ${cleanups.dummy} PROXY ${cleanups.proxy}`;
  return { armLine, cleanupLine, primary, done };
}
