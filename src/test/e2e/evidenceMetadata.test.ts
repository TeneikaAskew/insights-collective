// ABOUTME: Unit tests for e2e/evidence/evidence-metadata.mjs: label validation refuses off-shape values, attachment
// ABOUTME: names are built only from validated parts, API metadata is reduced to primitives, foreign bodies are never read.
import { describe, it, expect, vi } from 'vitest';
import { validateLabels, attachmentName, apiRecord, courseRows, appPath, apiPath, method, status, MAX_IDS, createApiObserver, captureWindow, AUTHENTIC } from '../../../e2e/evidence/evidence-metadata.mjs';

const SHA = 'b54dd6cfbdc094ad5284911ba9bb1a59ef6a309f';
const ID = '660e8400-e29b-41d4-a716-446655440001';

describe('validateLabels', () => {
  it('accepts a 40-hex SHA and a printable environment', () => {
    expect(validateLabels({ E2E_EVIDENCE_COMMIT: SHA, E2E_EVIDENCE_ENVIRONMENT: 'isolated local stack' }).ok).toBe(true);
  });
  it.each([
    ['unset commit', { E2E_EVIDENCE_ENVIRONMENT: 'x' }],
    ['short SHA', { E2E_EVIDENCE_COMMIT: SHA.slice(0, 12), E2E_EVIDENCE_ENVIRONMENT: 'x' }],
    ['path traversal in commit', { E2E_EVIDENCE_COMMIT: '../../../../etc/passwd/aaaaaaaaaaaaaaaaaaaa', E2E_EVIDENCE_ENVIRONMENT: 'x' }],
    ['uppercase SHA', { E2E_EVIDENCE_COMMIT: SHA.toUpperCase(), E2E_EVIDENCE_ENVIRONMENT: 'x' }],
    ['newline in environment', { E2E_EVIDENCE_COMMIT: SHA, E2E_EVIDENCE_ENVIRONMENT: 'a\nb' }],
    ['empty environment', { E2E_EVIDENCE_COMMIT: SHA, E2E_EVIDENCE_ENVIRONMENT: '' }],
    ['oversized environment', { E2E_EVIDENCE_COMMIT: SHA, E2E_EVIDENCE_ENVIRONMENT: 'x'.repeat(241) }],
  ])('refuses %s', (_n, env) => { expect(validateLabels(env).ok).toBe(false); });
});

describe('attachmentName', () => {
  it('builds a name from validated parts and the retry index', () => {
    expect(attachmentName({ commit: SHA, viewport: 'tablet-768x1024', step: '02-course-detail', retry: 1, kind: 'png' }))
      .toBe('b54dd6cfbdc0__tablet-768x1024__02-course-detail__retry1.png');
  });
  it('gives each retry a distinct name', () => {
    const n = (retry: number) => attachmentName({ commit: SHA, viewport: 'mobile-390x844', step: '01-catalog', retry, kind: 'json' });
    expect(n(0)).not.toBe(n(1));
  });
  it.each([
    ['unvalidated commit', { commit: '../x', viewport: 'mobile-390x844', step: '01-catalog', retry: 0, kind: 'png' }],
    ['unknown viewport', { commit: SHA, viewport: '../evil', step: '01-catalog', retry: 0, kind: 'png' }],
    ['unknown step', { commit: SHA, viewport: 'mobile-390x844', step: '04-x', retry: 0, kind: 'png' }],
    ['negative retry', { commit: SHA, viewport: 'mobile-390x844', step: '01-catalog', retry: -1, kind: 'png' }],
    ['unknown kind', { commit: SHA, viewport: 'mobile-390x844', step: '01-catalog', retry: 0, kind: 'html' }],
  ])('throws on %s', (_n, a) => { expect(() => attachmentName(a)).toThrow(); });
});

describe('primitive reducers', () => {
  it('keeps only UUID-shaped string ids, bounded, and counts the rest', () => {
    const body = [{ id: ID }, { id: 7 }, { id: { nested: true } }, { id: '<script>' }, null, 'x', { id: ID.toUpperCase() }];
    expect(courseRows(body)).toEqual({ rows: 7, ids: [ID], rejectedIds: 6 });
    const many = Array.from({ length: MAX_IDS + 5 }, () => ({ id: ID }));
    expect(courseRows(many).ids).toHaveLength(MAX_IDS);
    expect(courseRows({ id: ID })).toEqual({ rows: null, ids: [], rejectedIds: 0 });
  });
  it('replaces unexpected paths, methods and statuses with fixed markers', () => {
    expect(apiPath('/rest/v1/courses')).toBe('/rest/v1/courses');
    expect(apiPath('/rest/v1/courses?select=*')).toBe('<unrecognized path>');
    expect(apiPath('/rest/v1/../../etc')).toBe('<unrecognized path>');
    expect(appPath('/courses/' + ID)).toBe('/courses/' + ID);
    expect(appPath('/x%0Ay')).toBe('<unrecognized path>');
    expect(method('get')).toBe('OTHER');
    expect(status(200)).toBe(200);
    expect(status(1000)).toBe(0);
  });
});

