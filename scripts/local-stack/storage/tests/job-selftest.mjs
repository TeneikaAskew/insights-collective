#!/usr/bin/env node
// ABOUTME: Fake-driven selftest for storage-job.mjs (s0 to s4) and probes.mjs. The psql route is a fake: no service, no
// ABOUTME: database. BOTH sides are SYNTHETIC: a made-up metadata input with its own digests stands in for the private one.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import * as S from '../storage-core.mjs';
import { main, s0, assertPrivateDir, readPrivate, MAX_PRIVATE_READ, CAPTURE_SQL, EGRESS_VERIFY_SQL, IDENTITIES_SQL, PINS_FILE, MIRROR_FILE, INPUT_ENV, PINNED } from '../storage-job.mjs';
import { convert, SOURCE_SHA256, SOURCE_BYTES } from '../live-pins.mjs';
import { LIVE_PINS_SHA256, MIRROR_SHA256 } from '../gen-mirror.mjs';
import { probeScripts, probeVerdict, cases, C, U, PROBE_PINS_SHA256 } from '../probes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let ok = 0, bad = 0;
const t = async (name, fn) => { try { await fn(); ok++; console.log(`ok ${name}`); } catch (e) { bad++; console.log(`FAILED ${name}: ${e && (e.code || e.message)}`); } };
const eq = (a, b) => { if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const sha = (b) => createHash('sha256').update(b).digest('hex');

import { SYN_POLICIES, synInput } from './synthetic-input.mjs';

const SYN = synInput();
const synPinsText = convert(Buffer.from(SYN.raw), { expectSha: SYN.sourceSha, expectBytes: SYN.sourceBytes }).text;
const SYN_PINNED = Object.freeze({ sourceSha: SYN.sourceSha, sourceBytes: SYN.sourceBytes, pinsSha: sha(synPinsText), mirrorSha: sha(S.generateMirror(S.parsePins(synPinsText)).sql) });
const live = S.parsePins(synPinsText);
const livePinsText = synPinsText;

// Synthetic STOCK: zero policies, RLS as LIVE, private buckets with no limits, LIVE helper facts, LIVE API grants.
function stockText({ policies = '', bucketPublic = false, limitsFromLive = false, extraGrant = '', helperDef } = {}) {
  const L = ['#storage-pins\tv1\tSTOCK'];
  if (policies) L.push(policies);
  for (const t of S.TABLES) L.push(`RLS\t${t}\t${live.rls.get(t)}`.replace(/\t(t|f)(t|f)$/, '\t$1\t$2'));
  for (const id of S.COURSE_BUCKETS) {
    const v = live.buckets.get(id);
    L.push(limitsFromLive ? `BUCKET\t${id}\tf\t${v.size ?? 'NULL'}\t${v.mimes ? b64(v.mimes.join(',')) : 'NULL'}` : `BUCKET\t${id}\t${bucketPublic && id === 'course-documents' ? 't' : 'f'}\tNULL\tNULL`);
  }
  for (const g of live.grants) L.push(`GRANT\t${g}`);
  if (extraGrant) L.push(extraGrant);
  L.push(`FUNC\tstorage\tfoldername\t${b64('name text')}\t${'a'.repeat(32)}\tsynthetic_owner\tf\t${'b'.repeat(32)}\tt`);
  for (const [name, h] of live.helpers) L.push(`FUNC\tpublic\t${name}\t${b64(h.args)}\t${helperDef?.[name] ?? h.def}\tsynthetic_owner\t${h.secdef ? 't' : 'f'}\t${'d'.repeat(32)}\t${h.exec ? 't' : 'f'}`);
  L.push('MIGRATIONS\t75\t74');
  return `${L.join('\n')}\n`;
}
const livePolicyLines = livePinsText.split('\n').filter((l) => l.startsWith('POLICY\t')).join('\n');

/** Fake psql: state machine over the script kinds the job sends. */
function fakePsql(o = {}) {
  const st = { mirrored: false, calls: [] };
  const fn = async ({ script, privDir, dsn, env }) => {
    if (!dsn || env.SUPABASE_DB_URL || !privDir) throw new S.StorageError('FAKE_BAD_ROUTE');
    if (script.includes(CAPTURE_SQL)) {
      st.calls.push('capture');
      const after = st.mirrored ? (o.afterCapture ?? stockText({ policies: livePolicyLines, limitsFromLive: true })) : (o.stockCapture ?? stockText());
      return (typeof after === 'function' ? after(st) : after).trimEnd().split('\n');
    }
    if (script.includes(EGRESS_VERIFY_SQL)) { st.calls.push('guard'); if (!script.includes("\\set stage 'app'")) throw new S.StorageError('FAKE_STAGE'); if (o.guardFails) { const e = new Error('x'); e.code = 'PSQL_E_EXIT'; throw e; } return []; }
    if (script.includes(IDENTITIES_SQL)) { st.calls.push('ids'); st.idn = (st.idn ?? 0) + 1; return o.idsChange && st.idn > 1 ? ['policy\tx\t1', 'function\ty\t2'] : ['function\ty\t2']; }
    if (script.startsWith('begin;\nset local lock_timeout')) { st.calls.push('mirror'); if (o.mirrorFails) { const e = new Error('x'); e.code = 'PSQL_E_EXIT'; throw e; } st.mirrored = true; return []; }
    if (script.startsWith('select count(*) from storage.objects where position(')) { st.calls.push('residue'); return [String(o.residue ?? 0)]; }
    if (script.startsWith('\\set ON_ERROR_STOP 1\nbegin;\n')) {
      const id = Object.keys(EXPECT).find((k) => script.includes(`-${k}.pdf'`));
      st.calls.push(`probe:${id}`);
      if (o.probe?.[id] === 'EXIT') { const e = new Error('x'); e.code = 'PSQL_E_EXIT'; throw e; }
      return o.probe?.[id] ?? EXPECT[id];
    }
    throw new S.StorageError('FAKE_UNKNOWN_SCRIPT');
  };
  fn.st = st; return fn;
}
const EXPECT = Object.fromEntries(cases('probe-1-1-', '').map((c) => [c.id, c.expect]));
const ENV = { SUPABASE_DB_URL: 'postgresql://postgres:synthetic@127.0.0.1:54322/postgres', PATH: process.env.PATH };
const ENV_S0 = { [INPUT_ENV]: SYN.raw, PATH: process.env.PATH }; // the input is bound to s0 only (no DSN there either)
const priv = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'st-priv-')); fs.chmodSync(d, 0o700); return d; };
const ALL = [['s0'], ['s1'], ['s2'], ['s3'], ['s4', '41000000001', '1']];
async function runAll(o = {}, steps = ALL) {
  const dir = priv(); const out = []; const psql = fakePsql(o);
  try { for (const s of steps) { const [cmd, ...rest] = s; await main([cmd, dir, ...rest], cmd === 's0' ? (o.envS0 ?? ENV_S0) : (o.env ?? ENV), (l) => out.push(l), psql, o.pinned ?? SYN_PINNED); } return { out, calls: psql.st.calls, err: null }; }
  catch (e) { return { out, calls: psql.st.calls, err: e.code }; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const SYN_SECRET_STRINGS = [...SYN_POLICIES.flatMap((x) => [x.name, x.using, x.with_check].filter(Boolean)), '1048577', '2097153', 'text/x-synthetic', 'video/x-synthetic'];

// Public tree: the private-derived files are not in the repository
await t('PUBLIC no live-pins.tsv, mirror.sql or live-identities.tsv in scripts/local-stack/storage/', () => {
  for (const f of ['live-pins.tsv', 'mirror.sql', 'live-identities.tsv']) eq(fs.existsSync(path.join(HERE, '..', f)), false);
});
await t('PUBLIC reviewed digests: probes bound to the pins digest; PINNED equals the module constants', () => {
  eq(PROBE_PINS_SHA256, LIVE_PINS_SHA256);
  eq(PINNED.sourceSha, SOURCE_SHA256); eq(PINNED.sourceBytes, SOURCE_BYTES); eq(PINNED.pinsSha, LIVE_PINS_SHA256); eq(PINNED.mirrorSha, MIRROR_SHA256);
  for (const h of [SOURCE_SHA256, LIVE_PINS_SHA256, MIRROR_SHA256]) eq(/^[0-9a-f]{64}$/.test(h), true);
});

// S0: private input -> private pins and mirror
const s0In = (dirMut = () => {}, env = ENV_S0, pinned = SYN_PINNED) => {
  const dir = priv();
  try { const arg = dirMut(dir) ?? dir; const out = []; let err = null; try { out.push(s0(assertPrivateDir(arg), env, pinned)); } catch (e) { err = e.code; } return { err, out, files: fs.readdirSync(dir).sort() }; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); if (fs.existsSync(`${dir}-link`)) fs.rmSync(`${dir}-link`, { force: true }); }
};
await t('S0 happy: writes exactly pins.tsv and mirror.sql at 0600; the input itself is not written', () => {
  const dir = priv();
  try {
    const line = s0(assertPrivateDir(dir), ENV_S0, SYN_PINNED);
    eq(fs.readdirSync(dir).sort().join(','), `${MIRROR_FILE},${PINS_FILE}`);
    for (const f of [PINS_FILE, MIRROR_FILE]) eq(fs.statSync(path.join(dir, f)).mode & 0o777, 0o600);
    eq(sha(fs.readFileSync(path.join(dir, PINS_FILE))), SYN_PINNED.pinsSha); eq(sha(fs.readFileSync(path.join(dir, MIRROR_FILE))), SYN_PINNED.mirrorSha);
    eq(line, `S0 PASS input sha256 ${SYN_PINNED.sourceSha} bytes verified; pins sha256 ${SYN_PINNED.pinsSha}; mirror sha256 ${SYN_PINNED.mirrorSha} (both private 0600; input not written)`);
    for (const x of SYN_SECRET_STRINGS) eq(line.includes(x), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
await t('S0 refuses an absent input', () => { const r = s0In(undefined, { PATH: '/usr/bin' }); eq(r.err, 'ST_E_INPUT_ABSENT'); eq(r.files.length, 0); });
await t('S0 refuses an empty input', () => { const r = s0In(undefined, { [INPUT_ENV]: '' }); eq(r.err, 'ST_E_INPUT_ABSENT'); eq(r.files.length, 0); });
await t('S0 refuses wrong bytes (one trailing newline added)', () => { const r = s0In(undefined, { [INPUT_ENV]: `${SYN.raw}\n` }); eq(r.err, 'ST_E_SOURCE_BYTES'); eq(r.files.length, 0); });
await t('S0 refuses a same-length input with a different sha256', () => { const r = s0In(undefined, { [INPUT_ENV]: SYN.raw.replace('synthetic"', 'synthetiX"') }); eq(r.err, 'ST_E_SOURCE_SHA'); eq(r.files.length, 0); });
await t('S0 refuses when the derived pins differ from the reviewed pins digest (nothing written)', () => { const r = s0In(undefined, ENV_S0, { ...SYN_PINNED, pinsSha: '0'.repeat(64) }); eq(r.err, 'ST_E_PINS_SHA'); eq(r.files.length, 0); });
await t('S0 refuses when the generated mirror differs from the reviewed mirror digest (nothing written)', () => { const r = s0In(undefined, ENV_S0, { ...SYN_PINNED, mirrorSha: '0'.repeat(64) }); eq(r.err, 'ST_E_MIRROR_SHA'); eq(r.files.length, 0); });
await t('S0 refuses a pre-existing pins.tsv (O_EXCL)', () => { const r = s0In((d) => { fs.writeFileSync(path.join(d, PINS_FILE), 'x', { mode: 0o600 }); }); eq(r.err, 'ST_E_PRIVATE_WRITE'); });
await t('S0 refuses a symlink planted at mirror.sql (O_NOFOLLOW; target untouched)', () => {
  const tdir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-target-')); const tgt = path.join(tdir, 'target'); fs.writeFileSync(tgt, 'keep', { mode: 0o600, flag: 'wx' });
  try { const r = s0In((d) => { fs.symlinkSync(tgt, path.join(d, MIRROR_FILE)); }); eq(r.err, 'ST_E_PRIVATE_WRITE'); eq(fs.readFileSync(tgt, 'utf8'), 'keep'); } finally { fs.rmSync(tdir, { recursive: true, force: true }); }
});
await t('S0 refuses a symlinked private dir', () => { const r = s0In((d) => { fs.symlinkSync(d, `${d}-link`); return `${d}-link`; }); eq(r.err, 'ST_E_PRIVATE_DIR'); eq(r.files.length, 0); });
await t('S0 refuses a 0755 private dir', () => { const r = s0In((d) => { fs.chmodSync(d, 0o755); }); eq(r.err, 'ST_E_PRIVATE_DIR'); eq(r.files.length, 0); });
await t('S0 census refuses a missing structural row (one RLS row removed, digests recomputed)', () => {
  const m = synInput((d) => { d.rows = d.rows.filter((r, i, a) => !(r.kind === 'RLS' && a.findIndex((x) => x.kind === 'RLS') === i)); return d; });
  const r = s0In(undefined, { [INPUT_ENV]: m.raw }, { ...SYN_PINNED, sourceSha: m.sourceSha, sourceBytes: m.sourceBytes }); eq(r.err, 'ST_E_SOURCE_CENSUS');
});
await t('S0 census refuses an input with no POLICY row', () => {
  const m = synInput((d) => { d.rows = d.rows.filter((r) => r.kind !== 'POLICY'); return d; });
  const r = s0In(undefined, { [INPUT_ENV]: m.raw }, { ...SYN_PINNED, sourceSha: m.sourceSha, sourceBytes: m.sourceBytes }); eq(r.err, 'ST_E_SOURCE_CENSUS');
});
await t('S0 refuses a policy whose identity md5 does not match its text', () => {
  const m = synInput((d) => { d.rows.find((r) => r.kind === 'POLICY').metadata.identity_md5 = 'f'.repeat(32); return d; });
  const r = s0In(undefined, { [INPUT_ENV]: m.raw }, { ...SYN_PINNED, sourceSha: m.sourceSha, sourceBytes: m.sourceBytes }); eq(r.err, 'ST_E_SOURCE_IDENTITY');
});
await t('S0 refuses a public course bucket in the input', () => {
  const m = synInput((d) => { d.rows.find((r) => r.kind === 'BUCKET').metadata.public = true; return d; });
  const r = s0In(undefined, { [INPUT_ENV]: m.raw }, { ...SYN_PINNED, sourceSha: m.sourceSha, sourceBytes: m.sourceBytes }); eq(r.err, 'ST_E_BUCKET_PUBLIC');
});
await t('S0 CLI (real reviewed digests): a synthetic input refuses with a fixed code; the value never reaches stdout or stderr', () => {
  const dir = priv();
  try {
    const r = spawnSync(process.execPath, [path.join(HERE, '..', 'storage-job.mjs'), 's0', dir], { env: { PATH: process.env.PATH, [INPUT_ENV]: SYN.raw }, encoding: 'utf8' });
    eq(r.status, 3); eq(r.stdout, ''); eq(r.stderr, 'storage-job refused: ST_E_SOURCE_BYTES\n');
    for (const x of [SYN.raw, ...SYN_SECRET_STRINGS]) { eq(r.stdout.includes(x), false); eq(r.stderr.includes(x), false); }
    eq(fs.readdirSync(dir).length, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
await t('S0 CLI: a malformed (non-JSON) input of the right length refuses before parse output; nothing echoed', () => {
  const dir = priv();
  try {
    const raw = '{'.repeat(SOURCE_BYTES);
    const r = spawnSync(process.execPath, [path.join(HERE, '..', 'storage-job.mjs'), 's0', dir], { env: { PATH: process.env.PATH, [INPUT_ENV]: raw }, encoding: 'utf8' });
    eq(r.status, 3); eq(r.stdout, ''); eq(r.stderr, 'storage-job refused: ST_E_SOURCE_SHA\n');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
for (const st of ['s1', 's2', 's3']) {
  await t(`SCOPE ${st} refuses when the input variable is present (bound to s0 only); no psql call`, async () => {
    const r = await runAll({ env: { ...ENV, [INPUT_ENV]: 'x' } }, [['s0'], [st]]); eq(r.err, 'ST_E_INPUT_SCOPE'); eq(r.calls.length, 0);
  });
}
await t('SCOPE s4 refuses when the input variable is present, even empty', async () => { const r = await runAll({ env: { ...ENV, [INPUT_ENV]: '' } }, [['s0'], ['s4', '41000000001', '1']]); eq(r.err, 'ST_E_INPUT_SCOPE'); eq(r.calls.length, 0); });
await t('PINNED S1 refuses a tampered private mirror (still 0600) before any psql call', async () => {
  const dir = priv(); const psql = fakePsql();
  try { await main(['s0', dir], ENV_S0, () => {}, psql, SYN_PINNED); fs.appendFileSync(path.join(dir, MIRROR_FILE), '-- x\n');
    let err = null; try { await main(['s1', dir], ENV, () => {}, psql, SYN_PINNED); } catch (e) { err = e.code; } eq(err, 'ST_E_GENERATED_DRIFT'); eq(psql.st.calls.length, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
await t('PINNED S1 refuses tampered private pins before any psql call', async () => {
  const dir = priv(); const psql = fakePsql();
  try { await main(['s0', dir], ENV_S0, () => {}, psql, SYN_PINNED); fs.appendFileSync(path.join(dir, PINS_FILE), 'MIGRATIONS\t1\t1\n');
    let err = null; try { await main(['s1', dir], ENV, () => {}, psql, SYN_PINNED); } catch (e) { err = e.code; } eq(err, 'ST_E_PINS_SHA'); eq(psql.st.calls.length, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
await t('PINNED S1 without S0 refuses (no private pins) before any psql call', async () => { const r = await runAll({}, [['s1']]); eq(r.err, 'ST_E_PRIVATE_OPEN'); eq(r.calls.length, 0); });
await t('PINNED S2 sends the verified mirror text itself, not an include of a file path', async () => {
  const r = await runAll(); eq(r.err, null); eq(r.calls.includes('mirror'), true);
});

// Mirror generated from the synthetic pins (the real one exists only in the runner's private dir)
await t('GENERATED mirror: one create per pinned policy, 3 guarded bucket updates, zero-policy guard, no drop/grant/alter', () => {
  const m = S.generateMirror(live).sql;
  eq((m.match(/^create policy /gm) || []).length, live.policies.size); eq((m.match(/update storage\.buckets/g) || []).length, 3);
  eq(m.split('\n')[2].includes("<> 0 then raise exception 'ST_E_STOCK_POLICIES'"), true);
  eq(/^(drop|grant|revoke|alter|truncate|delete|insert)\b/im.test(m), false);
  eq(/set public|public = true/.test(m), false);
  for (const x of live.policies.values()) eq(m.split(`create policy "${x.name.replace(/"/g, '""')}" on ${x.table} `).length, 2);
});

// Probe scripts
const ps = probeScripts('41000000001', '1', live);
await t('PROBE 8 cases, each wrapped begin..rollback, no commit, names run-owned', () => {
  eq(ps.length, 8);
  for (const p of ps) { eq(p.script.startsWith('\\set ON_ERROR_STOP 1\nbegin;\n'), true); eq(p.script.endsWith('\nrollback;\n'), true); eq(/\bcommit\b/i.test(p.script), false); eq(p.script.includes('probe-41000000001-1-'), true); }
});
await t('PROBE O1 is EMULATED and drops exactly the mirrored names before its INSERT', () => {
  const o = ps.find((p) => p.id === 'O1'); eq(o.kind, 'OLD_EMULATED'); eq((o.script.match(/^drop policy /gm) || []).length, live.policies.size);
  eq(o.script.indexOf('drop policy') < o.script.indexOf('insert into storage.objects'), true);
});
await t('PROBE N1 path is submissions/<course>/<learner>/<prefix>N1.pdf in course-documents', () => eq(ps[0].script.includes(`'course-documents', 'submissions/${C}/${U.M}/probe-41000000001-1-N1.pdf'`), true));
await t('PROBE learner cases set M claims; anon case sets no sub', () => {
  eq(ps.find((p) => p.id === 'X2').script.includes(`{"sub":"${U.M}","role":"authenticated"}`), true);
  eq(ps.find((p) => p.id === 'X4').script.includes('{"role":"anon"}'), true);
});
await t('PROBE X2 (not enrolled) has no enrollment insert; N1 has one inside its transaction', () => {
  eq(ps.find((p) => p.id === 'X2').script.includes('insert into public.enrollments'), false);
  const n1 = ps[0].script; eq(n1.indexOf('begin;') < n1.indexOf('insert into public.enrollments'), true);
});
await t('PROBE verdict exact tokens PASS; reordered, extra, missing, raw text and exit all FAIL', () => {
  const c = ps[0];
  eq(probeVerdict(c, c.expect).ok, true);
  eq(probeVerdict(c, [...c.expect].reverse()).ok, false);
  eq(probeVerdict(c, [...c.expect, 'insert=ALLOWED']).ok, false);
  eq(probeVerdict(c, c.expect.slice(1)).ok, false);
  eq(probeVerdict(c, ['ERROR: something']).ok, false);
  eq(probeVerdict(c, null).ok, false);
  eq(probeVerdict(c, null).line.includes('UNPARSEABLE'), true);
});
await t('PROBE refuses a non-numeric run id', () => { try { probeScripts('abc', '1', live); } catch (e) { eq(e.code, 'ST_E_PROBE_ID'); return; } throw new Error('no refusal'); });

// Job, end to end on the fake route
await t('JOB happy path: S1, S2, S3, S4 all PASS in order; residue and catalog after EACH probe', async () => {
  const r = await runAll();
  eq(r.err, null);
  eq(r.out[0].startsWith('S0 PASS'), true); eq(r.out[1].startsWith('S1 PASS'), true); eq(r.out.some((l) => l.startsWith('S2 PASS')), true); eq(r.out.some((l) => l.startsWith('S3 PASS')), true);
  eq(r.out[r.out.length - 1].startsWith('S4 PASS cases=8 failed=0'), true);
  eq(r.out.filter((l) => / RESIDUE 0 PASS$/.test(l)).length, 8); eq(r.out.filter((l) => / CATALOG PASS /.test(l)).length, 8);
  const pc = r.calls.slice(r.calls.indexOf('probe:N1'));
  for (let i = 0; i < 8; i++) eq(pc.slice(i * 3, i * 3 + 3).join(','), `${pc[i * 3]},residue,capture`);
});
await t('JOB S1 refuses stock with storage policies (before any write)', async () => { const r = await runAll({ stockCapture: stockText({ policies: livePolicyLines }) }); eq(r.err, 'ST_E_STOCK_POLICIES'); eq(r.calls.includes('mirror'), false); });
await t('JOB S1 refuses a public course bucket (never overwritten)', async () => { const r = await runAll({ stockCapture: stockText({ bucketPublic: true }) }); eq(r.err, 'ST_E_BUCKET_PUBLIC'); eq(r.calls.includes('mirror'), false); });
await t('JOB S1 refuses a helper definition drift', async () => { const r = await runAll({ stockCapture: stockText({ helperDef: { has_role: 'f'.repeat(32) } }) }); eq(r.err, 'ST_E_HELPER'); });
await t('JOB S1 refuses a missing API grant dependency', async () => { const r = await runAll({ stockCapture: stockText().split('\n').filter((l) => l !== 'GRANT\tstorage.objects\tauthenticated\tINSERT').join('\n') }); eq(r.err, 'ST_E_GRANT_DEP'); });
await t('JOB S2 PRE guard re-verify failure refuses before S3', async () => { const r = await runAll({ guardFails: true }); eq(r.err, 'ST_PSQL_E_EXIT'); eq(r.calls.indexOf('mirror') < r.calls.indexOf('guard'), true); eq(r.out.some((l) => l.startsWith('S3')), false); });
await t('JOB S3 refuses a public identity change across the mirror', async () => { const r = await runAll({ idsChange: true }); eq(r.err, 'ST_E_S3_PUBLIC'); eq(r.out.some((l) => l === 'S3 public identities CHANGED FAIL'), true); });
await t('JOB order: S1 captures storage and public identities before the mirror; guard right after it', async () => { const r = await runAll(); eq(r.calls.slice(0, 6).join(','), 'capture,ids,capture,mirror,guard,capture'); });
await t('JOB S2 failure stops before S3', async () => { const r = await runAll({ mirrorFails: true }); eq(r.err, 'ST_PSQL_E_EXIT'); eq(r.out.some((l) => l.startsWith('S3')), false); });
await t('JOB S3 refuses an unrelated grant change during the mirror', async () => { const r = await runAll({ afterCapture: stockText({ policies: livePolicyLines, limitsFromLive: true, extraGrant: 'GRANT\tstorage.buckets\tanon\tINSERT' }) }); eq(r.err, 'ST_E_S3'); eq(r.out.some((l) => /^S3 FAIL .*grant_extra=1/.test(l)), true); });
await t('JOB S3 refuses limits left at stock values', async () => { const r = await runAll({ afterCapture: stockText({ policies: livePolicyLines }) }); eq(r.err, 'ST_E_S3'); });
await t('JOB S3 refuses a missing mirrored policy', async () => { const r = await runAll({ afterCapture: stockText({ policies: livePolicyLines.split('\n').slice(1).join('\n'), limitsFromLive: true }) }); eq(r.err, 'ST_E_S3'); });
await t('JOB S4 an unexpected probe exit is a FAIL line, residue and catalog still checked, run refused', async () => {
  const r = await runAll({ probe: { X3: 'EXIT' } });
  eq(r.err, 'ST_E_S4'); eq(r.out.some((l) => l.startsWith('S4 X3 NEW FAIL') && l.includes('UNPARSEABLE')), true);
  eq(r.out.some((l) => l === 'S4 X3 RESIDUE 0 PASS'), true);
});
await t('JOB S4 an unexpected ALLOW is a FAIL', async () => { const r = await runAll({ probe: { X1: ['insert=ALLOWED'] } }); eq(r.err, 'ST_E_S4'); });
await t('JOB S4 22P02 on the malformed path is a FAIL', async () => { const r = await runAll({ probe: { X6: ['insert=SQLSTATE_22P02'] } }); eq(r.err, 'ST_E_S4'); });
await t('JOB S4 OLD emulation that is NOT denied is a FAIL', async () => { const r = await runAll({ probe: { O1: ['insert=ALLOWED'] } }); eq(r.err, 'ST_E_S4'); });
await t('JOB S4 residue after a probe refuses immediately', async () => { const r = await runAll({ residue: 1 }); eq(r.err, 'ST_E_RESIDUE'); eq(r.calls.filter((c) => c.startsWith('probe:')).length, 1); });
await t('JOB S4 catalog change after a probe refuses immediately', async () => {
  let n = 0;
  const r = await runAll({ afterCapture: () => (++n > 2 ? stockText({ limitsFromLive: true }) : stockText({ policies: livePolicyLines, limitsFromLive: true })) });
  eq(r.err, 'ST_E_S4_CATALOG');
});
await t('JOB S3 without an S1 capture refuses (no stock file)', async () => { const r = await runAll({}, [['s3']]); eq(r.err === null, false); });
await t('JOB second S1 in the same private dir refuses (wx)', async () => { const r = await runAll({}, [['s1'], ['s1']]); eq(r.err === null, false); });
await t('JOB usage', async () => { const r = await runAll({}, [['s4', '1']]); eq(r.err, 'ST_E_USAGE'); });
await t('JOB output carries no policy names, expressions or limits', async () => {
  const r = await runAll(); const text = r.out.join('\n');
  for (const x of SYN_SECRET_STRINGS) eq(text.includes(x), false);
  for (const x of live.policies.values()) eq(text.includes(x.name), false);
  eq(/split_part|auth\.uid|(^|[^_])policies=/.test(text), false);
});

// Private dir and private child reads (qualified readHandle reused; parent validated first)
const s1Then = async (mut, steps = [['s3']]) => {
  const dir = priv(); const out = []; const psql = fakePsql();
  try {
    await main(['s0', dir], ENV_S0, (l) => out.push(l), psql, SYN_PINNED);
    await main(['s1', dir], ENV, (l) => out.push(l), psql, SYN_PINNED);
    const ctx = { dir };
    mut(ctx);
    for (const [cmd, ...rest] of steps) await main([cmd, ctx.arg ?? dir, ...rest], ENV, (l) => out.push(l), psql, SYN_PINNED);
    return { err: null, calls: psql.st.calls };
  } catch (e) { return { err: e.code, calls: psql.st.calls }; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); if (fs.existsSync(`${dir}-link`)) fs.rmSync(`${dir}-link`, { force: true }); }
};
const STOCKF = 'storage-s1-stock.tsv', IDSF = 'storage-s1-public-identities.txt';
await t('PRIV S1 writes both private files exact 0600', async () => { const dir = priv(); try { const ps1 = fakePsql(); await main(['s0', dir], ENV_S0, () => {}, ps1, SYN_PINNED); await main(['s1', dir], ENV, () => {}, ps1, SYN_PINNED); for (const f of [STOCKF, IDSF]) eq(fs.statSync(path.join(dir, f)).mode & 0o777, 0o600); } finally { fs.rmSync(dir, { recursive: true, force: true }); } });
await t('PRIV parent refused before any psql call: symlinked dir', async () => {
  const r = await s1Then((c) => { fs.symlinkSync(c.dir, `${c.dir}-link`); c.arg = `${c.dir}-link`; });
  eq(r.err, 'ST_E_PRIVATE_DIR'); eq(r.calls.length, 2);   // only S1's two reads happened
});
await t('PRIV parent refused: mode 0755', async () => { const r = await s1Then((c) => fs.chmodSync(c.dir, 0o755)); eq(r.err, 'ST_E_PRIVATE_DIR'); eq(r.calls.length, 2); });
await t('PRIV parent refused: missing dir', async () => { const r = await s1Then((c) => { c.arg = path.join(c.dir, 'absent'); }); eq(r.err, 'ST_E_PRIVATE_DIR'); });
await t('PRIV parent refused: a regular file in place of the dir', async () => { const r = await s1Then((c) => { c.arg = path.join(c.dir, STOCKF); }); eq(r.err, 'ST_E_PRIVATE_DIR'); });
for (const [f, label] of [[STOCKF, 'stock capture (S2/S3/S4)'], [IDSF, 'public identities (S3)']]) {
  await t(`PRIV child refused: symlink for ${label}`, async () => { const r = await s1Then((c) => { const p = path.join(c.dir, f); fs.renameSync(p, `${p}.real`); fs.symlinkSync(`${p}.real`, p); }); eq(r.err, 'ST_E_PRIVATE_OPEN'); });
  await t(`PRIV child refused: FIFO for ${label} (no hang)`, async () => { const r = await s1Then((c) => { const p = path.join(c.dir, f); fs.rmSync(p); execFileSync('mkfifo', ['-m', '600', p]); }); eq(r.err, 'ST_E_PRIVATE_TYPE'); });
  await t(`PRIV child refused: mode 0644 for ${label}`, async () => { const r = await s1Then((c) => fs.chmodSync(path.join(c.dir, f), 0o644)); eq(r.err, 'ST_E_PRIVATE_MODE'); });
  await t(`PRIV child refused: oversize for ${label}`, async () => { const r = await s1Then((c) => fs.appendFileSync(path.join(c.dir, f), 'x'.repeat(MAX_PRIVATE_READ + 1))); eq(r.err, 'ST_E_PRIVATE_SIZE'); });
  await t(`PRIV child refused: zero-length for ${label}`, async () => { const r = await s1Then((c) => fs.truncateSync(path.join(c.dir, f), 0)); eq(r.err, 'ST_E_PRIVATE_SIZE'); });
  await t(`PRIV child refused: missing for ${label}`, async () => { const r = await s1Then((c) => fs.rmSync(path.join(c.dir, f))); eq(r.err, 'ST_E_PRIVATE_OPEN'); });
}
await t('PRIV child reads are refused before the S3 capture (no psql call after the refusal)', async () => { const r = await s1Then((c) => fs.chmodSync(path.join(c.dir, STOCKF), 0o640)); eq(r.err, 'ST_E_PRIVATE_MODE'); eq(r.calls.length, 2); });
await t('PRIV helpers: assertPrivateDir returns the realpath; readPrivate reads a valid 0600 file', () => {
  const dir = priv(); try { fs.writeFileSync(path.join(dir, 'a.txt'), 'ok\n', { mode: 0o600 }); eq(assertPrivateDir(dir), fs.realpathSync(dir)); eq(readPrivate(dir, 'a.txt'), 'ok\n'); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

console.log(`job-selftest: ${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
