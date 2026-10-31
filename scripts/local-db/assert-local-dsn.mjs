#!/usr/bin/env node
// ABOUTME: Strict libpq DSN parser for the local-database tooling: accepts ONLY a single loopback
// ABOUTME: endpoint and refuses everything a DSN can do to point elsewhere (multihost, hostaddr,
// ABOUTME: query/keyword host overrides, service files, environment overrides, encoded or
// ABOUTME: look-alike hosts). Prints a redacted form; never echoes credentials.
//
// Usage: node assert-local-dsn.mjs "<dsn>"   → exit 0 and print redacted DSN, or exit 2 with reason.
// Importable: assertLocalDsn(dsn, env) returns { ok, reason, redacted, hosts, port, database }.
//
// libpq facts this guards against (https://www.postgresql.org/docs/current/libpq-connect.html):
// * URI form: postgresql://[user[:pw]@][host1[:port1]][,host2[:port2]…][/db][?param=value…]
//   - `host`, `hostaddr`, `port` may ALSO be given as query parameters and override the authority.
//   - A URI with no host uses PGHOST/PGHOSTADDR from the environment, or the default socket.
//   - Several hosts may be listed; libpq tries them in order — a "localhost,prod" list reaches prod.
//   - `hostaddr` bypasses DNS: host=localhost hostaddr=203.0.113.9 connects to 203.0.113.9.
//   - Percent-encoding is decoded in host/user/password/db.
// * Keyword form: "host=… hostaddr=… port=… dbname=… user=… password=… service=…"
//   - `service=` reads ~/.pg_service.conf / PGSERVICEFILE, which can name any host.
// * Environment: PGHOST, PGHOSTADDR, PGPORT, PGSERVICE, PGSERVICEFILE, PGPASSFILE, PGREQUIRESSL…
//   The callers also run psql under `env -u` for these, but we refuse here first so the message is clear.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const UNSAFE_ENV = ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGPORT'];

function refuse(reason, extra = {}) { return { ok: false, reason, ...extra }; }

function parseKeywordDsn(s) {
  // key=value pairs; values may be single-quoted with backslash escapes
  const out = {}; let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    let k = ''; while (i < s.length && s[i] !== '=' && !/\s/.test(s[i])) k += s[i++];
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== '=') return null;
    i++; while (i < s.length && /\s/.test(s[i])) i++;
    let v = '';
    if (s[i] === "'") { i++; while (i < s.length && s[i] !== "'") { if (s[i] === '\\') i++; v += s[i++]; } i++; }
    else { while (i < s.length && !/\s/.test(s[i])) v += s[i++]; }
    out[k.toLowerCase()] = v;
  }
  return out;
}

