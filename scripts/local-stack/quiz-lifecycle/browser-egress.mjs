// ABOUTME: Browser-level egress confinement for the quiz lifecycle mode, shared by its Playwright config, its session
// ABOUTME: fixture and its self-test, so what the self-test proves is byte-for-byte what the mode launches with.
//
// Chromium's IMPLICIT proxy bypass sends localhost, 127.0.0.0/8, [::1], 169.254.0.0/16 and [fe80::]/10 DIRECT whatever
// the proxy is (Chromium net/docs/proxy.md, "Implicit bypass rules"). The documented rule "<-loopback>" subtracts all of
// them. exactBypassList() therefore starts with "<-loopback>" and then adds ONLY the exact approved scheme://host:port
// entries; every other destination, including another loopback port, link-local and anything a redirect points to,
// goes to the refusal proxy started by the session fixture (a local listener this test process owns, which answers 403
// and never forwards). No assumption is made about any port being dead.
export const BROWSER_EGRESS_ARGS = Object.freeze([
  // Defence in depth only: names other than loopback do not resolve in the browser.
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
]);

const HOSTS = new Set(['127.0.0.1', 'localhost']);

/** "<-loopback>,http://127.0.0.1:8080,..." for exact approved origins; throws on anything not explicit and loopback. */
export function exactBypassList(origins) {
  const rules = ['<-loopback>'];
  for (const o of origins) {
    const u = new URL(o);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('approved origin must be http or https');
    if (!HOSTS.has(u.hostname)) throw new Error('approved origin must be 127.0.0.1 or localhost');
    if (!/^[0-9]{1,5}$/.test(u.port)) throw new Error('approved origin must name an explicit port');
    if (u.pathname !== '/' || u.search || u.hash || u.username || u.password) throw new Error('approved origin must be a bare origin');
    rules.push(`${u.protocol}//${u.hostname}:${u.port}`);
  }
  return rules.join(',');
}
