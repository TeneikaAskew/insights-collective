#!/usr/bin/env node
// ABOUTME: Pure in-process fake selftest for the builder-authoring manifest and cleanup plan. No DB, no network.
import assert from 'node:assert/strict';
import { buildManifest, cleanupSql, ManifestError } from '../manifest.mjs';
import { A, B, SEEDED_MODULES, SEEDED_ITEMS } from '../ids.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`ok ${n} ${name}`); };
const code = (fn) => { try { fn(); } catch (e) { return e instanceof ManifestError ? e.code : `OTHER:${e.message}`; } return 'NO_THROW'; };
const created = 'aaaaaaaa-1111-4222-8333-444444444444';

ok('manifest refuses a bad nonce', () => assert.equal(code(() => buildManifest({ nonce: 'X Y', createdCourseIds: [] })), 'BA_MANIFEST_E_NONCE'));
ok('manifest refuses a non-uuid created id', () => assert.equal(code(() => buildManifest({ nonce: 'run12345', createdCourseIds: ['nope'] })), 'BA_MANIFEST_E_ID'));
ok('manifest refuses a seeded id reported as created', () => assert.equal(code(() => buildManifest({ nonce: 'run12345', createdCourseIds: [A.course] })), 'BA_MANIFEST_E_SEEDED_AS_CREATED'));
ok('manifest refuses duplicates and more than 4', () => {
  assert.equal(code(() => buildManifest({ nonce: 'run12345', createdCourseIds: [created, created] })), 'BA_MANIFEST_E_DUPLICATE');
  const five = [1, 2, 3, 4, 5].map((i) => `aaaaaaaa-1111-4222-8333-44444444444${i}`);
  assert.equal(code(() => buildManifest({ nonce: 'run12345', createdCourseIds: five })), 'BA_MANIFEST_E_TOO_MANY');
});

const sql = cleanupSql(buildManifest({ nonce: 'run12345', createdCourseIds: [created] }));
ok('every delete is scoped to exactly the manifest courses', () => {
  const deletes = sql.split('\n').filter((l) => /^delete /.test(l));
  assert.equal(deletes.length, 5);
  for (const d of deletes) {
    assert.match(d, /'9b6e0000-0000-4000-8000-000000000001', '9b6e0000-0000-4000-8000-000000000002', 'aaaaaaaa-1111-4222-8333-444444444444'\)/);
    assert.doesNotMatch(d, /like|ilike|true|1=1|not in/i);
  }
});
ok('ownership is proven before the first delete, inside the same transaction', () => {
  const firstDelete = sql.indexOf('\ndelete ');
  for (const c of ['BA_CLEANUP_E_SEEDED_OWNERSHIP', 'BA_CLEANUP_E_CREATED_OWNERSHIP', 'BA_CLEANUP_E_MODULE_MOVED', 'BA_CLEANUP_E_ITEM_MOVED']) {
    const at = sql.indexOf(c);
    assert.ok(at > 0 && at < firstDelete, c);
  }
  assert.ok(sql.indexOf('begin;') < sql.indexOf('do $$') && sql.trim().endsWith('commit;'));
  assert.match(sql, /title = 'BA Wizard Course run12345'/);
});
ok('seed.sql creates exactly the ids.mjs rows and nothing else', () => {
  const seed = fs.readFileSync(path.join(here, '..', 'seed.sql'), 'utf8');
  const ids = [...seed.matchAll(/\('(9b6e[0-9a-f-]{32})'/g)].map((m) => m[1]).sort();
  const expected = [A.course, B.course, ...SEEDED_MODULES, ...SEEDED_ITEMS].sort();
  assert.deepEqual(ids, expected);
  const code = seed.split('\n').filter((l) => !l.startsWith('--')).join('\n');
  assert.doesNotMatch(code, /on conflict|delete |update |truncate/i);
});
console.log(`PASS builder-authoring fixture selftest (${n} checks)`);
