// ABOUTME: Payload-independent core for the journey stack's Storage composition (S1 preflight, S2 mirror, S3 verify,
// ABOUTME: S4 probe wrapper). Pure functions over a strict pins grammar; every unexpected shape REFUSES with a fixed code.
//
// No real policy text lives in this repo: the live inventory arrives only as a private runner input (storage-job.mjs s0,
// digest-pinned), and the stock pins only from a qualified hosted read-only step. Tests drive this module with SYNTHETIC fakes.
//
// Pins grammar (UTF-8, LF, one record per line, TAB-separated, no empty fields; free text is base64 of UTF-8):
//   #storage-pins  v1  LIVE|STOCK
//   POLICY      <schema.table>  <name_b64>  ALL|SELECT|INSERT|UPDATE|DELETE  PERMISSIVE|RESTRICTIVE  <roles,sorted>  <using_b64|->  <check_b64|->
//   RLS         <schema.table>  t|f (enabled)  t|f (forced)
//   BUCKET      <bucket id>     t|f (public)   <size digits|NULL>  <mimes_b64 (comma list)|NULL>
//   GRANT       <schema.table>  <grantee>      <privilege>
//   FUNC        <schema>        <name>         <identity_args_b64|->  <def md5>  <owner>  t|f (secdef)  <acl md5>  t|f (authenticated EXECUTE)   [STOCK only]
//   HELPER      <name>          <identity_args_b64>  <def md5>  <prosrc md5>  t|f (secdef)  t|f (authenticated EXECUTE)            [LIVE only]
// Policy identity (as the native verifier computed it): md5(coalesce(qual,'')|coalesce(with_check,'')|cmd|permissive|roles::text).
//   MIGRATIONS  <count>         <max id>
// Fixed output only: callers print codes and counts, never names, expressions or values.

export class StorageError extends Error { constructor(code) { super(code); this.code = code; this.name = 'StorageError'; } }
const refuse = (code) => { throw new StorageError(code); };

