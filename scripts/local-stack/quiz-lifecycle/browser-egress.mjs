// ABOUTME: Browser-level egress block for the quiz lifecycle mode, shared by its Playwright config and its self-test so
// ABOUTME: the arguments proven by the self-test are byte-for-byte the ones the mode launches with.
// Every non-loopback destination (redirect targets, new pages, worker requests, IP literals) goes to a dead proxy on
// 127.0.0.1:9, and no non-loopback name resolves. Chromium bypasses the proxy for loopback, so the app and API work.
export const BROWSER_EGRESS_ARGS = Object.freeze([
  '--proxy-server=http://127.0.0.1:9',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
]);
