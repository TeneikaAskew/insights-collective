#!/usr/bin/env node
// ABOUTME: MOCKED GoTrue + PostgREST-shaped HTTP layer on loopback for LOCAL-SHIM runs of personas.sh and api-controls.mjs.
// ABOUTME: Real SQL semantics (RLS, triggers, roles, request.jwt.claims) on the local database; the HTTP layer is a mock.
//
// NOT PostgREST and NOT GoTrue. It implements only the request shapes the harness sends, so a pass here proves the
// controls' logic and the database behaviour, never Kong/PostgREST/GoTrue behaviour (authentic stack: NOT RUN).
//   POST /auth/v1/admin/users              (Bearer service key)  -> inserts auth.users as postgres, returns {id,email}
//   POST /auth/v1/token?grant_type=password (apikey anon)        -> HS256 JWT {sub, role: authenticated, aud, exp}
//   GET  /rest/v1/<t>?select=*&col=eq.v|is.null
//   POST /rest/v1/<t>[?on_conflict=a,b]  Prefer: resolution=merge-duplicates
//   PATCH /rest/v1/<t>?col=eq.v
//   POST /rest/v1/rpc/<fn>
// Each request runs in ONE transaction as `set local role <jwt role>` with request.jwt.claims set, like PostgREST.
// Usage: mock-stack.mjs <port> <loopback db url>   (env MOCK_JWT_SECRET, MOCK_ANON_KEY, MOCK_SERVICE_KEY)
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const [port, dbUrl] = process.argv.slice(2);
const SECRET = process.env.MOCK_JWT_SECRET, ANON = process.env.MOCK_ANON_KEY, SERVICE = process.env.MOCK_SERVICE_KEY;
if (!port || !dbUrl || !SECRET || !ANON || !SERVICE) { console.error('usage: mock-stack.mjs <port> <db url> with MOCK_* env'); process.exit(2); }
const u = new URL(dbUrl);
if (!['127.0.0.1', 'localhost'].includes(u.hostname)) { console.error('mock-stack: loopback database only'); process.exit(2); }

const b64 = (b) => Buffer.from(b).toString('base64url');
export function signJwt(payload, secret) {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64(JSON.stringify(payload));
  return `${h}.${p}.${createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
}
function verifyJwt(tok) {
  const [h, p, s] = String(tok || '').split('.');
  if (!h || !p || !s) return null;
  const want = Buffer.from(createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url'));
  const got = Buffer.from(s);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
}
const lit = (v) => (v === null || v === undefined ? 'null' : `'${String(typeof v === 'object' ? JSON.stringify(v) : v).replace(/'/g, "''")}'`);
const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error(`bad identifier ${s}`), { code: 'PGRST100' }); return s; };

function psql(sql) {
  const r = spawnSync('psql', ['-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username || 'postgres'),
    '-d', u.pathname.slice(1) || 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
  { input: sql, encoding: 'utf8', env: { PATH: process.env.PATH, PGPASSWORD: decodeURIComponent(u.password || '') } });
  if (r.status !== 0) {
    const m = (r.stderr || '').match(/ERROR:\s+([0-9A-Z]{5}):\s+(.*)/);
    return { error: { code: m ? m[1] : 'XX000', message: m ? m[2] : (r.stderr || '').trim().split('\n')[0] } };
  }
  const lines = r.stdout.trim().split('\n');
  return { out: lines[lines.length - 1] };
}
function filters(q) {
  const w = [];
  for (const [k, v] of q) {
    if (['select', 'on_conflict', 'order', 'limit'].includes(k)) continue;
    if (v === 'is.null') w.push(`x.${ident(k)} is null`);
    else if (v.startsWith('eq.')) w.push(`x.${ident(k)}::text = ${lit(v.slice(3))}`);
    else throw Object.assign(new Error(`unsupported filter ${k}=${v}`), { code: 'PGRST100' });
  }
  return w.length ? `where ${w.join(' and ')}` : '';
}
function asRole(claims, body) {
  return `begin;\nset local role ${ident(claims.role)};\nselect set_config('request.jwt.claims', ${lit(JSON.stringify(claims))}, true);\n` +
    `${body}\ncommit;\n`;
}
const pwd = new Map();
const INJECT = process.env.MOCK_INJECT ? JSON.parse(process.env.MOCK_INJECT) : [];
if (INJECT.length) console.log(`mock-stack: FAULT INJECTION active (${INJECT.length} rule(s)); not an evidence run`);
const send = (res, status, obj, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(obj)); };
const statusFor = (code) => (code === '42501' ? 403 : code === '23505' ? 409 : code === 'PGRST100' ? 400 : 400);