export const TABLES = Object.freeze(['storage.objects', 'storage.buckets']);
export const CMDS = Object.freeze(['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE']);
export const COURSE_BUCKETS = Object.freeze(['course-documents', 'course-images', 'course-videos']);
export const HELPERS = Object.freeze(['can_access_course_materials', 'can_manage_course_materials', 'has_role', 'has_admin_access', 'get_user_roles']);
export const PRIVS = Object.freeze(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;
const ROLE = /^[a-z_][a-z0-9_]{0,62}$/;
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const MD5 = /^[0-9a-f]{32}$/;
const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/(?:\*|[a-z0-9][a-z0-9!#$&^_.+-]{0,126})$/;
const TF = /^[tf]$/;

function unb64(s, code, allowLf = false) {
  if (!B64.test(s) || s.length === 0) refuse(code);
  const buf = Buffer.from(s, 'base64');
  if (buf.toString('base64') !== s) refuse(code);
  const t = new TextDecoder('utf-8', { fatal: true });
  let out; try { out = t.decode(buf); } catch { refuse(code); }
  if (out.length === 0 || (allowLf ? /[\0\r\t]/ : /[\0\r\n\t]/).test(out)) refuse(code);
  return out;
}

/**
 * Lexical gate for a policy expression as pg_get_expr prints it. Outside quotes it refuses statement terminators, comments,
 * dollar quoting and backslashes; parentheses must balance and never go negative; quotes must close. It does not judge
 * meaning: the expression is mirrored, not chosen.
 */
export function checkExpr(e) {
  if (typeof e !== 'string' || e.length === 0 || e.length > 8192) refuse('ST_E_EXPR');
  let depth = 0, i = 0;
  while (i < e.length) {
    const c = e[i];
    if (c === "'" || c === '"') {
      const q = c; i++;
      for (;;) {
        if (i >= e.length) refuse('ST_E_EXPR');
        if (e[i] === q) { if (e[i + 1] === q) { i += 2; continue; } i++; break; }
        if (q === "'" && e[i] === '\\') refuse('ST_E_EXPR');
        if (e[i] === '\n') refuse('ST_E_EXPR'); // a line break inside a literal or quoted name is refused (it is never rewritten)
        i++;
      }
      continue;
    }
    if (c === ';' || c === '$' || c === '\\' || c === '`') refuse('ST_E_EXPR');
    if ((c === '-' && e[i + 1] === '-') || (c === '/' && e[i + 1] === '*') || (c === '*' && e[i + 1] === '/')) refuse('ST_E_EXPR');
    if (c === '(') depth++;
    if (c === ')') { depth--; if (depth < 0) refuse('ST_E_EXPR'); }
    i++;
  }
  if (depth !== 0) refuse('ST_E_EXPR');
  return e;
}

/** @param {string} text @returns {{source:'LIVE'|'STOCK', policies:Map, rls:Map, buckets:Map, grants:Set, funcs:Map, migrations:{count:number,max:number}}} */
export function parsePins(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > 4 * 1024 * 1024) refuse('ST_E_PINS');
  if (!text.endsWith('\n') || text.includes('\r') || text.includes('\0')) refuse('ST_E_PINS');
  const lines = text.slice(0, -1).split('\n');
  const h = lines.shift().split('\t');
  if (h.length !== 3 || h[0] !== '#storage-pins' || h[1] !== 'v1' || !['LIVE', 'STOCK'].includes(h[2])) refuse('ST_E_HEADER');
  const p = { source: h[2], policies: new Map(), rls: new Map(), buckets: new Map(), grants: new Set(), funcs: new Map(), helpers: new Map(), migrations: null };
  for (const line of lines) {
    const f = line.split('\t');
    if (f.some((x) => x.length === 0)) refuse('ST_E_LINE');
    switch (f[0]) {
      case 'POLICY': {
        if (f.length !== 8) refuse('ST_E_LINE');
        const [, table, nameB, cmd, perm, roles, usingB, checkB] = f;
        if (!TABLES.includes(table)) refuse('ST_E_TABLE');
        const name = unb64(nameB, 'ST_E_NAME');
        if (name.length > 63 || /["\\]/.test(name)) refuse('ST_E_NAME');
        if (!CMDS.includes(cmd)) refuse('ST_E_CMD');
        if (perm !== 'PERMISSIVE' && perm !== 'RESTRICTIVE') refuse('ST_E_PERM');
        const rl = roles.split(',');
        if (rl.some((r) => !ROLE.test(r)) || rl.join(',') !== [...new Set(rl)].sort().join(',')) refuse('ST_E_ROLE');
        // pg_get_expr prints sublinks over several lines, so LF is allowed in an expression, outside quotes only.
        const using = usingB === '-' ? null : checkExpr(unb64(usingB, 'ST_E_EXPR', true));
        const check = checkB === '-' ? null : checkExpr(unb64(checkB, 'ST_E_EXPR', true));
        // The shapes CREATE POLICY accepts: INSERT takes only WITH CHECK; SELECT and DELETE only USING.
        if (cmd === 'INSERT' && using !== null) refuse('ST_E_SHAPE');
        if ((cmd === 'SELECT' || cmd === 'DELETE') && check !== null) refuse('ST_E_SHAPE');
        if (using === null && check === null) refuse('ST_E_SHAPE');
        const key = `${table}\u0000${name}`;
        if (p.policies.has(key)) refuse('ST_E_DUP');
        p.policies.set(key, { table, name, cmd, perm, roles: rl, using, check });
        break;
      }
      case 'RLS': {
        if (f.length !== 4 || !TABLES.includes(f[1]) || !TF.test(f[2]) || !TF.test(f[3])) refuse('ST_E_LINE');
        if (p.rls.has(f[1])) refuse('ST_E_DUP');
        p.rls.set(f[1], `${f[2]}${f[3]}`);
        break;
      }
      case 'BUCKET': {
        if (f.length !== 5 || !COURSE_BUCKETS.includes(f[1]) || !TF.test(f[2])) refuse('ST_E_BUCKET');
        if (f[3] !== 'NULL' && !/^[1-9]\d{0,18}$/.test(f[3])) refuse('ST_E_BUCKET');
        let mimes = null;
        if (f[4] !== 'NULL') {
          mimes = unb64(f[4], 'ST_E_BUCKET').split(',');
          if (mimes.some((m) => !MIME.test(m)) || new Set(mimes).size !== mimes.length) refuse('ST_E_BUCKET');
        }
        if (p.buckets.has(f[1])) refuse('ST_E_DUP');
        p.buckets.set(f[1], { id: f[1], public: f[2] === 't', size: f[3] === 'NULL' ? null : f[3], mimes });
        break;
      }
      case 'GRANT': {
        if (f.length !== 4 || !TABLES.includes(f[1]) || !(ROLE.test(f[2]) || f[2] === 'PUBLIC') || !PRIVS.includes(f[3])) refuse('ST_E_LINE');
        const k = f.slice(1).join('\t');
        if (p.grants.has(k)) refuse('ST_E_DUP');
        p.grants.add(k);
        break;
      }
      case 'FUNC': {
        if (p.source !== 'STOCK' || f.length !== 9 || !TF.test(f[8]) || !['storage', 'public'].includes(f[1]) || !IDENT.test(f[2]) || !MD5.test(f[4]) || !ROLE.test(f[5]) || !TF.test(f[6]) || !MD5.test(f[7])) refuse('ST_E_LINE');
        if (f[1] === 'public' && !HELPERS.includes(f[2])) refuse('ST_E_FUNC_SCOPE');
        if (f[3] !== '-') unb64(f[3], 'ST_E_LINE');
        const k = `${f[1]}.${f[2]}(${f[3]})`;
        if (p.funcs.has(k)) refuse('ST_E_DUP');
        p.funcs.set(k, f.slice(4).join('\t'));
        break;
      }
      case 'HELPER': {
        if (p.source !== 'LIVE' || f.length !== 7 || !HELPERS.includes(f[1]) || !MD5.test(f[3]) || !MD5.test(f[4]) || !TF.test(f[5]) || !TF.test(f[6])) refuse('ST_E_LINE');
        const args = unb64(f[2], 'ST_E_LINE');
        if (p.helpers.has(f[1])) refuse('ST_E_DUP');
        p.helpers.set(f[1], { args, def: f[3], src: f[4], secdef: f[5] === 't', exec: f[6] === 't' });
        break;
      }
      case 'MIGRATIONS': {
        if (f.length !== 3 || !/^\d{1,6}$/.test(f[1]) || !/^\d{1,6}$/.test(f[2]) || p.migrations) refuse('ST_E_LINE');
        p.migrations = { count: Number(f[1]), max: Number(f[2]) };
        break;
      }
      default: refuse('ST_E_KIND');
    }
  }
  if (!p.migrations || p.rls.size !== TABLES.length) refuse('ST_E_INCOMPLETE');
  for (const b of COURSE_BUCKETS) if (!p.buckets.has(b)) refuse('ST_E_INCOMPLETE');
  if (p.source === 'STOCK') { for (const fn of HELPERS) if (![...p.funcs.keys()].some((k) => k.startsWith(`public.${fn}(`))) refuse('ST_E_INCOMPLETE'); }
  else if (p.helpers.size !== HELPERS.length) refuse('ST_E_INCOMPLETE');
  return p;
}

const qi = (s) => `"${s.replace(/"/g, '""')}"`;
const ql = (s) => `'${s.replace(/'/g, "''")}'`;
export const samePolicy = (a, b) => a.cmd === b.cmd && a.perm === b.perm && a.roles.join(',') === b.roles.join(',') && a.using === b.using && a.check === b.check;

// Line breaks outside quotes are whitespace to the parser; checkExpr refused any inside quotes. Postgres stores the parse
// tree and re-deparses it, so S3 compares the local deparsed text with the LIVE text exactly.
const oneLine = (e) => e.replace(/\n/g, ' ');
function createPolicy(x) {
  const [schema, table] = x.table.split('.');
  return `create policy ${qi(x.name)} on ${schema}.${table} as ${x.perm} for ${x.cmd} to ${x.roles.map((r) => (r === 'public' ? 'public' : qi(r))).join(', ')}`
    + (x.using !== null ? ` using (${oneLine(x.using)})` : '') + (x.check !== null ? ` with check (${oneLine(x.check)})` : '') + ';';
}

/**
 * S2: the one-transaction mirror of the LIVE inventory. The stock local inventory is not pinned yet, so there is NO name
 * reconciliation path: the generated file is valid only on a stack whose storage tables carry zero policies, and both
 * stockPreconditions() (S1) and the script's own leading guard refuse otherwise. Buckets: limits are set to the LIVE values
 * by a guarded single-row update that also requires public = false; nothing ever sets public. The script ends by asserting
 * the policy count. The output depends on LIVE pins only, so it is generated on the runner into the private dir and
 * pinned by sha256 (never committed).
 */
export function generateMirror(live) {
  if (live.source !== 'LIVE') refuse('ST_E_SOURCE');
  for (const b of COURSE_BUCKETS) if (live.buckets.get(b).public) refuse('ST_E_BUCKET_PUBLIC');
  const out = ['begin;', "set local lock_timeout = '5s';",
    "do $m$ begin if (select count(*) from pg_policies where schemaname = 'storage' and tablename in ('objects', 'buckets')) <> 0 then raise exception 'ST_E_STOCK_POLICIES'; end if; end $m$;"];
  for (const [, l] of [...live.policies].sort()) out.push(createPolicy(l));
  for (const b of COURSE_BUCKETS) {
    const v = live.buckets.get(b);
    const mimes = v.mimes === null ? 'null' : `array[${v.mimes.map(ql).join(', ')}]::text[]`;
    out.push(`do $m$ declare n int; begin update storage.buckets set file_size_limit = ${v.size === null ? 'null' : v.size}, allowed_mime_types = ${mimes} where id = ${ql(b)} and public = false; get diagnostics n = row_count; if n <> 1 then raise exception 'ST_E_BUCKET_ROW'; end if; end $m$;`);
  }
  out.push(`do $m$ begin if (select count(*) from pg_policies where schemaname = 'storage' and tablename in ('objects', 'buckets')) <> ${live.policies.size} then raise exception 'ST_E_POLICY_COUNT'; end if; end $m$;`);
  out.push('commit;');
  const sql = `${out.join('\n')}\n`;
  assertMirrorShape(sql);
  return { sql, creates: live.policies.size };
}

/**
 * S1 preconditions on the captured STOCK local state, before the mirror: zero storage policies (the committed mirror
 * assumes it), RLS flags equal LIVE (the mirror never changes RLS), the three course buckets private, and the LIVE
 * helper and grant dependencies present unchanged. Fixed codes only.
 */
export function stockPreconditions(live, stock) {
  if (live.source !== 'LIVE' || stock.source !== 'STOCK') refuse('ST_E_SOURCE');
  if (stock.policies.size !== 0) refuse('ST_E_STOCK_POLICIES');
  for (const t of TABLES) if (stock.rls.get(t) !== live.rls.get(t)) refuse('ST_E_RLS');
  // Fixed public bucket ids only (repository constants): which course bucket(s) are public, in COURSE_BUCKETS order.
  const pub = COURSE_BUCKETS.filter((b) => stock.buckets.get(b).public).map((b) => b.slice('course-'.length).toUpperCase());
  if (pub.length) refuse(`ST_E_BUCKET_PUBLIC_${pub.join('_')}`);
  checkDependencies(live, stock);
  return 'S1 PASS stock_policies=0 rls=live buckets_private=3 helpers=5 grant_deps=present';
}

/** Independent re-check of generated text: every line is one of the fixed statement shapes and nothing else. */
export function assertMirrorShape(sql) {
  const lines = sql.slice(0, -1).split('\n');
  if (lines[0] !== 'begin;' || lines[1] !== "set local lock_timeout = '5s';" || lines[lines.length - 1] !== 'commit;') refuse('ST_E_MIRROR_SHAPE');
  if (lines[2] !== "do $m$ begin if (select count(*) from pg_policies where schemaname = 'storage' and tablename in ('objects', 'buckets')) <> 0 then raise exception 'ST_E_STOCK_POLICIES'; end if; end $m$;") refuse('ST_E_MIRROR_SHAPE');
  const body = lines.slice(3, -1);
  const ok = [
    /^create policy "(?:[^"]|"")+" on storage\.(?:objects|buckets) as (?:PERMISSIVE|RESTRICTIVE) for (?:ALL|SELECT|INSERT|UPDATE|DELETE) to [^;]+;$/,
    /^do \$m\$ declare n int; begin update storage\.buckets set file_size_limit = (?:null|\d+), allowed_mime_types = (?:null|array\[[^;]*\]::text\[\]) where id = 'course-(?:documents|images|videos)' and public = false; get diagnostics n = row_count; if n <> 1 then raise exception 'ST_E_BUCKET_ROW'; end if; end \$m\$;$/,
    /^do \$m\$ begin if \(select count\(\*\) from pg_policies where schemaname = 'storage' and tablename in \('objects', 'buckets'\)\) <> \d+ then raise exception 'ST_E_POLICY_COUNT'; end if; end \$m\$;$/,
  ];
  for (const l of body) if (!ok.some((r) => r.test(l))) refuse('ST_E_MIRROR_SHAPE');
  // Exactly one statement per line: no terminator inside a create/drop except the last, outside quotes.
  for (const l of body.filter((x) => x.startsWith('create policy'))) {
    let q = null, n = 0;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === q) { if (l[i + 1] === q) { i++; continue; } q = null; } continue; }
      if (c === "'" || c === '"') q = c; else if (c === ';') n++;
    }
    if (n !== 1 || q) refuse('ST_E_MIRROR_SHAPE');
  }
  return true;
}

