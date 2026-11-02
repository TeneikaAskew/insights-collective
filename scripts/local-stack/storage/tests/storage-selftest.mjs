#!/usr/bin/env node
// ABOUTME: Selftest for storage-core.mjs on SYNTHETIC fakes only. No real policy text, names or bucket limits appear here:
// ABOUTME: every expression is a constant like (1 = 1), every policy is named "synthetic ...", every limit is made up.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../storage-core.mjs';

let ok = 0, bad = 0;
const t = (name, fn) => { try { fn(); ok++; console.log(`ok ${name}`); } catch (e) { bad++; console.log(`FAILED ${name}: ${e && e.message}`); } };
const eq = (a, b) => { if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const refuses = (code, fn) => { try { fn(); } catch (e) { if (e instanceof S.StorageError && e.code === code) return; throw new Error(`expected ${code}, got ${e && (e.code || e.message)}`); } throw new Error(`expected ${code}, no refusal`); };
const b = (s) => Buffer.from(s, 'utf8').toString('base64');
const md = (c) => c.repeat(32);

const LIVEFIX = { grants: ['GRANT\tstorage.objects\tauthenticated\tSELECT', 'GRANT\tstorage.objects\tauthenticated\tINSERT'] };
function pins(source, o = {}) {
  const pol = o.policies ?? [
    ['storage.objects', 'synthetic read', 'SELECT', 'PERMISSIVE', 'authenticated', '(1 = 1)', null],
    ['storage.objects', 'synthetic write', 'INSERT', 'PERMISSIVE', 'authenticated', null, '(2 = 2)'],
  ];
  const L = [`#storage-pins\tv1\t${source}`];
  for (const [tb, n, c, p, r, u, k] of pol) L.push(['POLICY', tb, b(n), c, p, r, u === null ? '-' : b(u), k === null ? '-' : b(k)].join('\t'));
  L.push(...(o.rls ?? ['RLS\tstorage.objects\tt\tf', 'RLS\tstorage.buckets\tt\tf']));
  for (const id of S.COURSE_BUCKETS) L.push(o.bucket?.[id] ?? `BUCKET\t${id}\tf\tNULL\tNULL`);
  L.push(...(o.grants ?? ['GRANT\tstorage.objects\tauthenticated\tSELECT', 'GRANT\tstorage.objects\tauthenticated\tINSERT']));
  L.push(...(o.funcs ?? (source === 'LIVE'
    ? S.HELPERS.map((h) => `HELPER\t${h}\t${b('synthetic_arg uuid')}\t${md('c')}\t${md('e')}\tt\tt`)
    : [`FUNC\tstorage\tfoldername\t${b('name text')}\t${md('a')}\tsynthetic_owner\tf\t${md('b')}\tt`,
      ...S.HELPERS.map((h) => `FUNC\tpublic\t${h}\t${b('synthetic_arg uuid')}\t${md('c')}\tsynthetic_owner\tt\t${md('d')}\tt`)])));
  L.push(o.migrations ?? 'MIGRATIONS\t3\t2');
  if (o.extra) L.push(...o.extra);
  return `${L.join('\n')}\n`;
}

const stockFuncs = (mut = {}) => [`FUNC\tstorage\tfoldername\t${b('name text')}\t${md('a')}\tsynthetic_owner\tf\t${md('b')}\tt`,
  ...S.HELPERS.map((h) => `FUNC\tpublic\t${h}\t${b(mut[h]?.args ?? 'synthetic_arg uuid')}\t${mut[h]?.def ?? md('c')}\tsynthetic_owner\t${mut[h]?.sd ?? 't'}\t${mut[h]?.acl ?? md('d')}\t${mut[h]?.ex ?? 't'}`)];

// Grammar
t('PARSE well-formed STOCK', () => { const p = S.parsePins(pins('STOCK')); eq(p.policies.size, 2); eq(p.source, 'STOCK'); });
t('PARSE header refused', () => refuses('ST_E_HEADER', () => S.parsePins(pins('STOCK').replace('v1', 'v2'))));
t('PARSE no trailing LF', () => refuses('ST_E_PINS', () => S.parsePins(pins('STOCK').slice(0, -1))));
t('PARSE CR refused', () => refuses('ST_E_PINS', () => S.parsePins(pins('STOCK').replace('\n', '\r\n'))));
t('PARSE unknown kind', () => refuses('ST_E_KIND', () => S.parsePins(pins('STOCK', { extra: ['SQL\tdrop'] }))));
t('PARSE empty field', () => refuses('ST_E_LINE', () => S.parsePins(pins('STOCK', { extra: ['GRANT\t\tx\tSELECT'] }))));
t('PARSE foreign table', () => refuses('ST_E_TABLE', () => S.parsePins(pins('STOCK', { policies: [['public.profiles', 'synthetic', 'SELECT', 'PERMISSIVE', 'authenticated', '(1 = 1)', null]] }))));
t('PARSE bad cmd', () => refuses('ST_E_CMD', () => S.parsePins(pins('STOCK', { policies: [['storage.objects', 'synthetic', 'TRUNCATE', 'PERMISSIVE', 'authenticated', '(1 = 1)', null]] }))));
t('PARSE bad perm', () => refuses('ST_E_PERM', () => S.parsePins(pins('STOCK', { policies: [['storage.objects', 'synthetic', 'SELECT', 'MAYBE', 'authenticated', '(1 = 1)', null]] }))));
t('PARSE unsorted roles', () => refuses('ST_E_ROLE', () => S.parsePins(pins('STOCK', { policies: [['storage.objects', 'synthetic', 'SELECT', 'PERMISSIVE', 'b_role,a_role', '(1 = 1)', null]] }))));
t('PARSE INSERT with USING', () => refuses('ST_E_SHAPE', () => S.parsePins(pins('STOCK', { policies: [['storage.objects', 'synthetic', 'INSERT', 'PERMISSIVE', 'authenticated', '(1 = 1)', null]] }))));
t('PARSE SELECT with CHECK', () => refuses('ST_E_SHAPE', () => S.parsePins(pins('STOCK', { policies: [['storage.objects', 'synthetic', 'SELECT', 'PERMISSIVE', 'authenticated', null, '(1 = 1)']] }))));
t('PARSE duplicate policy', () => refuses('ST_E_DUP', () => S.parsePins(pins('STOCK', { policies: [['storage.objects', 'synthetic', 'SELECT', 'PERMISSIVE', 'authenticated', '(1 = 1)', null], ['storage.objects', 'synthetic', 'SELECT', 'PERMISSIVE', 'authenticated', '(2 = 2)', null]] }))));
t('PARSE non-canonical base64', () => refuses('ST_E_NAME', () => S.parsePins(pins('STOCK').replace(b('synthetic read'), `${b('synthetic read')}=`))));
t('PARSE missing course bucket', () => refuses('ST_E_INCOMPLETE', () => S.parsePins(pins('STOCK').split('\n').filter((l) => !l.startsWith('BUCKET\tcourse-videos')).join('\n'))));
t('PARSE foreign bucket', () => refuses('ST_E_BUCKET', () => S.parsePins(pins('STOCK', { extra: ['BUCKET\tsynthetic-other\tf\tNULL\tNULL'] }))));
t('PARSE bad mime', () => refuses('ST_E_BUCKET', () => S.parsePins(pins('STOCK', { bucket: { 'course-images': `BUCKET\tcourse-images\tf\t7\t${b('not a mime')}` } }))));
t('PARSE missing helper', () => refuses('ST_E_INCOMPLETE', () => S.parsePins(pins('STOCK', { funcs: [`FUNC\tstorage\tfoldername\t-\t${md('a')}\tsynthetic_owner\tf\t${md('b')}\tt`] }))));
t('PARSE public func outside helper scope', () => refuses('ST_E_FUNC_SCOPE', () => S.parsePins(pins('STOCK', { extra: [`FUNC\tpublic\tsynthetic_fn\t-\t${md('e')}\tsynthetic_owner\tf\t${md('f')}\tf`] }))));
t('PARSE missing migrations', () => refuses('ST_E_INCOMPLETE', () => S.parsePins(pins('STOCK').split('\n').filter((l) => !l.startsWith('MIGRATIONS')).join('\n'))));

// Expression gate
for (const [n, e] of [['semicolon', '(1 = 1); select 1'], ['line comment', '(1 = 1) -- x'], ['block comment', '(1 /* x */ = 1)'],
  ['dollar quote', '($q$x$q$ = 1)'], ['backslash', "('a\\' = 'a')"], ['unbalanced', '((1 = 1)'], ['negative depth', '1 = 1) or (1'],
  ['open literal', "('a = 1)"], ['backtick', '(`x` = 1)']]) t(`EXPR refuses ${n}`, () => refuses('ST_E_EXPR', () => S.checkExpr(e)));
t('EXPR allows semicolon inside a literal is still refused at generation? no: literal content is allowed', () => eq(S.checkExpr("('a;b' = 'a;b')"), "('a;b' = 'a;b')"));
t('EXPR allows doubled quotes and quoted idents', () => eq(S.checkExpr(`("x""y" = 'it''s')`), `("x""y" = 'it''s')`));

// Generator (LIVE only; zero-policy stock is a precondition, never a reconciliation)
const stock0 = () => S.parsePins(pins('STOCK', { policies: [] }));
const live0 = () => S.parsePins(pins('LIVE', LIVEFIX));
t('GEN refuses STOCK input', () => refuses('ST_E_SOURCE', () => S.generateMirror(stock0())));
t('GEN refuses a public course bucket in LIVE', () => refuses('ST_E_BUCKET_PUBLIC', () => S.generateMirror(S.parsePins(pins('LIVE', { ...LIVEFIX, bucket: { 'course-documents': 'BUCKET\tcourse-documents\tt\tNULL\tNULL' } })))));
t('GEN creates every LIVE policy, guards zero stock policies first, shape holds', () => {
  const g = S.generateMirror(live0());
  eq(g.creates, 2);
  const L = g.sql.trimEnd().split('\n');
  eq(L[0], 'begin;'); eq(L[L.length - 1], 'commit;'); eq(L[2].includes("<> 0 then raise exception 'ST_E_STOCK_POLICIES'"), true);
  eq((g.sql.match(/^create policy /gm) || []).length, 2);
  eq((g.sql.match(/update storage\.buckets/g) || []).length, 3);
  eq(/drop |grant |revoke |alter |truncate |delete /i.test(g.sql.replace(/'(?:[^']|'')*'/g, "''")), false);
});
t('GEN keeps broad peers and restrictive policies verbatim (none chosen away)', () => {
  const live = S.parsePins(pins('LIVE', { ...LIVEFIX, policies: [
    ['storage.objects', 'synthetic narrow', 'INSERT', 'PERMISSIVE', 'authenticated', null, '(1 = 2)'],
    ['storage.objects', 'synthetic broad peer', 'ALL', 'PERMISSIVE', 'public', '(1 = 1)', '(1 = 1)'],
    ['storage.objects', 'synthetic restrictive', 'UPDATE', 'RESTRICTIVE', 'authenticated', '(3 = 3)', '(3 = 3)'],
  ] }));
  const g = S.generateMirror(live);
  eq(g.creates, 3);
  if (!g.sql.includes('create policy "synthetic broad peer" on storage.objects as PERMISSIVE for ALL to public using ((1 = 1)) with check ((1 = 1));')) throw new Error('broad peer not mirrored verbatim');
  if (!/as RESTRICTIVE for UPDATE/.test(g.sql)) throw new Error('restrictive not kept');
});
t('GEN multi-line expression (LF outside quotes) becomes one line; LF inside a literal refuses', () => {
  const live = S.parsePins(pins('LIVE', { ...LIVEFIX, policies: [['storage.objects', 'synthetic multi', 'SELECT', 'PERMISSIVE', 'authenticated', '(EXISTS ( SELECT 1\n   FROM (SELECT 1) x\n  WHERE (1 = 1)))', null]] }));
  if (!S.generateMirror(live).sql.includes('using ((EXISTS ( SELECT 1    FROM (SELECT 1) x   WHERE (1 = 1))));')) throw new Error('not flattened');
  refuses('ST_E_EXPR', () => S.parsePins(pins('LIVE', { ...LIVEFIX, policies: [['storage.objects', 'synthetic lf', 'SELECT', 'PERMISSIVE', 'authenticated', "('a\nb' = 'x')", null]] })));
  refuses('ST_E_NAME', () => S.parsePins(pins('LIVE', { ...LIVEFIX, policies: [['storage.objects', 'synthetic\nname', 'SELECT', 'PERMISSIVE', 'authenticated', '(1 = 1)', null]] })));
});
t('GEN bucket limits are LIVE values with a guarded single-row update requiring public = false', () => {
  const g = S.generateMirror(S.parsePins(pins('LIVE', { ...LIVEFIX, bucket: { 'course-images': `BUCKET\tcourse-images\tf\t12345\t${b('image/png,image/*')}` } })));
  if (!g.sql.includes("set file_size_limit = 12345, allowed_mime_types = array['image/png', 'image/*']::text[] where id = 'course-images' and public = false;")) throw new Error('limit not mirrored');
  if (!/where id = 'course-documents' and public = false; get diagnostics n = row_count; if n <> 1/.test(g.sql)) throw new Error('row guard missing');
  eq(/set public|public = true/.test(g.sql), false);
});
t('GEN policy names with quotes and spaces are identifier-quoted', () => {
  const live = S.parsePins(pins('LIVE', { ...LIVEFIX, policies: [['storage.objects', "synthetic it's", 'SELECT', 'PERMISSIVE', 'authenticated', '(1 = 1)', null]] }));
  if (!S.generateMirror(live).sql.includes(`create policy "synthetic it's" on storage.objects`)) throw new Error('name not quoted');
});
t('GEN name with a double quote refused at parse', () => refuses('ST_E_NAME', () => S.parsePins(pins('LIVE', { ...LIVEFIX, policies: [['storage.objects', 'synthetic "x"', 'SELECT', 'PERMISSIVE', 'authenticated', '(1 = 1)', null]] }))));
const HEAD = "begin;\nset local lock_timeout = '5s';\ndo $m$ begin if (select count(*) from pg_policies where schemaname = 'storage' and tablename in ('objects', 'buckets')) <> 0 then raise exception 'ST_E_STOCK_POLICIES'; end if; end $m$;\n";
t('SHAPE refuses an injected statement line', () => refuses('ST_E_MIRROR_SHAPE', () => S.assertMirrorShape(`${HEAD}grant all on storage.objects to anon;\ncommit;\n`)));
t('SHAPE refuses a drop line (no reconciliation path)', () => refuses('ST_E_MIRROR_SHAPE', () => S.assertMirrorShape(`${HEAD}drop policy "x" on storage.objects;\ncommit;\n`)));
t('SHAPE refuses a second terminator in a create line', () => refuses('ST_E_MIRROR_SHAPE', () => S.assertMirrorShape(`${HEAD}create policy "x" on storage.objects as PERMISSIVE for SELECT to public using (1 = 1); drop table x;\ncommit;\n`)));
t('SHAPE refuses a missing zero-policy guard', () => refuses('ST_E_MIRROR_SHAPE', () => S.assertMirrorShape("begin;\nset local lock_timeout = '5s';\ncommit;\n")));

// S1 preconditions and dependencies
t('S1 PASS on a matching zero-policy stock', () => eq(S.stockPreconditions(live0(), stock0()).startsWith('S1 PASS'), true));
t('S1 refuses stock policies present', () => refuses('ST_E_STOCK_POLICIES', () => S.stockPreconditions(live0(), S.parsePins(pins('STOCK')))));
t('S1 refuses RLS differing from LIVE', () => refuses('ST_E_RLS', () => S.stockPreconditions(live0(), S.parsePins(pins('STOCK', { policies: [], rls: ['RLS\tstorage.objects\tt\tf', 'RLS\tstorage.buckets\tf\tf'] })))));
t('S1 refuses a public course bucket locally', () => refuses('ST_E_BUCKET_PUBLIC', () => S.stockPreconditions(live0(), S.parsePins(pins('STOCK', { policies: [], bucket: { 'course-images': 'BUCKET\tcourse-images\tt\tNULL\tNULL' } })))));
t('S1 refuses a helper definition change', () => refuses('ST_E_HELPER', () => S.stockPreconditions(live0(), S.parsePins(pins('STOCK', { policies: [], funcs: stockFuncs({ has_role: { def: md('9') } }) })))));
t('S1 refuses a helper identity-args change', () => refuses('ST_E_HELPER', () => S.stockPreconditions(live0(), S.parsePins(pins('STOCK', { policies: [], funcs: stockFuncs({ get_user_roles: { args: 'other uuid' } }) })))));
t('S1 refuses a helper losing SECURITY DEFINER', () => refuses('ST_E_HELPER', () => S.stockPreconditions(live0(), S.parsePins(pins('STOCK', { policies: [], funcs: stockFuncs({ has_admin_access: { sd: 'f' } }) })))));
t('S1 refuses a helper losing authenticated EXECUTE', () => refuses('ST_E_HELPER', () => S.stockPreconditions(live0(), S.parsePins(pins('STOCK', { policies: [], funcs: stockFuncs({ can_manage_course_materials: { ex: 'f' } }) })))));
t('S1 refuses a missing LIVE grant dependency (no global grant is added)', () => refuses('ST_E_GRANT_DEP', () => S.stockPreconditions(live0(), S.parsePins(pins('STOCK', { policies: [], grants: ['GRANT\tstorage.objects\tauthenticated\tSELECT'] })))));
t('S1 ignores a LIVE grant to a non-API role (postgres) absent locally', () => eq(S.stockPreconditions(S.parsePins(pins('LIVE', { ...LIVEFIX, grants: [...LIVEFIX.grants, 'GRANT\tstorage.objects\tpostgres\tTRIGGER'] })), stock0()).startsWith('S1 PASS'), true));
t('PARSE HELPER only in LIVE, FUNC only in STOCK', () => {
  refuses('ST_E_LINE', () => S.parsePins(pins('STOCK', { policies: [], extra: [`HELPER\thas_role\t${b('x uuid')}\t${md('c')}\t${md('c')}\tt\tt`] })));
  refuses('ST_E_LINE', () => S.parsePins(pins('LIVE', { ...LIVEFIX, extra: [`FUNC\tstorage\tfoldername\t-\t${md('a')}\tsynthetic_owner\tf\t${md('b')}\tt`] })));
});

// S1/S3 comparison
const stockA = () => S.parsePins(pins('STOCK', { policies: [] }));
t('CMP S1 identical STOCK pins PASS', () => { const r = S.compareInventory(stockA(), stockA()); eq(r.pass, true); eq(r.line.startsWith('PASS policy_missing=0'), true); });
t('CMP S1 policy drift (stock gained a policy) FAIL extra', () => { const r = S.compareInventory(stockA(), S.parsePins(pins('STOCK'))); eq(r.pass, false); eq(r.counts.policy_extra, 2); });
t('CMP helper changed FAIL', () => eq(S.compareInventory(stockA(), S.parsePins(pins('STOCK', { policies: [], funcs: stockFuncs({ has_role: { def: md('e') } }) }))).counts.func_changed, 1));
t('CMP helper privilege (ACL) changed FAIL', () => eq(S.compareInventory(stockA(), S.parsePins(pins('STOCK', { policies: [], funcs: stockFuncs({ get_user_roles: { acl: md('f') } }) }))).counts.func_changed, 1));
t('CMP helper EXECUTE flag changed FAIL', () => eq(S.compareInventory(stockA(), S.parsePins(pins('STOCK', { policies: [], funcs: stockFuncs({ has_role: { ex: 'f' } }) }))).counts.func_changed, 1));
t('CMP grant added FAIL', () => eq(S.compareInventory(stockA(), S.parsePins(pins('STOCK', { policies: [], grants: ['GRANT\tstorage.objects\tauthenticated\tSELECT', 'GRANT\tstorage.objects\tauthenticated\tINSERT', 'GRANT\tstorage.objects\tanon\tDELETE'] }))).counts.grant_extra, 1));
t('CMP grant removed FAIL', () => eq(S.compareInventory(stockA(), S.parsePins(pins('STOCK', { policies: [], grants: ['GRANT\tstorage.objects\tauthenticated\tSELECT'] }))).counts.grant_missing, 1));
t('CMP public bucket flip FAIL', () => eq(S.compareInventory(stockA(), S.parsePins(pins('STOCK', { policies: [], bucket: { 'course-documents': 'BUCKET\tcourse-documents\tt\tNULL\tNULL' } }))).counts.bucket_public, 1));
t('CMP RLS off FAIL', () => eq(S.compareInventory(stockA(), S.parsePins(pins('STOCK', { policies: [], rls: ['RLS\tstorage.objects\tf\tf', 'RLS\tstorage.buckets\tt\tf'] }))).counts.rls_changed, 1));
t('CMP storage migrations drift FAIL', () => eq(S.compareInventory(stockA(), S.parsePins(pins('STOCK', { policies: [], migrations: 'MIGRATIONS\t4\t3' }))).counts.migrations, 1));
t('CMP line always carries all 12 categories', () => eq(S.compareInventory(stockA(), stockA()).line.split(' ').length, 13));

// S3: expectation after the mirror
t('S3 expected = LIVE policies + LIVE limits + STOCK rest: an exact mirror PASSes', () => {
  const live = S.parsePins(pins('LIVE', { bucket: { 'course-videos': 'BUCKET\tcourse-videos\tf\t500\tNULL' } }));
  const after = S.parsePins(pins('STOCK', { bucket: { 'course-videos': 'BUCKET\tcourse-videos\tf\t500\tNULL' } }));
  eq(S.compareInventory(S.expectedAfterMirror(live, stockA()), after).pass, true);
});
t('S3 a missing mirrored policy FAILs', () => {
  const after = S.parsePins(pins('STOCK', { policies: [['storage.objects', 'synthetic read', 'SELECT', 'PERMISSIVE', 'authenticated', '(1 = 1)', null]] }));
  eq(S.compareInventory(S.expectedAfterMirror(live0(), stockA()), after).counts.policy_missing, 1);
});
t('S3 an unrelated grant change during the mirror FAILs', () => {
  const after = S.parsePins(pins('STOCK', { grants: ['GRANT\tstorage.objects\tauthenticated\tSELECT', 'GRANT\tstorage.objects\tauthenticated\tINSERT', 'GRANT\tstorage.buckets\tPUBLIC\tSELECT'] }));
  eq(S.compareInventory(S.expectedAfterMirror(live0(), stockA()), after).counts.grant_extra, 1);
});
t('S3 a limit left at the stock value FAILs', () => {
  const live = S.parsePins(pins('LIVE', { bucket: { 'course-videos': 'BUCKET\tcourse-videos\tf\t500\tNULL' } }));
  eq(S.compareInventory(S.expectedAfterMirror(live, stockA()), S.parsePins(pins('STOCK'))).counts.bucket_limit, 1);
});

// S4 wrapper and residue
t('PROBE prefix digits only', () => { eq(S.probePrefix(123, 1), 'probe-123-1-'); refuses('ST_E_PROBE_ID', () => S.probePrefix('12x', 1)); refuses('ST_E_PROBE_ID', () => S.probePrefix(1, 0)); });
t('PROBE always ends in rollback with ON_ERROR_STOP', () => { const w = S.wrapProbe('select 1;'); eq(w, '\\set ON_ERROR_STOP 1\nbegin;\nselect 1;\nrollback;\n'); });
for (const s of ['commit;', 'select 1; COMMIT;', 'end;', 'select 1;\n  rollback;', 'savepoint a;', 'start transaction;', 'prepare transaction \'x\';', '\\set ON_ERROR_STOP 0'])
  t(`PROBE refuses transaction control: ${JSON.stringify(s)}`, () => refuses('ST_E_PROBE', () => S.wrapProbe(s)));
t('PROBE allows the words inside a literal', () => eq(S.wrapProbe("select 'commit; end';").includes("select 'commit; end';"), true));
t('RESIDUE zero passes', () => eq(S.residueVerdict(['0']), 'RESIDUE 0 PASS'));
t('RESIDUE non-zero refuses', () => refuses('ST_E_RESIDUE', () => S.residueVerdict(['1'])));
t('RESIDUE unreadable refuses', () => { refuses('ST_E_RESIDUE_READ', () => S.residueVerdict([])); refuses('ST_E_RESIDUE_READ', () => S.residueVerdict(['x'])); });
t('RESIDUE sql uses the validated prefix only', () => { eq(S.residueSql('probe-9-1-'), "select count(*) from storage.objects where position('probe-9-1-' in name) > 0;\n"); refuses('ST_E_PROBE_ID', () => S.residueSql("probe-9-1-' or 1=1 --")); });

// Static: capture.sql is read-only and in scope
const here = path.dirname(fileURLToPath(import.meta.url));
const cap = fs.readFileSync(path.join(here, '..', 'capture.sql'), 'utf8');
t('CAPTURE read-only transaction, no write verbs', () => {
  const body = cap.split('\n').filter((l) => !l.startsWith('--')).join('\n');
  eq(/^begin transaction read only;$/m.test(body), true); eq(/^commit;$/m.test(body), true);
  eq(/\b(insert|update|delete|drop|create|alter|grant|revoke|truncate|copy|set_config|pg_read_file|lo_)\b/i.test(body.replace(/'(?:[^']|'')*'/g, "''")), false);
});
t('CAPTURE reads no object rows (storage.objects only as a policy/grant table name literal)', () => eq(/from\s+storage\.objects/i.test(cap), false));
t('CAPTURE header emits STOCK and the v1 grammar', () => eq(cap.includes("E'#storage-pins\\tv1\\tSTOCK'"), true));

console.log(`storage-selftest: ${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
