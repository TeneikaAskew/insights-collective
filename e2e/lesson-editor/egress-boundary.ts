// ABOUTME: Preventive browser egress boundary for the lesson-editor spec: only the exact app and API origins may be reached, from
// ABOUTME: every page of the context (second tabs, popups), for HTTP and WebSocket; redirects and service workers are violations.
//
// Layers (each independent; the self-test proves every one on real Chromium, with an unprotected control):
//   1. Resolver (the repository's shared hermetic rule from playwright.config.ts relay mode, plus one exclusion):
//      `MAP * 127.0.0.1:1,EXCLUDE localhost,EXCLUDE 127.0.0.1`. Any other host resolves to a closed port. Observed on this
//      Chromium (1243): `MAP *` ALSO rewrites the 127.0.0.1 IP literal (the shared config's comment says it does not), so
//      without `EXCLUDE 127.0.0.1` the loopback app itself is unreachable. Other loopback PORTS are not covered by this layer.
//   2. context.route('**/*'): a request whose ORIGIN is not exactly allowed is ABORTED before it is sent; allowed ones CONTINUE
//      unchanged. Nothing is ever fulfilled or modified, so this is a filter, not a stub.
//   3. context.routeWebSocket: a socket to a non-allowed origin is closed without connecting.
//   4. Observation (fail closed at test end): every request seen with a non-allowed origin, ANY redirect hop, any service worker
//      and any unparseable URL is a violation. `serviceWorkers: 'block'` in the config stops registration in the first place.
// Violation text carries only a reason and an origin (scheme://host:port), never a path, query, header or body.
import type { BrowserContext, Request } from '@playwright/test';

export type Boundary = { violations: string[]; aborted: number };

const originOf = (u: string): string | null => {
  try {
    const x = new URL(u);
    return x.origin === 'null' ? null : x.origin;
  } catch {
    return null;
  }
};
const LOCAL_SCHEMES = /^(data|blob|about):/;

/** Allowed origins: the http(s) origins given plus their ws(s) twins (Supabase realtime uses ws on the API origin). */
export function allowedOrigins(...origins: string[]): Set<string> {
  const out = new Set<string>();
  for (const o of origins) {
    const x = new URL(o);
    if (x.pathname !== '/' || x.search || x.hash || x.username || x.password) throw new Error('allowedOrigins: origin only');
    out.add(x.origin);
    out.add(x.origin.replace(/^http/, 'ws'));
  }
  return out;
}

export async function installBoundary(context: BrowserContext, allowed: Set<string>): Promise<Boundary> {
  const b: Boundary = { violations: [], aborted: 0 };
  const note = (why: string, u: string) => b.violations.push(`${why} ${originOf(u) ?? '<unparseable>'}`);
  await context.route('**/*', async (route) => {
    const u = route.request().url();
    if (LOCAL_SCHEMES.test(u)) return route.continue();
    const o = originOf(u);
    if (o && allowed.has(o)) return route.continue();
    b.aborted++;
    note('blocked', u);
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket(() => true, (ws) => {
    const o = originOf(ws.url());
    if (o && allowed.has(o)) {
      ws.connectToServer();
      return;
    }
    b.aborted++;
    note('blocked websocket', ws.url());
    ws.close({ code: 1008, reason: 'egress boundary' });
  });
  context.on('request', (req: Request) => {
    const u = req.url();
    if (LOCAL_SCHEMES.test(u)) return;
    const o = originOf(u);
    if (!o || !allowed.has(o)) note('request to', u);
    if (req.redirectedFrom()) note('redirect to', u);
  });
  context.on('serviceworker', (w) => note('service worker', w.url()));
  return b;
}
