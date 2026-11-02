#!/usr/bin/env node
// ABOUTME: The one HTTP path for every credential-bearing T-09 request (personas, readiness, API controls): a strictly parsed
// ABOUTME: loopback origin, checked BEFORE any key is read into a request, and redirects refused so no apikey follows another origin.
//
// Origin rule (uses the repository's fail-closed classifier, scripts/e2e/assert-safe-target.mjs classifyTarget):
//   accepted only as   http://127.0.0.1:<port>  |  http://localhost:<port>  |  http://[::1]:<port>   (optionally one trailing /)
//   refused: userinfo (a value whose "127.0.0.1:<port>" part sits before an at-sign parses to host.invalid WITH userinfo), any other host, https,
//            a missing or non-numeric port, any path, query or fragment, encoded or whitespace hosts, unparseable values.
//   The string is parsed by WHATWG URL, never prefix-matched, and the accepted value is re-serialized from its parts.
// Redirects: fetch runs with redirect:'error' and any 3xx status is refused as well, so a credential header is sent to
//   exactly one origin and is never replayed elsewhere.
// CLI: api-http.mjs check <url>              exit 0 if acceptable (prints the canonical origin), else exit 2
//      api-http.mjs ready <url> <anon file>  bounded readiness poll of GET /rest/v1/ (20 x 1 s), exit 0 when HTTP 200
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyTarget } from '../../e2e/assert-safe-target.mjs';

export class TargetRefused extends Error {}
export class RedirectRefused extends Error {}

/** Canonical loopback origin ("http://127.0.0.1:54321") or throws TargetRefused. Never echoes the raw value. */
export function apiOrigin(raw) {
  if (typeof raw !== 'string' || raw.trim() !== raw || raw === '') throw new TargetRefused('API target is empty or padded');
  const c = classifyTarget(raw);
  if (c.kind !== 'loopback') throw new TargetRefused(`API target refused (${c.kind === 'unparseable' ? c.shown : 'not loopback'})`);
  const u = new URL(raw);
  if (u.protocol !== 'http:') throw new TargetRefused('API target must be plain http on loopback');
  if (!/^[0-9]{1,5}$/.test(u.port) || Number(u.port) < 1 || Number(u.port) > 65535) throw new TargetRefused('API target needs an explicit port');
  if (u.pathname !== '/' || u.search || u.hash || u.username || u.password) throw new TargetRefused('API target must be an origin only');
  // The raw text must be exactly the origin (plus at most one slash): no '@', '\\', or anything URL() normalised away.
  const origin = `${u.protocol}//${u.host}`;
  if (raw !== origin && raw !== `${origin}/`) throw new TargetRefused('API target is not in canonical origin form');
  return origin;
}

/** Reads a credential file that must be a regular, non-empty, mode-600 file. Value is never printed. */
export function readSecretFile(f, label) {
  const st = statSync(f);
  if (!st.isFile() || st.size === 0) throw new Error(`${label} file missing or empty`);
  if ((st.mode & 0o077) !== 0) throw new Error(`${label} file is not mode 600`);
  return readFileSync(f, 'utf8').trim();
}

/**
 * One request to <origin><pathAndQuery>. `origin` must come from apiOrigin(). No redirect is followed or accepted.
 * Returns { status, text, json, headers }. Network errors throw with only the error name (no URL, header or body).
 */
export async function request(origin, method, pathAndQuery, { headers = {}, body, timeoutMs = 15000 } = {}) {
  if (apiOrigin(origin) !== origin) throw new TargetRefused('request origin is not canonical');
  if (!pathAndQuery.startsWith('/') || pathAndQuery.startsWith('//')) throw new TargetRefused('request path must be origin-relative');
  const url = new URL(pathAndQuery, origin);
  if (url.origin !== origin) throw new TargetRefused('request path escapes the origin');
  let r;
  try {
    r = await fetch(url, { method, headers, body, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const redirect = /redirect/i.test(String(e?.cause?.message ?? e?.message ?? ''));
    if (redirect) throw new RedirectRefused(`${method} ${url.pathname}: redirect refused`);
    throw Object.assign(new Error(`${method} ${url.pathname}: request failed (${e?.name ?? 'error'})`), { infra: true });
  }
  if (r.status >= 300 && r.status < 400) throw new RedirectRefused(`${method} ${url.pathname}: HTTP ${r.status} redirect refused`);
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { status: r.status, text, json, headers: r.headers };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, raw, anonFile] = process.argv.slice(2);
  try {
    const origin = apiOrigin(raw ?? '');
    if (cmd === 'check') { console.log(origin); process.exit(0); }
    if (cmd === 'ready') {
      const anon = readSecretFile(anonFile, 'anon key');
      let last = 'none';
      for (let i = 0; i < 20; i++) {
        try { const r = await request(origin, 'GET', '/rest/v1/', { headers: { apikey: anon }, timeoutMs: 5000 }); last = String(r.status); if (r.status === 200) { console.log('REST API ready'); process.exit(0); } }
        catch (e) { if (e instanceof RedirectRefused || e instanceof TargetRefused) throw e; last = 'unreachable'; }
        await new Promise((res) => setTimeout(res, 1000));
      }
      console.error(`REST API not ready (last ${last})`); process.exit(1);
    }
    console.error('usage: api-http.mjs check <url> | ready <url> <anon key file>'); process.exit(2);
  } catch (e) { console.error(`api-http: ${e.message}`); process.exit(2); }
}
