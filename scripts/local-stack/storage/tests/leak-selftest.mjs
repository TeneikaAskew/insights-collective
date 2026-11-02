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
import { topLevelClauses, candidates, filterPublic, scanTexts } from '../leak-scan.mjs';
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
const scan1 = (text, refs = []) => scanTexts(filterPublic(cands, refs), [{ rel: 'checks/x.txt', text }]);

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
t('PASS on clean fixed lines (digests, PASS/FAIL, codes)', () => eq(scan1(`S0 PASS input sha256 ${'a'.repeat(64)}\nS1 PASS stock_policies=0\n`).join('|'), 'LEAKSCAN PASS'));
t('P1 policy name, and its base64', () => { eq(scan1(`x ${pol.name} y`).join('|'), 'LEAKSCAN FAIL checks/x.txt P1'); eq(scan1(b64(pol.name)).join('|'), 'LEAKSCAN FAIL checks/x.txt P1'); });
t('P2 full expression, and its base64 (P3 clauses inside it also reported)', () => {
  eq(scan1(pol.check).includes('LEAKSCAN FAIL checks/x.txt P2'), true);
  eq(scan1(b64(pol.check)).join('|'), 'LEAKSCAN FAIL checks/x.txt P2');
});
t('P3 one top-level clause alone', () => eq(scan1("...(split_part(name, '/'::text, 1) = 'synthetic-dir'::text)...").join('|'), 'LEAKSCAN FAIL checks/x.txt P3'));
t('P4 MIME list, and its base64', () => { eq(scan1('application/pdf,text/x-synthetic').join('|'), 'LEAKSCAN FAIL checks/x.txt P4'); eq(scan1(b64('video/x-synthetic')).join('|'), 'LEAKSCAN FAIL checks/x.txt P4'); });
t('P5 limit as a standalone number', () => { eq(scan1('limit=1048577 bytes').join('|'), 'LEAKSCAN FAIL checks/x.txt P5'); eq(scan1('2097153').join('|'), 'LEAKSCAN FAIL checks/x.txt P5'); });
t('P5 boundary: no hit inside a longer number or a hex digest', () => { eq(scan1('110485770 a1048577 1048577f').join('|'), 'LEAKSCAN PASS'); });
t('PUBLIC tokens are dropped: a field already in the public tree cannot fail the scan', () => {
  eq(scan1(`x ${pol.name} y`, [`docs mention ${pol.name} already`]).join('|'), 'LEAKSCAN PASS');
  eq(scan1('limit 1048577', ['constant = 1048577;']).join('|'), 'LEAKSCAN PASS');
  eq(scan1('limit 1048577', ['hash a1048577b']).join('|'), 'LEAKSCAN FAIL checks/x.txt P5'); // not a standalone public number
});
t('OUTPUT never carries matched text; one line per field per file, sorted', () => {
  const lines = scanTexts(cands, [{ rel: 'a.txt', text: `${pol.name} 1048577` }, { rel: 'b.txt', text: 'ok' }, { rel: 'c', unscannable: true }]);
  eq(lines.join('|'), 'LEAKSCAN FAIL a.txt P1|LEAKSCAN FAIL a.txt P5|LEAKSCAN FAIL c UNSCANNABLE');
  for (const l of lines) eq(l.includes(pol.name) || l.includes('1048577'), false);
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
  const o = setup(); try { fs.writeFileSync(path.join(o.ev, 'checks', 's1.txt'), 'S1 PASS\n'); const r = cli(o); eq(r.status, 0); eq(r.stdout, 'LEAKSCAN PASS\n'); eq(r.stderr, ''); } finally { fs.rmSync(o.root, { recursive: true, force: true }); }
});
t('CLI FAIL: exit 1, path and field only', () => {
  const o = setup(); try { fs.writeFileSync(path.join(o.ev, 'checks', 's2.txt'), `oops ${pol.name}\n`); const r = cli(o); eq(r.status, 1); eq(r.stdout, 'LEAKSCAN FAIL checks/s2.txt P1\n'); eq(r.stdout.includes(pol.name), false); } finally { fs.rmSync(o.root, { recursive: true, force: true }); }
});
t('CLI symlink in the evidence dir is UNSCANNABLE (never followed)', () => {
  const o = setup(); try { fs.symlinkSync(path.join(o.priv, 'pins.tsv'), path.join(o.ev, 'checks', 'link')); const r = cli(o); eq(r.status, 1); eq(r.stdout, 'LEAKSCAN FAIL checks/link UNSCANNABLE\n'); } finally { fs.rmSync(o.root, { recursive: true, force: true }); }
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

console.log(`leak-selftest: ${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
