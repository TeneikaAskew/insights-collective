#!/usr/bin/env node
// ABOUTME: Synthetic selftest for leak-scan.mjs: each field P1..P5 is caught, public-tree tokens are dropped, number
// ABOUTME: boundaries hold, output lines are fixed and never carry the matched text. No real policy text is used.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as S from '../storage-core.mjs';
import { topLevelClauses, candidates, filterPublic, verdictLines, readBounded, collect, MAX_SCAN_FILE } from '../leak-scan.mjs';
import { convert } from '../live-pins.mjs';
import { s0, assertPrivateDir, INPUT_ENV } from '../storage-job.mjs';
import { synInput } from './synthetic-input.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCAN = path.join(HERE, '..', 'leak-scan.mjs');
let ok = 0, bad = 0;
const t = (name, fn) => { try { fn(); ok++; console.log(`ok ${name}`); } catch (e) { bad++; console.log(`FAILED ${name}: ${e && (e.code || e.message)}`); } };
const eq = (a, b) => { if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const SYN = synInput();
const pinsText = convert(Buffer.from(SYN.raw), { expectSha: SYN.sourceSha, expectBytes: SYN.sourceBytes }).text;
const pins = S.parsePins(pinsText);
const PINNED = { sourceSha: SYN.sourceSha, sourceBytes: SYN.sourceBytes, pinsSha: sha(pinsText), mirrorSha: sha(S.generateMirror(pins).sql) };
const pol = [...pins.policies.values()].find((x) => x.name === 'syn_submission_insert_rule');
const cands = candidates(pins);
const scan1 = (text, refs = []) => verdictLines(filterPublic(cands, refs), [text]);

t('CLAUSES split at top-level AND only (quotes and parentheses respected), outer parens stripped', () => {
  eq(JSON.stringify(topLevelClauses("((a = 'x AND y'::text) AND (f(b AND c)) AND d)")), JSON.stringify(["(a = 'x AND y'::text)", '(f(b AND c))', 'd']));
  eq(JSON.stringify(topLevelClauses('(a) OR (b AND c)')), JSON.stringify(['(a) OR (b AND c)']));
});
t('CANDIDATES cover P1..P5 from the pins (names >= 12 bytes, exprs, clauses >= 24 bytes, MIME lists, limits)', () => {
  const f = new Set(cands.map((c) => c.field));
  eq([...f].sort().join(','), 'P1,P2,P3,P4,P5');
  eq(cands.some((c) => c.field === 'P5' && c.text === '1048577' && c.numeric), true);
  eq(cands.every((c) => c.field !== 'P3' || Buffer.byteLength(c.text) >= 24), true);
});
t('PASS on clean fixed lines (digests, PASS/FAIL, codes)', () => eq(scan1(`S0 PASS input sha256 ${'a'.repeat(64)}\nS1 PASS stock_policies=0\n`).join('|'), 'LEAKSCAN PASS files=1'));
t('P1 policy name, and its base64', () => { eq(scan1(`x ${pol.name} y`).join('|'), 'LEAKSCAN FAIL P1 files=1'); eq(scan1(b64(pol.name)).join('|'), 'LEAKSCAN FAIL P1 files=1'); });
t('P2 full expression, and its base64 (P3 clauses inside it also reported)', () => {
  eq(scan1(pol.check).includes('LEAKSCAN FAIL P2 files=1'), true);
  eq(scan1(b64(pol.check)).join('|'), 'LEAKSCAN FAIL P2 files=1');
});
t('P3 one top-level clause alone', () => eq(scan1("...(split_part(name, '/'::text, 1) = 'synthetic-dir'::text)...").join('|'), 'LEAKSCAN FAIL P3 files=1'));
t('P4 MIME list, and its base64', () => { eq(scan1('application/pdf,text/x-synthetic').join('|'), 'LEAKSCAN FAIL P4 files=1'); eq(scan1(b64('video/x-synthetic')).join('|'), 'LEAKSCAN FAIL P4 files=1'); });
t('P5 limit as a standalone number', () => { eq(scan1('limit=1048577 bytes').join('|'), 'LEAKSCAN FAIL P5 files=1'); eq(scan1('2097153').join('|'), 'LEAKSCAN FAIL P5 files=1'); });
t('P5 boundary: no hit inside a longer number or a hex digest', () => { eq(scan1('110485770 a1048577 1048577f').join('|'), 'LEAKSCAN PASS files=1'); });
t('PUBLIC tokens are dropped: a field already in the public tree cannot fail the scan', () => {
  eq(scan1(`x ${pol.name} y`, [`docs mention ${pol.name} already`]).join('|'), 'LEAKSCAN PASS files=1');
  eq(scan1('limit 1048577', ['constant = 1048577;']).join('|'), 'LEAKSCAN PASS files=1');
  eq(scan1('limit 1048577', ['hash a1048577b']).join('|'), 'LEAKSCAN FAIL P5 files=1'); // not a standalone public number
});
t('OUTPUT is fixed categories only: per-field file counts and entry-category counts; no name or matched text', () => {
  const lines = verdictLines(cands, [`${pol.name} 1048577`, 'ok', pol.name], new Map([['SYMLINK', 2], ['NAME', 1]]));
  eq(lines.join('|'), 'LEAKSCAN FAIL P1 files=2|LEAKSCAN FAIL P5 files=1|LEAKSCAN FAIL SYMLINK entries=2|LEAKSCAN FAIL NAME entries=1');
  for (const l of lines) eq(/^LEAKSCAN FAIL (P[1-5] files|[A-Z_]+ entries)=\d+$/.test(l), true);
});

// CLI, end to end on a synthetic private dir (s0 with synthetic digests writes the pins)
const setup = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leak-')); const priv = path.join(root, 'priv'); const ev = path.join(root, 'ev');
  fs.mkdirSync(priv, { mode: 0o700 }); fs.chmodSync(priv, 0o700); fs.mkdirSync(path.join(ev, 'checks'), { recursive: true });
  s0(assertPrivateDir(priv), { [INPUT_ENV]: SYN.raw }, PINNED);
  fs.writeFileSync(path.join(root, 'ref.txt'), 'public reference text\n');
  fs.writeFileSync(path.join(root, 'refs.lst'), 'ref.txt\0absent.txt\0');
  return { root, priv, ev };
};
const cli = (o) => spawnSync(process.execPath, [SCAN, o.priv, 'refs.lst', o.ev], { cwd: o.root, encoding: 'utf8' });
t('CLI PASS: exit 0, exactly one fixed line', () => {
  const o = setup(); try { fs.writeFileSync(path.join(o.ev, 'checks', 's1.txt'), 'S1 PASS\n'); const r = cli(o); eq(r.status, 0); eq(r.stdout, 'LEAKSCAN PASS files=1\n'); eq(r.stderr, ''); } finally { fs.rmSync(o.root, { recursive: true, force: true }); }
});
t('CLI FAIL: exit 1, field and count only (no file name)', () => {
  const o = setup(); try { fs.writeFileSync(path.join(o.ev, 'checks', 's2.txt'), `oops ${pol.name}\n`); const r = cli(o); eq(r.status, 1); eq(r.stdout, 'LEAKSCAN FAIL P1 files=1\n'); eq(r.stdout.includes(pol.name), false); } finally { fs.rmSync(o.root, { recursive: true, force: true }); }
});
t('CLI symlink in the evidence dir is SYMLINK (never followed, never named)', () => {
  const o = setup(); try { fs.symlinkSync(path.join(o.priv, 'pins.tsv'), path.join(o.ev, 'checks', 'link')); const r = cli(o); eq(r.status, 1); eq(r.stdout, 'LEAKSCAN FAIL SYMLINK entries=1\n'); } finally { fs.rmSync(o.root, { recursive: true, force: true }); }
});
t('CLI refuses (exit 3) without private pins: fail closed, nothing scanned', () => {
  const o = setup(); try { fs.rmSync(path.join(o.priv, 'pins.tsv')); const r = cli(o); eq(r.status, 3); eq(r.stdout, ''); eq(r.stderr, 'leak-scan refused: ST_E_PRIVATE_OPEN\n'); } finally { fs.rmSync(o.root, { recursive: true, force: true }); }
});
t('CLI refuses (exit 3) a 0755 private dir', () => {
  const o = setup(); try { fs.chmodSync(o.priv, 0o755); const r = cli(o); eq(r.status, 3); eq(r.stderr, 'leak-scan refused: ST_E_PRIVATE_DIR\n'); } finally { fs.rmSync(o.root, { recursive: true, force: true }); }
});
t('CLI refuses (exit 3) when no reference file can be read', () => {
  const o = setup(); try { fs.writeFileSync(path.join(o.root, 'refs.lst'), 'absent.txt\0'); const r = cli(o); eq(r.status, 3); eq(r.stderr, 'leak-scan refused: ST_E_LEAKSCAN_REFS\n'); } finally { fs.rmSync(o.root, { recursive: true, force: true }); }
});
t('CLI usage', () => { const r = spawnSync(process.execPath, [SCAN, 'a'], { encoding: 'utf8' }); eq(r.status, 3); eq(r.stderr, 'leak-scan refused: ST_E_USAGE\n'); });