/** Exact policy identity, same composition as the native verifier's identity_md5. */
export function policyIdentity(x, md5) {
  return md5(`${x.using ?? ''}|${x.check ?? ''}|${x.cmd}|${x.perm}|{${x.roles.join(',')}}`);
}

/**
 * S1 dependency checks of the LIVE semantics against the STOCK local stack. Fixed codes only.
 * - every LIVE helper exists locally with the same identity args, definition md5, SECURITY DEFINER flag and authenticated
 *   EXECUTE (no helper repair here: a mismatch refuses);
 * - every LIVE table grant to anon, authenticated or service_role exists locally (no global grant is added: missing refuses).
 */
export function checkDependencies(live, stock) {
  if (live.source !== 'LIVE' || stock.source !== 'STOCK') refuse('ST_E_SOURCE');
  for (const [name, h] of live.helpers) {
    const hits = [...stock.funcs].filter(([k]) => k.startsWith(`public.${name}(`));
    if (hits.length !== 1) refuse('ST_E_HELPER');
    const [k, v] = hits[0];
    const argsB64 = k.slice(`public.${name}(`.length, -1);
    const args = argsB64 === '-' ? '' : Buffer.from(argsB64, 'base64').toString('utf8');
    const [def, , secdef, , exec] = v.split('\t');
    if (args !== h.args || def !== h.def || (secdef === 't') !== h.secdef || (exec === 't') !== h.exec) refuse('ST_E_HELPER');
  }
  for (const g of live.grants) {
    const [, grantee] = g.split('\t');
    if (['anon', 'authenticated', 'service_role'].includes(grantee) && !stock.grants.has(g)) refuse('ST_E_GRANT_DEP');
  }
  return 'DEPENDENCIES PASS helpers=5 grants_checked=anon,authenticated,service_role';
}