describe('apiRecord', () => {
  it('never reads a foreign-origin body and keeps no host', async () => {
    const readJson = vi.fn(async () => [{ id: ID }]);
    const r = await apiRecord({ isConfiguredApi: false, pathname: '/rest/v1/courses', requestMethod: 'GET', responseStatus: 200, contentType: 'application/json', readJson });
    expect(readJson).not.toHaveBeenCalled();
    expect(r).toEqual({ origin: 'FOREIGN', method: 'GET', path: '/rest/v1/courses', status: 200, rows: null, courseIds: [], rejectedIds: 0 });
    expect(JSON.stringify(r)).not.toMatch(/host|query/);
  });
  it('reduces a configured-API course response to counts and UUIDs', async () => {
    const r = await apiRecord({ isConfiguredApi: true, pathname: '/rest/v1/courses', requestMethod: 'GET', responseStatus: 200, contentType: 'application/json; charset=utf-8', readJson: async () => [{ id: ID, title: 'secret title' }] });
    expect(r).toEqual({ origin: 'configured-loopback-api', method: 'GET', path: '/rest/v1/courses', status: 200, rows: 1, courseIds: [ID], rejectedIds: 0 });
    expect(JSON.stringify(r)).not.toContain('secret title');
  });
  it('survives an unreadable body', async () => {
    const r = await apiRecord({ isConfiguredApi: true, pathname: '/rest/v1/courses', requestMethod: 'GET', responseStatus: 200, contentType: 'application/json', readJson: async () => { throw new Error('gone'); } });
    expect(r.rows).toBeNull();
  });
});

const local = (path = '/rest/v1/courses') => ({ origin: 'configured-loopback-api', method: 'GET', path, status: 200, rows: 1, courseIds: [ID], rejectedIds: 0 });
const foreign = { origin: 'FOREIGN', method: 'GET', path: '/rest/v1/courses', status: 200, rows: null, courseIds: [], rejectedIds: 0 };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('captureWindow (screenshot, then settle, then one snapshot)', () => {
  it('a FOREIGN response arriving during the screenshot is in the attached metadata and makes the window not authentic', async () => {
    const obs = createApiObserver();
    obs.record(Promise.resolve(local()));
    await obs.settle();
    const w = await captureWindow({
      observer: obs, apiOk: true,
      screenshot: async () => { obs.record(new Promise((r) => setTimeout(() => r(foreign), 5))); await tick(); return Buffer.from('png'); },
      outcomeFrom: (api: readonly { origin: string }[]) => ({ responses: api.length, foreign: api.filter((c) => c.origin === 'FOREIGN').length }),
    });
    expect(w.api.map((c: { origin: string }) => c.origin)).toEqual(['configured-loopback-api', 'FOREIGN']);
    expect(w.backend.mode).toBe('NOT AUTHENTIC');
    expect(w.backend.foreignResponses).toBe(1);
    expect(w.outcome).toEqual({ responses: 2, foreign: 1 });
  });
  it('derives backend and outcome from the same immutable snapshot', async () => {
    const obs = createApiObserver();
    obs.record(Promise.resolve(local()));
    let seen: unknown;
    const w = await captureWindow({ observer: obs, apiOk: true, screenshot: async () => Buffer.from('p'), outcomeFrom: (api: unknown) => { seen = api; return {}; } });
    expect(seen).toBe(w.api);
    expect(Object.isFrozen(w.api)).toBe(true);
    expect(Object.isFrozen(w.api[0])).toBe(true);
    expect(w.backend.mode).toBe(AUTHENTIC);
  });
  it('settle() also waits for observations added while it is draining', async () => {
    const obs = createApiObserver();
    obs.record(new Promise((r) => setTimeout(() => { obs.record(new Promise((r2) => setTimeout(() => r2(foreign), 5))); r(local()); }, 5)));
    await obs.settle();
    expect(obs.pendingCount()).toBe(0);
    expect(obs.snapshot().length).toBe(2);
  });
  it('an observation completing after the snapshot is kept for the next window, not dropped or merged back', async () => {
    const obs = createApiObserver();
    obs.record(Promise.resolve(local('/rest/v1/a')));
    await obs.settle();
    let release: (v: unknown) => void = () => {};
    obs.record(new Promise((r) => { release = r; }));
    const first = obs.snapshot();
    release(local('/rest/v1/b'));
    await obs.settle();
    const second = obs.snapshot();
    expect(first.map((c: { path: string }) => c.path)).toEqual(['/rest/v1/a']);
    expect(second.map((c: { path: string }) => c.path)).toEqual(['/rest/v1/b']);
  });
  it('a window with no API responses is not authentic', async () => {
    const w = await captureWindow({ observer: createApiObserver(), apiOk: true, screenshot: async () => Buffer.from('p'), outcomeFrom: () => ({}) });
    expect(w.backend.mode).toBe('NOT AUTHENTIC');
  });
});
