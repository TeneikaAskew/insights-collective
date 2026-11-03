#!/usr/bin/env node
// ABOUTME: Composition-tier fake selftest (needs the #162 gradebook modules): the builder shot decision agrees with shot-core's
// ABOUTME: decideShot on every branch, and a written shot round-trips through ba-shots.mjs export. No DB, no browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { decideShot, SHOT_PLAN as GB_PLAN } from '../../../e2e/gradebook-roles/journey/shot-core.mjs';
import { PAIRING_PREFIX, PAIRING_COURSE_ID } from '../../../e2e/gradebook-roles/journey/pairing-proof.mjs';
import { decideBaShot, writeBaShot } from '../shot-plan.mjs';
import { exportBaShots, diagWords } from '../ba-shots.mjs';
import { LINE } from '../summary.mjs';
import { REUSED_PINS } from '../codes.mjs';
import { createHash } from 'node:crypto';

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`ok ${n} ${name}`); };
const NONCE = 'a'.repeat(32);
const secrets = [{ label: 'NONCE', value: NONCE }, { label: 'PREFIX', value: PAIRING_PREFIX }, { label: 'CREDENTIAL', value: 'pw-one' }, { label: 'CREDENTIAL', value: 'pw-two' }, { label: 'CREDENTIAL', value: 'anon-key' }];
const APP = 'http://127.0.0.1:8080', API = 'http://127.0.0.1:54321';
const sample = (url, extra = {}) => ({ url, texts: ['body text', '<html></html>', '', 'title', url], images: [], surfaces: 0, ...extra });
const obsFor = (project, url, over = {}) => ({ project, expectedPath: new URL(url).pathname, expectedSearch: new URL(url).search, appOrigin: APP, apiOrigin: API,
  before: sample(url), after: sample(url), armed: 't', guard: { token: 't', n: 0 }, navigations: 0, incomplete: false, ...over });
const VARIANTS = {
  clean: {}, incomplete: { incomplete: true }, persona: { project: 'other' }, mutated: { guard: { token: 't', n: 2 } },
  navigated: { navigations: 1 }, token: { guard: { token: null, n: 0 } }, surface: { before: null },
  dirty: { texts: true }, changed: { after: 'changed' }, offorigin: { images: true },
};
const apply = (o, k) => {
  const v = VARIANTS[k];
  if (k === 'surface') return { ...o, before: { ...o.before, surfaces: 1 } };
  if (k === 'dirty') return { ...o, before: { ...o.before, texts: [...o.before.texts, `x ${NONCE}`] } };
  if (k === 'changed') return { ...o, after: { ...o.after, texts: ['other', ...o.after.texts.slice(1)] } };
  if (k === 'offorigin') return { ...o, before: { ...o.before, images: ['https://i.pravatar.cc/1'] } };
  if (k === 'persona') return { ...o, project: 'someone-else' };
  return { ...o, ...v };
};

ok('the builder decision equals shot-core decideShot on every branch (same observation, routes without a query)', () => {
  const gbName = 'J1-builder-draft', gbProject = GB_PLAN[gbName][0];
  for (const k of Object.keys(VARIANTS)) {
    const gb = decideShot(gbName, apply(obsFor(gbProject, `${APP}/x/builder`), k), secrets);
    const ba = decideBaShot('ba_r1_1440', apply(obsFor('ba-1440', `${APP}/x/builder`), k), secrets);
    assert.deepEqual(ba, gb, k);
  }
});
ok('the one difference: the plan\'s exact query is required, any other query is ROUTE', () => {
  const url = `${APP}/courses/c/builder?view=curriculum`;
  assert.deepEqual(decideBaShot('ba_r1_1440', obsFor('ba-1440', url), secrets), { write: true });
  const o = obsFor('ba-1440', url); o.before = sample(`${APP}/courses/c/builder?view=setup`);
  assert.deepEqual(decideBaShot('ba_r1_1440', o, secrets), { write: false, reason: 'ROUTE' });
  assert.throws(() => decideBaShot('J1-builder-draft', o, secrets));
});