/** S3 expectation: STOCK everywhere, except the policy set (LIVE's) and the course bucket limits (LIVE's). */
export function expectedAfterMirror(live, stock) {
  if (live.source !== 'LIVE' || stock.source !== 'STOCK') refuse('ST_E_SOURCE');
  const buckets = new Map();
  for (const b of COURSE_BUCKETS) buckets.set(b, { ...live.buckets.get(b), public: stock.buckets.get(b).public });
  return { source: 'EXPECTED', policies: live.policies, rls: stock.rls, buckets, grants: stock.grants, funcs: stock.funcs, migrations: stock.migrations };
}

/**
 * Compare an observed capture with an expectation. Returns fixed category counts only and PASS iff all are zero.
 * Every category is always present so a summary line cannot silently drop one.
 */
export function compareInventory(expected, observed) {
  const c = { policy_missing: 0, policy_extra: 0, policy_changed: 0, rls_changed: 0, bucket_public: 0, bucket_limit: 0,
    grant_missing: 0, grant_extra: 0, func_missing: 0, func_extra: 0, func_changed: 0, migrations: 0 };
  for (const [k, v] of expected.policies) { const o = observed.policies.get(k); if (!o) c.policy_missing++; else if (!samePolicy(v, o)) c.policy_changed++; }
  for (const k of observed.policies.keys()) if (!expected.policies.has(k)) c.policy_extra++;
  for (const t of TABLES) if (expected.rls.get(t) !== observed.rls.get(t)) c.rls_changed++;
  for (const b of COURSE_BUCKETS) {
    const e = expected.buckets.get(b), o = observed.buckets.get(b);
    if (e.public !== o.public) c.bucket_public++;
    if (e.size !== o.size || JSON.stringify(e.mimes) !== JSON.stringify(o.mimes)) c.bucket_limit++;
  }
  for (const g of expected.grants) if (!observed.grants.has(g)) c.grant_missing++;
  for (const g of observed.grants) if (!expected.grants.has(g)) c.grant_extra++;
  for (const [k, v] of expected.funcs) { const o = observed.funcs.get(k); if (o === undefined) c.func_missing++; else if (o !== v) c.func_changed++; }
  for (const k of observed.funcs.keys()) if (!expected.funcs.has(k)) c.func_extra++;
  if (expected.migrations.count !== observed.migrations.count || expected.migrations.max !== observed.migrations.max) c.migrations++;
  const pass = Object.values(c).every((n) => n === 0);
  return { pass, counts: c, line: `${pass ? 'PASS' : 'FAIL'} ${Object.entries(c).map(([k, n]) => `${k}=${n}`).join(' ')}` };
}

