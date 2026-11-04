// ABOUTME: The npm-audit gate fails closed: only a well-formed v2 report with a documented 0/1 npm status can pass;
// ABOUTME: error objects, malformed output or status are "unusable" (exit 2); high/critical still exit 1; no echo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { evaluateAudit, parseNpmStatus } from '../../../scripts/ci/check-npm-audit.mjs';

const fx = (name: string) => readFileSync(path.resolve(__dirname, '../fixtures/npm-audit', name), 'utf8');
const SCRIPT = path.resolve(__dirname, '../../../scripts/ci/check-npm-audit.mjs');
const report = (v: Partial<Record<string, unknown>>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0, ...v } },
    ...extra,
  });

describe('check-npm-audit (fail-closed gate)', () => {
  it('real report from main 99f81e3e: 1 critical + 4 high -> exit 1 (threshold preserved)', () => {
    const r = evaluateAudit(fx('real-99f81e3e-omit-dev.json'), 1);
    expect(r.code).toBe(1);
    expect(r.counts).toMatchObject({ critical: 1, high: 4, moderate: 5 });
  });

  it('real registry-unreachable error object -> exit 2, never zero', () => {
    const text = fx('real-error-econnrefused.json');
    expect(JSON.parse(text).metadata).toBeUndefined(); // the shape `jq ... // 0` used to read as "0 high"
    expect(evaluateAudit(text, 1).code).toBe(2);
    expect(evaluateAudit(text, 0).code).toBe(2);
  });

  it('clean v2 report with status 0 -> exit 0; moderate-only with status 1 -> exit 0 (visible, not failing)', () => {
    expect(evaluateAudit(report({}), 0).code).toBe(0);
    const r = evaluateAudit(fx('real-4caf417-omit-dev-moderate-only.json'), 1);
    expect(r.code).toBe(0);
    expect(r.counts).toMatchObject({ critical: 0, high: 0, moderate: 5 });
    expect(r.reason).toContain('moderate 5');
  });

  it.each([[2], [127], [137], [-1], [''], [undefined], [null], ['abc'], ['1.0'], [' 1'], ['01'], [1.5], [NaN]])(
    'moderate-only report with npm status %j -> exit 2 (only documented 0/1 accepted)', (st) => {
      expect(evaluateAudit(fx('real-4caf417-omit-dev-moderate-only.json'), st as never).code).toBe(2);
    });

  it('status must agree with the counts: 0 with advisories, or 1 with none, is unusable', () => {
    expect(evaluateAudit(fx('real-99f81e3e-omit-dev.json'), 0).code).toBe(2);
    expect(evaluateAudit(fx('real-4caf417-omit-dev-moderate-only.json'), 0).code).toBe(2);
    expect(evaluateAudit(report({}), 1).code).toBe(2);
  });

  it('parseNpmStatus accepts exactly 0/1', () => {
    expect([0, 1, '0', '1'].map(parseNpmStatus)).toEqual([0, 1, 0, 1]);
    expect([2, -1, '', ' 1', '1.0', 'x', undefined, null, true].map(parseNpmStatus)).toEqual(Array(9).fill(null));
  });

  it('vulnerabilities must be an object map: [] is refused even when every count is zero', () => {
    expect(evaluateAudit(report({}, { vulnerabilities: [] }), 0).code).toBe(2);
    expect(evaluateAudit(report({}, { vulnerabilities: null }), 0).code).toBe(2);
    expect(evaluateAudit(report({}, { vulnerabilities: 'x' }), 0).code).toBe(2);
  });

  it('one high or one critical -> exit 1', () => {
    expect(evaluateAudit(report({ high: 1, total: 1 }), 1).code).toBe(1);
    expect(evaluateAudit(report({ critical: 1, total: 1 }), 1).code).toBe(1);
  });

  it.each([
    ['empty output', ''],
    ['whitespace only', '  \n'],
    ['not JSON', 'npm ERR! code ENOLOCK'],
    ['JSON null', 'null'],
    ['JSON array', '[]'],
    ['error object with code', JSON.stringify({ error: { code: 'ENOLOCK', summary: 'no lockfile' } })],
    ['error object alongside counts', report({}, { error: { code: 'EAUDITNOPJSON' } })],
    ['v1 report', JSON.stringify({ auditReportVersion: 1, metadata: { vulnerabilities: { high: 0 } } })],
    ['missing version', JSON.stringify({ metadata: { vulnerabilities: { high: 0, critical: 0 } } })],
    ['missing metadata', JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} })],
    ['high is a string', report({ high: '0' })],
    ['high is null', report({ high: null })],
    ['critical missing', JSON.stringify({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, total: 0 } } })],
    ['negative count', report({ high: -1, total: -1 })],
    ['fractional count', report({ high: 0.5, total: 0.5 })],
    ['total does not add up', report({ moderate: 2, total: 1 })],
    ['vulnerabilities map missing', JSON.stringify({ auditReportVersion: 2, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } })],
  ])('%s -> exit 2 (unusable, not a pass)', (_name, text) => {
    expect(evaluateAudit(text as string, 1).code).toBe(2);
  });


  it('CLI: exit codes 0 / 1 / 2 and a missing file is 2', () => {
    const run = (args: string[]) => {
      try { execFileSync(process.execPath, [SCRIPT, ...args], { stdio: 'pipe' }); return 0; }
      catch (e) { return (e as { status: number }).status; }
    };
    const dir = path.resolve(__dirname, '../fixtures/npm-audit');
    expect(run([path.join(dir, 'real-99f81e3e-omit-dev.json'), '1'])).toBe(1);
    expect(run([path.join(dir, 'real-error-econnrefused.json'), '1'])).toBe(2);
    expect(run([path.join(dir, 'does-not-exist.json'), '1'])).toBe(2);
    expect(run([path.join(dir, 'real-99f81e3e-omit-dev.json'), 'x'])).toBe(2);
    expect(run([path.join(dir, 'real-99f81e3e-omit-dev.json')])).toBe(2); // status omitted
  });

  describe('CLI never echoes uncontrolled input (sentinel stands in for a leaked credential)', () => {
    const SENTINEL = 'AUDIT_SENTINEL_9f3c1e7b';
    const dir = path.resolve(__dirname, '../fixtures/npm-audit');
    const cli = (args: string[], env: Record<string, string> = {}) => {
      try {
        const out = execFileSync(process.execPath, [SCRIPT, ...args], { stdio: 'pipe', env: { ...process.env, ...env } });
        return { status: 0, out: out.toString() };
      } catch (e) {
        const err = e as { status: number; stdout: Buffer; stderr: Buffer };
        return { status: err.status, out: `${err.stdout}${err.stderr}` };
      }
    };
    it.each([
      ['error code/summary/message/detail', ['synthetic/error-sentinel.json', '1']],
      ['invalid JSON text (parse-error message)', ['synthetic/notjson-sentinel.txt', '1']],
      ['auditReportVersion', ['synthetic/version-sentinel.json', '1']],
      ['a severity count', ['synthetic/count-sentinel.json', '1']],
      ['the status argument', ['real-4caf417-omit-dev-moderate-only.json', SENTINEL]],
      ['the file path', [`${SENTINEL}.json`, '1']],
    ])('%s -> exit 2 and the sentinel is absent from stdout+stderr', (_n, [file, st]) => {
      const r = cli([path.join(dir, file), st]);
      expect(r.status).toBe(2);
      expect(r.out).not.toContain(SENTINEL);
      expect(r.out).toMatch(/::error::/);
    });
    it('vulnerabilities: [] -> exit 2 through the CLI', () => {
      expect(cli([path.join(dir, 'synthetic/vulns-array-clean.json'), '0']).status).toBe(2);
      expect(cli([path.join(dir, 'synthetic/clean.json'), '0']).status).toBe(0);
    });
    it('visibility mode keeps high/critical at exit 1 as a warning; moderate stays visible at exit 0', () => {
      const hi = cli([path.join(dir, 'real-99f81e3e-omit-dev.json'), '1'], { AUDIT_GATE_MODE: 'visibility' });
      expect(hi.status).toBe(1);
      expect(hi.out).toMatch(/^::warning::high\/critical advisories found \(critical 1, high 4, moderate 5/);
      const mod = cli([path.join(dir, 'real-4caf417-omit-dev-moderate-only.json'), '1']);
      expect(mod.status).toBe(0);
      expect(mod.out).toContain('moderate 5');
    });
  });

  it('security.yml routes every audit gate through the checker and no longer defaults counts to zero', () => {
    const yml = readFileSync(path.resolve(__dirname, '../../../.github/workflows/security.yml'), 'utf8');
    expect(yml).not.toMatch(/vulnerabilities\.(high|critical)\s*\/\/\s*0/);
    expect(yml).toMatch(/check-npm-audit\.mjs audit-results-prod\.json/);
    expect(yml).not.toMatch(/npm audit --omit=dev --json > audit-results-prod\.json \|\| true/);
  });
});