// A real 2x1 RGB PNG plus an ancillary tEXt chunk carrying the nonce (the export must drop it).
const crcTable = Array.from({ length: 256 }, (_, k) => { let c = k; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('tEXt', Buffer.from(`k\0${NONCE}`)),
  chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 0, 0, 0, 255, 0]))), chunk('IEND', Buffer.alloc(0))]);

ok('write then export: one PNG (ancillary chunk dropped), one withheld with diag words, the rest NOT_TAKEN; lines in the grammar', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-shot-'));
  const mk = (d) => { fs.mkdirSync(path.join(root, d), { mode: 0o700 }); return path.join(root, d); };
  const shots = mk('shots'), session = mk('session'), proofDir = mk('proof');
  const proof = path.join(proofDir, 'pairing-proof.json');
  fs.writeFileSync(proof, JSON.stringify({ version: 2, stack_id: NONCE, control_course_id: PAIRING_COURSE_ID, db_read: PAIRING_PREFIX + NONCE, api_read: PAIRING_PREFIX + NONCE, journey_rows_before_pairing: 0 }), { mode: 0o600 });
  const url = `${APP}/courses/c/builder?view=curriculum`;
  assert.equal(writeBaShot(shots, 'ba_r1_1440', PNG, obsFor('ba-1440', url), secrets).written, 'png');
  const m = obsFor('ba-768', url, { guard: { token: 't', n: 1, phases: [[0, 1, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]] }, marks: 3 });
  assert.deepEqual(writeBaShot(shots, 'ba_r1_768', PNG, m, secrets), { written: 'withheld', reason: 'MUTATED' });
  const lines = exportBaShots({ shotDir: shots, sessionDir: session, proofFile: proof, exportDir: path.join(root, 'export') });
  assert.match(lines[0], /^SHOT name=ba_r1_1440 sha256=[0-9a-f]{64} bytes=\d+ width=2 height=1$/);
  assert.equal(lines[1], 'WITHHELD name=ba_r1_768 reason=MUTATED before=0.1.0.0.0.0.0.0.0.0 shot=0.0.0.0.0.0.0.0.0.0 after=0.0.0.0.0.0.0.0.0.0 final=0.0.0.0.0.0.0.0.0.0 marks=3 sum=EQ');
  assert.equal(lines.filter((l) => l.startsWith('NOT_TAKEN')).length, 8);
  assert.equal(lines.at(-1), 'SHOTS captured=1 withheld=1 not_taken=8 planned=10');
  assert.ok(lines.every((l) => LINE.test(l)));
  const out = fs.readFileSync(path.join(root, 'export', 'ba_r1_1440.png'));
  assert.ok(!out.includes(Buffer.from(NONCE)) && !out.includes(Buffer.from('tEXt')));
  assert.equal(diagWords('NA'), 'diag=NA');
  fs.rmSync(root, { recursive: true });
});
ok('export refuses an unknown file in the shot dir', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-shot-'));
  const shots = path.join(root, 'shots'); fs.mkdirSync(shots, { mode: 0o700 });
  fs.writeFileSync(path.join(shots, 'J1-builder-draft.png'), PNG, { mode: 0o600 });
  assert.throws(() => exportBaShots({ shotDir: shots, sessionDir: root, proofFile: path.join(root, 'none.json'), exportDir: path.join(root, 'e') }), /BA_SHOT_E_(PROOF|UNKNOWN_FILE)/);
  fs.rmSync(root, { recursive: true });
});
ok('every reused capture/export/private/observe/pairing/binding module equals its REUSED_PINS blob (composition tier)', () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
  assert.equal(Object.keys(REUSED_PINS).length, 9);
  for (const [rel, want] of Object.entries(REUSED_PINS)) {
    const b = fs.readFileSync(path.join(root, rel));
    assert.equal(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'), want, rel);
  }
});
console.log(`PASS builder-authoring shot selftest (${n} checks)`);
