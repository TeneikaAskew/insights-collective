#!/usr/bin/env node
// ABOUTME: Loopback HTTP relay to the Supabase project, for environments the browser cannot egress from.
// ABOUTME: Lets the Playwright suite run against real data without changing a single spec.
//
// Why this exists
// ---------------
// In a sandbox whose outbound HTTPS goes through an agent proxy, Chromium cannot
// reach the project at all. Measured, with the same host answering curl in 0.48s:
//
//   direct                                 ERR_CONNECTION_RESET
//   Playwright proxy: {server}             ERR_CONNECTION_RESET
//   --proxy-server=http://host:port        ERR_CONNECTION_RESET
//   --proxy-server=host:port               ERR_CONNECTION_RESET
//   --proxy-bypass-list=<-loopback>        ERR_CONNECTION_RESET
//
// Chromium reaches the proxy fine for plain HTTP — its non-CONNECT requests are
// logged by the proxy and answered 405 — but its HTTPS CONNECT never arrives
// there at all. Node's fetch, meanwhile, works normally.
//
// So: let Node do the talking. The browser makes ordinary same-machine HTTP
// requests to this relay, which forwards them to the real project. Requests are
// genuinely performed and the same egress policy applies, because Node still
// goes through the same proxy. Nothing is faked and no TLS check is weakened —
// the browser simply never has to open an outbound socket.
//
// Point the app at it with VITE_SUPABASE_URL=http://127.0.0.1:<port>. No spec,
// fixture or config change is needed, so all 95 specs and every browser benefit.
//
// Not a production tool. It is plain HTTP by design and belongs on loopback only.
//
// Usage:
//   node scripts/e2e/supabase-relay.mjs [--port 54399] [--target https://<ref>.supabase.co]
//
// Prints `RELAY_URL=http://127.0.0.1:<port>` on the first line so a wrapper can
// read the port back when 0 was requested.

import http from 'node:http';
import { once } from 'node:events';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const TARGET = (arg('target', process.env.E2E_RELAY_TARGET ?? 'https://siuqvhscuiycvdrtiqsh.supabase.co')).replace(/\/$/, '');
const PORT = Number(arg('port', process.env.E2E_RELAY_PORT ?? '54399'));
const HOST = '127.0.0.1';
const VERBOSE = process.env.E2E_RELAY_VERBOSE === '1';

/**
 * Headers that describe *this* hop and must not be copied to the next one.
 *
 * content-length and content-encoding matter most: fetch has already decoded the
 * body, so forwarding the original values describes a payload that no longer
 * exists and the browser stalls waiting for bytes that never come.
 */
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
  'content-encoding', 'content-length',
]);

/** Bodies can carry absolute project URLs — storage links, signed URLs. */
function rewriteBody(buf, contentType, relayOrigin) {
  if (!contentType) return buf;
  if (!/^(application\/json|text\/|application\/xml)/i.test(contentType)) return buf;
  const text = buf.toString('utf8');
  if (!text.includes(TARGET)) return buf;
  // Without this the browser gets a URL back that points at the host it cannot
  // reach, and the request fails one hop later for a reason that looks unrelated.
  return Buffer.from(text.split(TARGET).join(relayOrigin), 'utf8');
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

const server = http.createServer(async (req, res) => {
  const relayOrigin = `http://${HOST}:${server.address().port}`;
  const target = new URL(TARGET);

  try {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (HOP_BY_HOP.has(k) || k === 'host' || k.startsWith(':')) continue;
      headers[k] = v;
    }
    // The project routes on Host; sending the relay's own would 404.
    headers.host = target.host;
    // Origin/Referer still name the relay, which is correct — that is where the
    // request came from, and Supabase's CORS is permissive.

    const upstream = await fetch(TARGET + req.url, {
      method: req.method,
      headers,
      body: await readBody(req),
      redirect: 'manual',
    });

    const body = rewriteBody(
      Buffer.from(await upstream.arrayBuffer()),
      upstream.headers.get('content-type') ?? '',
      relayOrigin,
    );

    const out = {};
    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key)) return;
      // A redirect back to the project host would send the browser somewhere it
      // cannot follow.
      out[key] = key === 'location' ? value.split(TARGET).join(relayOrigin) : value;
    });
    out['access-control-allow-origin'] = req.headers.origin ?? '*';
    out['access-control-allow-credentials'] = 'true';

    if (VERBOSE) console.error(`  ${upstream.status} ${req.method} ${req.url.slice(0, 90)}`);
    res.writeHead(upstream.status, out);
    res.end(body);
  } catch (err) {
    // 502 rather than a hang: a relay that stalls turns one broken request into a
    // navigation timeout, and the test then fails for the wrong reason.
    console.error(`  relay error ${req.method} ${req.url.slice(0, 90)}: ${err.message}`);
    res.writeHead(502, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify({ code: 'RELAY_ERROR', message: err.message }));
  }
});

/**
 * Realtime uses a WebSocket upgrade, which the agent proxy does not support, so
 * there is nothing to forward. Answer immediately instead of leaving the socket
 * open: supabase-js retries a refused connection and moves on, whereas a hanging
 * one keeps the channel in a connecting state for the life of the page.
 *
 * The 8 `supabase.channel()` call sites all fetch first and subscribe second, so
 * pages render normally; only live-update behaviour is unavailable.
 */
server.on('upgrade', (req, socket) => {
  console.error(`  realtime not relayed (proxy has no WebSocket support): ${req.url?.slice(0, 60)}`);
  socket.destroy();
});

server.listen(PORT, HOST);
await once(server, 'listening');

const url = `http://${HOST}:${server.address().port}`;
console.log(`RELAY_URL=${url}`);
console.error(`supabase relay: ${url} -> ${TARGET}`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
