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
// Exact, case-sensitive: libpq hands the host to the resolver as written, so 'LOCALHOST', 'localhost.'
// or '127.1' are not the same string and are refused rather than reasoned about.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1']);
const UNSAFE_ENV = ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGPORT'];

function refuse(reason, extra = {}) { return { ok: false, reason, ...extra }; }

// Deliberately narrow keyword grammar. libpq's real grammar lets a backslash escape the next
// character even in an UNQUOTED value ("password=x\ host=localhost" is ONE value, so the real host
// stays remote.example) and lets single quotes span whitespace. Implementing that exactly is another
// approximate parser waiting to diverge, so instead only plain tokens are supported:
//   key=value [key=value ...]   with key in an allow-list and value matching /^[A-Za-z0-9._:\/@-]+$/
// Anything else (quotes, backslashes, '=' or ',' inside a value, repeated keys, spaces around '=')
// is refused before any psql call. Passwords with special characters belong in the URI form,
// percent-encoded, which the URI branch already handles.
const KEYWORD_KEYS = new Set(['host', 'hostaddr', 'port', 'dbname', 'user', 'password', 'sslmode', 'application_name', 'connect_timeout', 'client_encoding', 'service', 'options', 'passfile']);
function parseKeywordDsn(s) {
  if (/['"\\]/.test(s)) return { error: "quotes or backslashes in a keyword DSN are refused: libpq treats them as escapes that can hide a second host" };
  const out = {};
  for (const tok of s.trim().split(/\s+/)) {
    const m = tok.match(/^([a-z_]+)=([A-Za-z0-9._:\/@-]+)$/);
    if (!m) return { error: `keyword token ${JSON.stringify(tok.length > 40 ? tok.slice(0, 40) + '…' : tok)} is not a plain key=value with a safe value (letters, digits, . _ : / @ -)` };
    const [, k, v] = m;
    if (!KEYWORD_KEYS.has(k)) return { error: `unsupported connection parameter ${k}= is refused` };
    if (k in out) return { error: `duplicate keyword ${k}= is refused` };
    out[k] = v;
  }
  return out;
}

export function parseLibpqDsn(dsn) {
  if (typeof dsn !== 'string' || dsn.trim() === '') return refuse('empty DSN');
  const raw = dsn.trim();
  let hosts = [], hostaddr, port, database, user, hasPassword = false, params = {};
  if (/^postgres(ql)?:\/\//i.test(raw)) {
    // libpq's URI grammar is NOT the web URL grammar. Verified against PQconninfoParse (libpq 16):
    //   * '#' is an ordinary character, so "db#?host=remote" means dbname "db#" with host=remote —
    //     a web parser that treats '#' as a fragment silently drops the redirect. Refuse '#' outright.
    //   * userinfo is split at the FIRST '@'; "a@b@localhost" means user a, host "b@localhost". Refuse >1 '@'.
    //   * percent-decoding applies to every component ("d%62" → "db", "%3F" → "?"), so an encoded
    //     delimiter changes the parse. Allow '%' only inside the password, where it is legitimately needed.
    //   * several hosts may be listed, and query parameters host/hostaddr/port override the authority.
    if (raw.includes('#')) return refuse("'#' is refused: libpq treats it as data, so 'db#?host=…' redirects while looking like a fragment");
    if (/[\s'"\\]/.test(raw)) return refuse('whitespace, quotes or backslashes in a URI DSN are refused');
    const m = raw.match(/^postgres(?:ql)?:\/\/(?:([^@/?]*)@)?([^/?]*)(?:\/([^?]*))?(?:\?(.*))?$/i);
    if (!m) return refuse('URI does not parse');
    const [, userinfo = '', authority = '', dbpart = '', query = ''] = m;
    if ((raw.match(/@/g) || []).length > 1) return refuse("more than one '@' is refused: libpq splits userinfo at the first one");
    if (/%/.test(authority)) return refuse('percent-encoding in host/port is refused');
    if (/%/.test(dbpart)) return refuse('percent-encoding in the database name is refused');
    if (/%/.test(query)) return refuse('percent-encoding in query parameters is refused');
    if (userinfo) {
      const idx = userinfo.indexOf(':'); user = idx >= 0 ? userinfo.slice(0, idx) : userinfo; hasPassword = idx >= 0;
      if (/%/.test(user)) return refuse('percent-encoding in the user name is refused');
    }
    if (authority !== '') {
      for (const hp of authority.split(',')) {
        let h = hp, p;
        const v6 = hp.match(/^\[([^\]]+)\](?::(\d+))?$/);
        if (v6) { h = v6[1]; p = v6[2]; }
        else { const idx = hp.lastIndexOf(':'); if (idx >= 0) { h = hp.slice(0, idx); p = hp.slice(idx + 1); } }
        if (h === '' && hp !== '') return refuse('empty host in authority list');
        hosts.push(h); if (p !== undefined) { if (port !== undefined && port !== p) return refuse('conflicting ports in multihost list'); port = p; }
      }
    }
    database = dbpart || undefined;
    if (query) {
      for (const kv of query.split('&')) {
        if (!kv) return refuse('empty query parameter is refused');
        const eq = kv.indexOf('='); if (eq <= 0) return refuse('malformed query parameter is refused');
        const k = kv.slice(0, eq).toLowerCase(), v = kv.slice(eq + 1);
        if (k in params) return refuse(`duplicate query parameter ${k}= is refused`);
        params[k] = v;
      }
    }
  } else {
    const kv = parseKeywordDsn(raw);
    if (kv.error) return refuse(kv.error);
    params = { ...kv };
    if (kv.host !== undefined) { hosts = kv.host.split(','); delete params.host; }
    if (kv.port !== undefined) { port = kv.port; delete params.port; }
    if (kv.dbname !== undefined) { database = kv.dbname; delete params.dbname; }
    if (kv.user !== undefined) { user = kv.user; delete params.user; }
    if (kv.password !== undefined) { hasPassword = true; delete params.password; }
  }
  // Query/keyword parameters that can redirect the connection
  if (params.host !== undefined) { if (hosts.length) return refuse('host given both in authority and as a parameter'); hosts = String(params.host).split(','); }
  if (params.hostaddr !== undefined) hostaddr = String(params.hostaddr);
  if (params.port !== undefined) { if (port !== undefined && port !== params.port) return refuse('conflicting port values'); port = params.port; }
  if (params.service !== undefined) return refuse('service= is refused (service files can name any host)');
  if (params.dbname !== undefined && database === undefined) database = params.dbname;
  if (params.passfile !== undefined) return refuse('passfile= is refused');
  for (const k of Object.keys(params)) if (!['host', 'hostaddr', 'port', 'dbname', 'user', 'password', 'sslmode', 'application_name', 'options', 'connect_timeout', 'client_encoding'].includes(k)) return refuse(`unsupported connection parameter ${k}= is refused`);
  if (params.options !== undefined) return refuse('options= is refused');

  if (hosts.length === 0) return refuse('no host given: libpq would fall back to PGHOST or the default socket; name the host explicitly');
  if (hosts.length > 1) return refuse(`multihost list (${hosts.length} hosts) is refused: libpq tries each in turn`);
  if (hostaddr !== undefined) return refuse(`hostaddr=${hostaddr} is refused: it bypasses the host name and connects elsewhere`);
  if (port !== undefined && !/^\d{1,5}$/.test(String(port))) return refuse('port is not numeric');
  const host = hosts[0];
  const redacted = `${host}${port ? ':' + port : ''}/${database ?? '(default db)'} user=${user ?? '(default)'}${hasPassword ? ' password=<redacted>' : ''}`;
  return { ok: true, host, port, database, user, hasPassword, redacted };
}

const SUPABASE_DB_HOST = /^db\.([a-z0-9]{15,})\.supabase\.(?:co|in|red)$/;
const SUPABASE_POOLER_HOST = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/;

/**
 * Evaluate a libpq DSN against the allow-list: loopback always; additionally the Supabase database
 * host (db.<ref>.supabase.co) or Supavisor pooler with user postgres.<ref> when `isolatedRef` is
 * given. `productionRef`, when given, is refused anywhere it appears.
 */
export function evaluateLibpqDsn(dsn, { env = process.env, isolatedRef, productionRef } = {}) {
  for (const k of UNSAFE_ENV) if (env[k] !== undefined && env[k] !== '') return refuse(`environment override ${k} is set; unset it (callers run psql with it removed)`);
  if (productionRef && typeof dsn === 'string' && dsn.toLowerCase().includes(String(productionRef).toLowerCase())) return refuse('contains the production project ref');
  const p = parseLibpqDsn(dsn);
  if (!p.ok) return p;
  const isSocketDir = p.host.startsWith('/') && (p.host.startsWith('/tmp/') || p.host === '/tmp');
  if (LOOPBACK.has(p.host) || isSocketDir) return { ...p, target: 'loopback' };
  if (isolatedRef) {
    if (productionRef && isolatedRef === productionRef) return refuse('E2E_ISOLATED_TARGET_REF equals the production ref');
    const m = p.host.match(SUPABASE_DB_HOST);
    if (m) return m[1] === isolatedRef ? { ...p, target: `isolated:${isolatedRef}` } : refuse(`host ref ${m[1]} does not equal the isolated ref`);
    if (SUPABASE_POOLER_HOST.test(p.host)) {
      const um = (p.user ?? '').match(/^postgres\.([a-z0-9]{15,})$/);
      if (um && um[1] === isolatedRef) return { ...p, target: `isolated:${isolatedRef}` };
      return refuse(`pooler user ${p.user ?? '(none)'} does not name the isolated ref`);
    }
  }
  return refuse(`host "${p.host}" is not loopback (localhost, 127.0.0.1, ::1)${isolatedRef ? ' or the declared isolated project' : ''}`);
}

/** Local tooling entrypoint: loopback only, no isolated-project allowance. */
export function assertLocalDsn(dsn, env = process.env) {
  return evaluateLibpqDsn(dsn, { env });
}

const isMain = process.argv[1] && path_resolve(process.argv[1]) === new URL(import.meta.url).pathname;
function path_resolve(p) { return p.startsWith('/') ? p : process.cwd() + '/' + p; }
if (isMain && process.argv[2] === '--json') {
  // Differential-test mode: print the GUARD DECISION (policy applied, environment ignored) for a DSN,
  // so the oracle compares what the guard would allow against what libpq would connect to.
  const r = evaluateLibpqDsn(process.argv[3] ?? '', { env: {} });
  console.log(JSON.stringify(r)); process.exit(0);
}
if (isMain) {
  const r = assertLocalDsn(process.argv[2]);
  if (!r.ok) { console.error(`[assert-local-dsn] REFUSED: ${r.reason}`); process.exit(2); }
  console.log(`[assert-local-dsn] OK: ${r.redacted}`);
}
