#!/usr/bin/env node
// ABOUTME: Controls for own-root.mjs (used by pairing-cli-controls): fresh 0700 root, exact-root removal on pass and failure,
// ABOUTME: primary failure kept when cleanup fails, identity guard refuses a swapped root. Synthetic only; never touches pca-cli-*.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withOwnRoot, removeExactRoot } from './own-root.mjs';

const P = 'pca-ownroot-ctl-';
let n = 0;
const ok = async (name, fn) => { await fn(); n += 1; console.log(`ok ${n} ${name}`); };
const gone = (d) => assert.equal(fs.existsSync(d), false, `removed: ${path.basename(d)}`);
const capture = () => { const lines = []; return { lines, onSecondary: (l) => lines.push(l) }; };

await ok('pass: fn gets a fresh 0700 root under the prefix, its value is returned, the root is removed', async () => {
  let seen;
  const v = await withOwnRoot(P, async (d) => { seen = d; assert.equal(fs.statSync(d).mode & 0o777, 0o700); assert.ok(path.basename(d).startsWith(P)); fs.writeFileSync(path.join(d, 'f'), 'x'); return 7; });
  assert.equal(v, 7); gone(seen);
});
await ok('failure: the SAME error is rethrown and the root is removed', async () => {
  let seen, thrown; const e = new Error('INJECTED');
  try { await withOwnRoot(P, async (d) => { seen = d; fs.mkdirSync(path.join(d, 'sub')); throw e; }); } catch (x) { thrown = x; }
  assert.equal(thrown, e); assert.equal(thrown.cleanupError, undefined); gone(seen);
});
await ok('failure AND cleanup failure: the primary is rethrown unchanged; the cleanup error is only secondary', async () => {
  let seen, thrown; const e = new Error('INJECTED'); const c = Object.assign(new Error('rm'), { code: 'EBUSY' }); const cap = capture();
  try { await withOwnRoot(P, async (d) => { seen = d; throw e; }, { remove: () => { throw c; }, onSecondary: cap.onSecondary }); } catch (x) { thrown = x; }
  try {
    assert.equal(thrown, e); assert.equal(thrown.message, 'INJECTED'); assert.equal(thrown.cleanupError, c);
    assert.deepEqual(cap.lines, [`CLEANUP_SECONDARY root=${path.basename(seen)} code=EBUSY`]);
  } finally { fs.rmSync(seen, { recursive: true, force: true }); }
  gone(seen);
});
await ok('pass but cleanup failure: the cleanup error is thrown, not swallowed', async () => {
  let seen; const c = new Error('rm');
  try { await assert.rejects(withOwnRoot(P, async (d) => { seen = d; }, { remove: () => { throw c; } }), (x) => x === c); }
  finally { fs.rmSync(seen, { recursive: true, force: true }); }
  gone(seen);
});
await ok('identity guard: a root swapped for a symlink is refused (OWN_ROOT_E_IDENTITY) and its target is untouched', async () => {
  await withOwnRoot(P, async (outer) => {
    let link, thrown;
    try {
      try {
        await withOwnRoot(P, async (d) => {
          link = d;
          fs.renameSync(d, path.join(outer, 'moved'));            // the real root now lives inside the outer own root
          fs.mkdirSync(path.join(outer, 'target')); fs.writeFileSync(path.join(outer, 'target', 'keep'), 'k');
          fs.symlinkSync(path.join(outer, 'target'), d);          // a symlink now sits at the recorded root path
        });
      } catch (x) { thrown = x; }
      assert.equal(thrown && thrown.code, 'OWN_ROOT_E_IDENTITY', 'a passing fn surfaces the refused cleanup');
      assert.equal(fs.readFileSync(path.join(outer, 'target', 'keep'), 'utf8'), 'k', 'the symlink target was not removed or traversed');
      assert.ok(fs.lstatSync(link).isSymbolicLink());
    } finally { if (link) fs.rmSync(link, { force: true }); }   // unlink only the symlink this control made
  });
});
await ok('identity guard: a different directory at the recorded path is refused; an already-absent root is fine', async () => {
  await withOwnRoot(P, async (outer) => {
    const d = path.join(outer, 'r'); fs.mkdirSync(d); const s = fs.lstatSync(d);
    fs.rmdirSync(d); fs.mkdirSync(d);
    const s2 = fs.lstatSync(d);
    if (s2.ino !== s.ino) assert.throws(() => removeExactRoot(d, { dev: s.dev, ino: s.ino }), (x) => x.code === 'OWN_ROOT_E_IDENTITY');
    assert.ok(fs.existsSync(d), 'not removed');
    removeExactRoot(path.join(outer, 'absent'), { dev: s.dev, ino: s.ino });
  });
});
await ok('the prefix is validated, and the pca-cli- prefix is the only one pairing-cli-controls uses', async () => {
  await assert.rejects(withOwnRoot('../x-', async () => {}), /OWN_ROOT_E_PREFIX/);
  await assert.rejects(withOwnRoot('', async () => {}), /OWN_ROOT_E_PREFIX/);
  const src = fs.readFileSync(new URL('./pairing-cli-controls.mjs', import.meta.url), 'utf8');
  assert.equal((src.match(/mkdtemp[S]ync\(/g) || []).length, 0, 'no unmanaged mkdtemp left in pairing-cli-controls');
  assert.equal((src.match(/withOwnRoot\('pca-cli-'/g) || []).length, 1, 'exactly one own root, prefix pca-cli-');
  assert.doesNotMatch(src, /rmSync\(T\b|readdirSync\(tmpdir|pca-cli-\*/, 'no removal of T outside the helper and no scan of tmpdir');
});
console.log(`PASS own-root controls (${n} checks)`);