export function assertLocalDsn(dsn, env = process.env) {
  if (typeof dsn !== 'string' || dsn.trim() === '') return refuse('empty DSN');
  for (const k of UNSAFE_ENV) if (env[k] !== undefined && env[k] !== '') return refuse(`environment override ${k} is set; unset it (callers run psql with it removed)`);
  const raw = dsn.trim();
  let hosts = [], hostaddr, port, database, user, hasPassword = false, params = {};
  if (/^postgres(ql)?:\/\//i.test(raw)) {
    // Do our own authority split: URL() cannot represent multihost and would throw or mis-parse.
    const m = raw.match(/^postgres(?:ql)?:\/\/(?:([^@/?#]*)@)?([^/?#]*)(?:\/([^?#]*))?(?:\?([^#]*))?(?:#.*)?$/i);
    if (!m) return refuse('URI does not parse');
    const [, userinfo = '', authority = '', dbpart = '', query = ''] = m;
    if (/%/.test(authority)) return refuse('percent-encoding in host/port is refused');
    if (userinfo) { const idx = userinfo.indexOf(':'); user = idx >= 0 ? userinfo.slice(0, idx) : userinfo; hasPassword = idx >= 0; }
    if (authority !== '') {
      for (const hp of authority.split(',')) {
        let h = hp, p;
        const v6 = hp.match(/^\[([^\]]+)\](?::(\d+))?$/);
        if (v6) { h = v6[1]; p = v6[2]; }
        else { const idx = hp.lastIndexOf(':'); if (idx >= 0) { h = hp.slice(0, idx); p = hp.slice(idx + 1); } }
        if (h === '' && hp !== '') return refuse('empty host in authority list');
        hosts.push(h.toLowerCase()); if (p !== undefined) { if (port !== undefined && port !== p) return refuse('conflicting ports in multihost list'); port = p; }
      }
    }
    database = dbpart ? decodeURIComponent(dbpart) : undefined;
    if (query) {
      for (const kv of query.split('&')) { if (!kv) continue; const [k, v = ''] = kv.split('='); params[decodeURIComponent(k).toLowerCase()] = decodeURIComponent(v); }
    }
  } else {
    const kv = parseKeywordDsn(raw);
    if (!kv) return refuse('keyword DSN does not parse');
    params = { ...kv };
    if (kv.host !== undefined) { hosts = kv.host.split(',').map((h) => h.toLowerCase()); delete params.host; }
    if (kv.port !== undefined) { port = kv.port; delete params.port; }
    if (kv.dbname !== undefined) { database = kv.dbname; delete params.dbname; }
    if (kv.user !== undefined) { user = kv.user; delete params.user; }
    if (kv.password !== undefined) { hasPassword = true; delete params.password; }
  }
  // Query/keyword parameters that can redirect the connection
  if (params.host !== undefined) { if (hosts.length) return refuse('host given both in authority and as a parameter'); hosts = String(params.host).split(',').map((h) => h.toLowerCase()); }
  if (params.hostaddr !== undefined) hostaddr = String(params.hostaddr);
  if (params.port !== undefined) { if (port !== undefined && port !== params.port) return refuse('conflicting port values'); port = params.port; }
  if (params.service !== undefined) return refuse('service= is refused (service files can name any host)');
  if (params.dbname !== undefined && database === undefined) database = params.dbname;
  if (params.passfile !== undefined) return refuse('passfile= is refused');
  for (const k of Object.keys(params)) if (!['host', 'hostaddr', 'port', 'dbname', 'user', 'password', 'sslmode', 'application_name', 'options', 'connect_timeout', 'client_encoding'].includes(k)) return refuse(`unsupported connection parameter ${k}= is refused`);
  if (params.options !== undefined) return refuse('options= is refused');

  if (hosts.length === 0) return refuse('no host given: libpq would fall back to PGHOST or the default socket; name the loopback host explicitly');
  if (hosts.length > 1) return refuse(`multihost list (${hosts.length} hosts) is refused: libpq tries each in turn`);
  const host = hosts[0];
  const isSocketDir = host.startsWith('/') && (host.startsWith('/tmp/') || host === '/tmp');
  if (!LOOPBACK.has(host) && !isSocketDir) return refuse(`host "${host}" is not loopback (localhost, 127.0.0.1, ::1) or a /tmp socket directory`);
  if (hostaddr !== undefined && !['127.0.0.1', '::1'].includes(hostaddr)) return refuse(`hostaddr=${hostaddr} would bypass the host name and connect elsewhere`);
  if (port !== undefined && !/^\d{1,5}$/.test(String(port))) return refuse('port is not numeric');
  const redacted = `${host}${port ? ':' + port : ''}/${database ?? '(default db)'} user=${user ?? '(default)'}${hasPassword ? ' password=<redacted>' : ''}`;
  return { ok: true, redacted, hosts, port, database, user };
}

const isMain = process.argv[1] && path_resolve(process.argv[1]) === new URL(import.meta.url).pathname;
function path_resolve(p) { return p.startsWith('/') ? p : process.cwd() + '/' + p; }
if (isMain) {
  const r = assertLocalDsn(process.argv[2]);
  if (!r.ok) { console.error(`[assert-local-dsn] REFUSED: ${r.reason}`); process.exit(2); }
  console.log(`[assert-local-dsn] OK: ${r.redacted}`);
}
