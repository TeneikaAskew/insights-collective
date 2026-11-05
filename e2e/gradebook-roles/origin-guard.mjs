// ABOUTME: PREVENTIVE origin guard for every gradebook-roles browser context: a request to anything but the exact approved
// ABOUTME: origins is aborted BEFORE it is sent (redirects, popups, frames, workers and WebSockets included), and recorded.
//
// How each path is covered:
//  - context.route('**/*') sees every page/popup/frame/worker request of the context. Disallowed: route.abort() (nothing
//    leaves the browser). Allowed: route.fetch({ maxRedirects: 0 }) + route.fulfill(), so the REAL local response is
//    returned unchanged. Redirects are followed inside the handler hop by hop, each hop's origin judged BEFORE it is
//    fetched (see below); the browser itself never follows a redirect.
//  - context.routeWebSocket(/.*/) judges every WebSocket by origin (ws->http, wss->https) before connecting.
//  - Service workers are blocked at context creation (serviceWorkers: 'block' in the config and in newGuardedContext), so
//    no worker can fetch outside the route.
// Only http(s) and ws(s) URLs are routed by the browser; data:/blob:/about: never reach the network.

/** @param {string} raw */
export function originOf(raw) {
  const u = new URL(raw);
  const scheme = u.protocol === 'ws:' ? 'http:' : u.protocol === 'wss:' ? 'https:' : u.protocol;
  return `${scheme}//${u.host}`;
}

/**
 * Install the guard on a context. Returns the live list of blocked attempts (origin + kind; never the full URL, so no
 * query string or token is ever echoed).
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string[]} approvedOrigins exact origins, e.g. ['http://127.0.0.1:8080', 'http://127.0.0.1:54321']
 */
export async function installOriginGuard(context, approvedOrigins) {
  const approved = new Set(approvedOrigins.map((o) => originOf(o)));
  if (approved.size === 0) throw new Error('origin guard: no approved origins');
  /** @type {Array<{ origin: string, kind: string }>} */
  const blocked = [];
  await context.route('**/*', async (route) => {
    const req = route.request();
    let origin;
    try { origin = originOf(req.url()); } catch { blocked.push({ origin: 'unparseable', kind: req.resourceType() }); return route.abort('blockedbyclient'); }
    if (!approved.has(origin)) { blocked.push({ origin, kind: req.resourceType() }); return route.abort('blockedbyclient'); }
    // Redirects are followed HERE, hop by hop, never by the browser: a request the browser issues to follow a fulfilled
    // 3xx is not routed again (observed in origin-guard-selftest N2), so handing a 3xx back would let its target escape.
    // Every hop's origin is judged before it is fetched; the final non-3xx response is returned. A redirect on a write
    // (non-GET/HEAD) is refused outright, since re-issuing a body to a new URL is never needed by this app.
    let url = req.url();
    for (let hop = 0; ; hop++) {
      let response;
      try { response = await route.fetch({ url, maxRedirects: 0 }); } catch { return route.abort('failed'); }
      const status = response.status();
      if (status < 300 || status > 399 || status === 304) return route.fulfill({ response });
      const location = response.headers()['location'];
      if (!location || hop >= 5) { blocked.push({ origin: 'redirect-unresolvable', kind: req.resourceType() }); return route.abort('blockedbyclient'); }
      const next = new URL(location, url).toString();
      let nextOrigin;
      try { nextOrigin = originOf(next); } catch { nextOrigin = 'unparseable'; }
      if (!approved.has(nextOrigin)) { blocked.push({ origin: nextOrigin, kind: `${req.resourceType()}-redirect` }); return route.abort('blockedbyclient'); }
      if (!['GET', 'HEAD'].includes(req.method())) { blocked.push({ origin: nextOrigin, kind: `redirect-on-${req.method()}` }); return route.abort('blockedbyclient'); }
      url = next;
    }
  });
  await context.routeWebSocket(/.*/, (ws) => {
    let origin;
    try { origin = originOf(ws.url()); } catch { origin = 'unparseable'; }
    if (!approved.has(origin)) { blocked.push({ origin, kind: 'websocket' }); return ws.close({ code: 1008, reason: 'origin not approved' }); }
    ws.connectToServer();
  });
  return blocked;
}

/** A context created with service workers blocked and the guard installed before any page exists. */
export async function newGuardedContext(browser, approvedOrigins, options = {}) {
  const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
  const blocked = await installOriginGuard(context, approvedOrigins);
  return { context, blocked };
}