http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    try {
      const url = new URL(req.url, 'http://x'); const body = raw ? JSON.parse(raw) : undefined;
      // Fault injection for the CAUSAL selftests only (MOCK_INJECT unset in every evidence run): a request whose method, path
      // and raw body contain the given substrings is answered with the canned status/body/headers and never reaches the database.
      for (const x of INJECT) {
        if (req.method === x.method && (url.pathname + url.search).includes(x.path) && raw.includes(x.body ?? '')) {
          res.writeHead(x.status, { 'content-type': 'application/json', ...(x.headers || {}) }); return res.end(JSON.stringify(x.reply ?? {}));
        }
      }
      const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (url.pathname === '/auth/v1/admin/users' && req.method === 'POST') {
        if (bearer !== SERVICE) return send(res, 401, { msg: 'service key required' });
        const id = randomUUID();
        const r = psql(`insert into auth.users (id, email) values (${lit(id)}, ${lit(body.email)});`);
        if (r.error) return send(res, 422, { msg: r.error.message });
        pwd.set(body.email, { id, password: body.password });
        return send(res, 200, { id, email: body.email });
      }
      if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password' && req.method === 'POST') {
        if (req.headers.apikey !== ANON) return send(res, 401, { msg: 'apikey required' });
        const rec = pwd.get(body.email);
        if (!rec || rec.password !== body.password) return send(res, 400, { error: 'invalid_grant' });
        const now = Math.floor(Date.now() / 1000);
        return send(res, 200, { access_token: signJwt({ sub: rec.id, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }, SECRET), token_type: 'bearer' });
      }
      if (url.pathname === '/rest/v1/' && req.method === 'GET') return send(res, 200, { mock: true });
      const m = url.pathname.match(/^\/rest\/v1\/(rpc\/)?([a-z_][a-z0-9_]*)$/);
      if (!m) return send(res, 404, { msg: 'not found' });
      const claims = verifyJwt(bearer);
      if (!claims || req.headers.apikey === undefined) return send(res, 401, { msg: 'JWT invalid' });
      const t = ident(m[2]); const q = url.searchParams; let sql;
      if (m[1]) {
        const args = Object.entries(body || {}).map(([k, v]) => `${ident(k)} => ${lit(v)}`).join(', ');
        sql = `with x as (select public.${t}(${args}) as r) select json_build_object('n', 1, 'rows', (select json_agg(r) from x));`;
      } else if (req.method === 'GET') {
        sql = `with x as (select * from public.${t} x ${filters(q)}) select json_build_object('n', count(*), 'rows', coalesce(json_agg(x), '[]')) from x;`;
      } else if (req.method === 'POST') {
        const rows = Array.isArray(body) ? body : [body]; const cols = Object.keys(rows[0]).map(ident);
        const merge = /resolution=merge-duplicates/.test(req.headers.prefer || '');
        const oc = q.get('on_conflict');
        const conflict = merge ? ` on conflict (${(oc || 'id').split(',').map(ident).join(', ')}) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}` : '';
        sql = `with x as (insert into public.${t} (${cols.join(', ')}) select ${cols.join(', ')} from json_populate_recordset(null::public.${t}, ${lit(JSON.stringify(rows))}::json)${conflict} returning *) ` +
          `select json_build_object('n', count(*), 'rows', coalesce(json_agg(x), '[]')) from x;`;
      } else if (req.method === 'PATCH') {
        const cols = Object.keys(body).map(ident);
        sql = `with x as (update public.${t} x set (${cols.join(', ')}) = (select ${cols.join(', ')} from json_populate_record(null::public.${t}, ${lit(JSON.stringify(body))}::json)) ${filters(q)} returning x.*) ` +
          `select json_build_object('n', count(*), 'rows', coalesce(json_agg(x), '[]')) from x;`;
      } else return send(res, 405, { msg: 'method' });
      const r = psql(asRole(claims, sql));
      if (r.error) return send(res, statusFor(r.error.code), r.error);
      const o = JSON.parse(r.out);
      const range = o.n ? `0-${o.n - 1}/*` : '*/0';
      if (req.method === 'PATCH' && !/return=representation/.test(req.headers.prefer || '')) { res.writeHead(204, { 'content-range': range }); return res.end(); }
      return send(res, req.method === 'POST' && !m[1] ? 201 : 200, m[1] ? (o.rows ? o.rows[0] : null) : o.rows, { 'content-range': range });
    } catch (e) { return send(res, statusFor(e.code), { code: e.code || 'XX000', message: String(e.message) }); }
  });
}).listen(Number(port), '127.0.0.1', () => console.log(`mock-stack (MOCKED GoTrue + PostgREST-shaped) on 127.0.0.1:${port}`));