/** Run-owned probe object prefix: probe-<run id>-<attempt>-, digits only (no free text reaches SQL). */
export function probePrefix(runId, attempt) {
  if (!/^[1-9]\d{0,19}$/.test(String(runId)) || !/^[1-9]\d{0,3}$/.test(String(attempt))) refuse('ST_E_PROBE_ID');
  return `probe-${runId}-${attempt}-`;
}

/**
 * S4 wrapper: one probe body in one transaction that always ends in ROLLBACK. ON_ERROR_STOP makes psql exit on the first
 * error; the server then discards the open transaction when the session closes, so an unexpected exit also rolls back.
 * The body is refused if it tries to end the transaction itself.
 */
export function wrapProbe(body) {
  if (typeof body !== 'string' || body.length === 0) refuse('ST_E_PROBE');
  // Only the fixed $p$ tag may dollar-quote (a DO body); its contents are opaque here and run inside the same transaction.
  if ((body.match(/\$p\$/g) || []).length % 2 !== 0 || /\$(?!p\$)[A-Za-z_]*\$/.test(body.replace(/\$p\$/g, ''))) refuse('ST_E_PROBE');
  const bare = body.replace(/\$p\$[\s\S]*?\$p\$/g, '$p$$p$').replace(/'(?:[^']|'')*'/g, "''");
  if (/(?:^|;)\s*(?:commit|end|rollback|abort|savepoint|release|begin|start\s+transaction|prepare\s+transaction)\b/im.test(bare)) refuse('ST_E_PROBE');
  if (/^\s*\\/m.test(body)) refuse('ST_E_PROBE');
  return `\\set ON_ERROR_STOP 1\nbegin;\n${body}\nrollback;\n`;
}

/** Residue check after each probe, in a fresh session: the count of objects whose name carries the run-owned prefix. */
export function residueSql(prefix) {
  if (!/^probe-[1-9]\d{0,19}-[1-9]\d{0,3}-$/.test(prefix)) refuse('ST_E_PROBE_ID');
  return `select count(*) from storage.objects where position(${ql(prefix)} in name) > 0;\n`;
}
export function residueVerdict(lines) {
  if (!Array.isArray(lines) || lines.length !== 1 || !/^\d{1,12}$/.test(lines[0])) refuse('ST_E_RESIDUE_READ');
  return lines[0] === '0' ? 'RESIDUE 0 PASS' : refuse('ST_E_RESIDUE');
}