// Safe reads and directory handling (deterministic special-file, race, oversize, hostile-name and outside-root controls)
const evDir = () => { const r = fs.mkdtempSync(path.join(os.tmpdir(), 'leak-ev-')); return { r, real: fs.realpathSync(r) }; };
const cl = (r) => { const out = collect(r); return verdictLines(cands, out.texts, out.cats).join('|'); };
const withEv = (fn) => { const e = evDir(); try { return fn(e); } finally { fs.rmSync(e.r, { recursive: true, force: true }); } };
t('SAFE FIFO in the evidence dir: SPECIAL, never opened (no hang)', () => withEv((e) => { spawnSync('mkfifo', [path.join(e.r, 'pipe')]); eq(cl(e.r), 'LEAKSCAN FAIL SPECIAL entries=1'); }));
t('SAFE symlinked sub-directory: SYMLINK, not followed (its secret target is not read)', () => withEv((e) => {
  const o = fs.mkdtempSync(path.join(os.tmpdir(), 'leak-out-')); fs.writeFileSync(path.join(o, 'x.txt'), pol.name);
  try { fs.symlinkSync(o, path.join(e.r, 'd')); eq(cl(e.r), 'LEAKSCAN FAIL SYMLINK entries=1'); } finally { fs.rmSync(o, { recursive: true, force: true }); }
}));
t('SAFE file symlink pointing outside the root: SYMLINK', () => withEv((e) => { fs.symlinkSync('/etc/hostname', path.join(e.r, 'l.txt')); eq(cl(e.r), 'LEAKSCAN FAIL SYMLINK entries=1'); }));
t('SAFE oversize (sparse file one byte over the bound): OVERSIZE, not read', () => withEv((e) => { const p = path.join(e.r, 'big.bin'); fs.writeFileSync(p, ''); fs.truncateSync(p, MAX_SCAN_FILE + 1); eq(cl(e.r), 'LEAKSCAN FAIL OVERSIZE entries=1'); }));
t('SAFE hostile names (newline, leading dash, space, leading dot, non-ASCII): NAME, never opened or printed', () => withEv((e) => {
  for (const n of ['a\nb.txt', '-rf', 'a b.txt', '.hidden', 'café.txt']) fs.writeFileSync(path.join(e.r, n), pol.name);
  const v = cl(e.r); eq(v, 'LEAKSCAN FAIL NAME entries=5'); eq(v.includes('\n') || v.includes(pol.name), false);
}));
t('SAFE empty receipt is allowed (staging owns emptiness)', () => withEv((e) => { fs.writeFileSync(path.join(e.r, 'empty.txt'), ''); eq(cl(e.r), 'LEAKSCAN PASS files=1'); }));
t('SAFE nesting deeper than the bound: LIMIT', () => withEv((e) => { let p = e.r; for (let i = 0; i < 18; i++) { p = path.join(p, 'd'); fs.mkdirSync(p); } eq(cl(e.r), 'LEAKSCAN FAIL LIMIT entries=1'); }));
t('SAFE nested clean and leaking files counted per field', () => withEv((e) => { fs.mkdirSync(path.join(e.r, 'a')); fs.writeFileSync(path.join(e.r, 'a', 'x.txt'), pol.name); fs.writeFileSync(path.join(e.r, 'y.txt'), 'ok'); eq(cl(e.r), 'LEAKSCAN FAIL P1 files=1'); }));
// Races on the one descriptor (io stubs over the real fs; each injects exactly one change between check and use)
const stub = (over) => ({ ...fs, ...over });
const rb = (e, opts) => { const p = path.join(e.r, 'f.txt'); fs.writeFileSync(p, 'hello'); return readBounded(p, 1024, e.real, opts); };
t('RACE regular file swapped for a FIFO after the directory listing: SPECIAL on the same descriptor', () => withEv((e) => eq(rb(e, { io: stub({ fstatSync: (fd) => ({ ...fs.fstatSync(fd), isFile: () => false }) }) }).cat, 'SPECIAL')));
t('RACE file grows during the read: RACE', () => withEv((e) => { let k = 0; eq(rb(e, { io: stub({ readSync: (fd, b, o, l, p) => (k++ === 0 ? (b.fill(65, o, o + 6), 6) : 0) }) }).cat, 'RACE'); }));
t('RACE file shrinks during the read: RACE', () => withEv((e) => { eq(rb(e, { io: stub({ readSync: () => 0 }) }).cat, 'RACE'); }));
t('RACE swapped for a link at open: SYMLINK (ELOOP)', () => withEv((e) => { eq(rb(e, { io: stub({ openSync: () => { const x = new Error('l'); x.code = 'ELOOP'; throw x; } }) }).cat, 'SYMLINK'); }));
t('OUTSIDE descriptor resolves outside the root (parent swapped): OUTSIDE_ROOT, not read', () => withEv((e) => { let read = false; eq(rb(e, { fdPath: () => '/etc/passwd', io: stub({ readSync: (...a) => { read = true; return fs.readSync(...a); } }) }).cat, 'OUTSIDE_ROOT'); eq(read, false); }));
t('OUTSIDE descriptor path unverifiable: OUTSIDE_ROOT (fail closed)', () => withEv((e) => eq(rb(e, { fdPath: () => { throw new Error('no proc'); } }).cat, 'OUTSIDE_ROOT')));
t('OUTSIDE root prefix is not a sibling with the same prefix', () => withEv((e) => eq(rb(e, { fdPath: () => `${e.real}x/f.txt` }).cat, 'OUTSIDE_ROOT')));
t('OWNER another uid: UNREADABLE', () => withEv((e) => eq(rb(e, { uid: (process.getuid?.() ?? 0) + 1 }).cat, 'UNREADABLE')));
t('READ control: a regular file inside the root reads exactly', () => withEv((e) => eq(rb(e, {}).buf.toString(), 'hello')));
// Reference list hardening
const refCli = (o, list) => { fs.writeFileSync(path.join(o.root, 'refs.lst'), list); return cli(o); };
t('REFS a ".." path refuses the run', () => { const o = setup(); try { const r = refCli(o, 'ref.txt\0../x\0'); eq(r.status, 3); eq(r.stderr, 'leak-scan refused: ST_E_LEAKSCAN_REFS\n'); } finally { fs.rmSync(o.root, { recursive: true, force: true }); } });
t('REFS an absolute path refuses the run', () => { const o = setup(); try { const r = refCli(o, 'ref.txt\0/etc/hostname\0'); eq(r.status, 3); } finally { fs.rmSync(o.root, { recursive: true, force: true }); } });
t('REFS a symlinked reference is skipped, so it cannot whitelist a field (stricter)', () => {
  const o = setup();
  try { fs.writeFileSync(path.join(o.root, 'real-ref.txt'), pol.name); fs.symlinkSync('real-ref.txt', path.join(o.root, 'ln.txt'));
    fs.writeFileSync(path.join(o.ev, 'checks', 'a.txt'), pol.name); const r = refCli(o, 'ref.txt\0ln.txt\0'); eq(r.status, 1); eq(r.stdout, 'LEAKSCAN FAIL P1 files=1\n');
  } finally { fs.rmSync(o.root, { recursive: true, force: true }); }
});
t('REFS a symlinked list file refuses the run', () => { const o = setup(); try { fs.renameSync(path.join(o.root, 'refs.lst'), path.join(o.root, 'r2.lst')); fs.symlinkSync('r2.lst', path.join(o.root, 'refs.lst')); const r = cli(o); eq(r.status, 3); eq(r.stderr, 'leak-scan refused: ST_E_LEAKSCAN_REFS\n'); } finally { fs.rmSync(o.root, { recursive: true, force: true }); } });
t('EVIDENCE root that is a symlink refuses the run', () => { const o = setup(); try { fs.renameSync(o.ev, `${o.ev}-real`); fs.symlinkSync(`${o.ev}-real`, o.ev); const r = cli(o); eq(r.status, 3); eq(r.stderr, 'leak-scan refused: ST_E_LEAKSCAN_EVIDENCE\n'); } finally { fs.rmSync(o.root, { recursive: true, force: true }); } });

console.log(`leak-selftest: ${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
