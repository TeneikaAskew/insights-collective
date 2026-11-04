// ABOUTME: Pure fake controls for the quiz lifecycle evidence root (CodeQL js/insecure-temporary-file, session.fixture.ts:121):
// ABOUTME: the job's QLC_EVIDENCE_DIR is used unchanged; unset, the root is one private mkdtemp directory, never a fixed tmp path.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVIDENCE_PREFIX, evidenceRootResolver } from '../../../e2e/quiz-lifecycle/evidence-root';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function fakes(env: Record<string, string | undefined>) {
  const calls = { tmpdir: 0, mkdtemp: [] as string[] };
  let n = 0;
  const deps = {
    env,
    tmpdir: () => { calls.tmpdir += 1; return '/fake-tmp'; },
    mkdtemp: (prefix: string) => { calls.mkdtemp.push(prefix); n += 1; return `${prefix}R${n}`; },
  };
  return { deps, calls };
}

describe('quiz lifecycle evidence root', () => {
  it('uses the job directory unchanged and creates nothing when QLC_EVIDENCE_DIR is set', () => {
    const { deps, calls } = fakes({ QLC_EVIDENCE_DIR: '/runner/temp/qlc' });
    const root = evidenceRootResolver(deps);
    expect(root()).toBe('/runner/temp/qlc');
    expect(root()).toBe('/runner/temp/qlc');
    expect(calls).toEqual({ tmpdir: 0, mkdtemp: [] });
  });

  it('is lazy: building the resolver touches nothing', () => {
    const { deps, calls } = fakes({});
    evidenceRootResolver(deps);
    expect(calls).toEqual({ tmpdir: 0, mkdtemp: [] });
  });

  it('unset or empty: exactly one mkdtemp from the tmp prefix, memoized for the process', () => {
    for (const env of [{}, { QLC_EVIDENCE_DIR: '' }]) {
      const { deps, calls } = fakes(env);
      const root = evidenceRootResolver(deps);
      const first = root();
      expect(root()).toBe(first);
      expect(calls.mkdtemp).toEqual([path.join('/fake-tmp', EVIDENCE_PREFIX)]);
      expect(first).not.toBe(path.join('/fake-tmp', 'qlc-evidence'));
    }
  });

  it('causal control: the old fallback is one fixed shared path for every process; the new one is per process', () => {
    const oldFallback = (env: Record<string, string | undefined>, tmp: string) => env.QLC_EVIDENCE_DIR || path.join(tmp, 'qlc-evidence');
    expect(oldFallback({}, '/fake-tmp')).toBe(oldFallback({}, '/fake-tmp'));
    expect(oldFallback({}, '/fake-tmp')).toBe('/fake-tmp/qlc-evidence');
    const a = fakes({}); const b = fakes({});
    // Two processes, each with its own mkdtemp (the fake numbers per process; the real one is unpredictable).
    const ra = evidenceRootResolver(a.deps)(); const rb = evidenceRootResolver({ ...b.deps, mkdtemp: (p) => `${p}S1` })();
    expect(ra).not.toBe(rb);
    expect(ra).not.toBe(oldFallback({}, '/fake-tmp'));
  });

  it('source: session.fixture.ts takes every evidence path from the resolver and has no fixed tmp fallback', () => {
    const src = read('e2e/quiz-lifecycle/session.fixture.ts');
    expect(src).not.toMatch(/os\.tmpdir\(\)/);
    expect(src).not.toMatch(/'qlc-evidence'/);
    expect(src).not.toMatch(/\bOUT\b/);
    expect(src).toMatch(/evidenceRootResolver\(\{ env: process\.env, tmpdir: os\.tmpdir, mkdtemp: \(prefix\) => fs\.mkdtempSync\(prefix\) \}\)/);
  });

  it('source: the resolver module imports no fs and adds no write site (the reviewed write gate stays closed)', () => {
    const src = read('e2e/quiz-lifecycle/evidence-root.ts');
    expect(src).not.toMatch(/from 'node:fs'|from 'fs'|require\(/);
    const gate = new RegExp(['write' + 'File', 'create' + 'WriteStream', 'append' + 'File', 'Deno\\.' + 'write'].join('|'));
    expect(src).not.toMatch(gate);
  });
});
