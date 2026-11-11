// ABOUTME: Loopback allowlist proxy that the lesson-editor browser is forced through (loopback included, `<-loopback>`), so EVERY
// ABOUTME: connection the browser opens (redirect hops, popups, second tabs, WebSocket CONNECT) reaches only the exact allowed origins.
//
// Forwarding is transparent for allowed origins: method, path, headers and body pass through unchanged, responses (including any
// 3xx) are returned as received, and nothing is followed, cached, fulfilled or modified. Anything else gets 403 before any
// upstream connection is opened. Refusals record only a reason and an origin. Runs inside the Playwright worker; listens on
// 127.0.0.1 with an ephemeral port.
import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';

export type EgressProxy = { url: string; refused: string[]; forwarded: number; close: () => Promise<void> };

const HOP = new Set(['proxy-connection', 'proxy-authorization', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'te', 'trailer']);

export async function startEgressProxy(allowed: Set<string>): Promise<EgressProxy> {
  const refused: string[] = [];
  const state = { forwarded: 0 };
  const sockets = new Set<net.Socket>();
  const deny = (why: string, origin: string) => refused.push(`${why} ${origin}`);
  const server = http.createServer((req, res) => {
    let target: URL;
    try {
      target = new URL(req.url ?? '');
    } catch {
      deny('unparseable', '<unparseable>');
      res.writeHead(403).end();
      return;
    }
    if (target.protocol !== 'http:' || !allowed.has(target.origin)) {
      deny('refused', target.origin);
      res.writeHead(403, { 'Content-Type': 'text/plain' }).end('egress boundary');
      return;
    }
    const headers: http.OutgoingHttpHeaders = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k)) headers[k] = v;
    state.forwarded++;
    const up = http.request(
      { host: target.hostname, port: target.port, method: req.method, path: target.pathname + target.search, headers },
      (ur) => {
        const out: http.OutgoingHttpHeaders = {};
        for (const [k, v] of Object.entries(ur.headers)) if (!HOP.has(k)) out[k] = v;
        res.writeHead(ur.statusCode ?? 502, out);
        ur.pipe(res);
      },
    );
    up.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.on('error', () => up.destroy());
    res.on('error', () => up.destroy());
    req.pipe(up);
  });
  // CONNECT is how Chromium tunnels ws:// (and https://) through an HTTP proxy.
  server.on('connect', (req, client: net.Socket, head: Buffer) => {
    const [host, port] = (req.url ?? '').split(/:(?=\d+$)/);
    const asHttp = `http://${host}:${port}`;
    const asWs = `ws://${host}:${port}`;
    if (!host || !port || !(allowed.has(asWs) || allowed.has(asHttp))) {
      deny('refused tunnel', asHttp);
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    state.forwarded++;
    const up = net.connect(Number(port), host, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) up.write(head);
      up.pipe(client);
      client.pipe(up);
    });
    up.on('error', () => client.destroy());
    client.on('error', () => up.destroy());
  });
  // A browser closing mid-exchange resets its sockets; that is not an egress event and must not crash the worker.
  server.on('clientError', (_e, s: net.Socket) => s.destroy());
  server.on('connection', (s) => {
    s.on('error', () => s.destroy());
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    refused,
    get forwarded() {
      return state.forwarded;
    },
    close: () =>
      new Promise<void>((r) => {
        for (const s of sockets) s.destroy();
        server.close(() => r());
      }),
  } as EgressProxy;
}
