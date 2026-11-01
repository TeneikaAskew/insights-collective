// ABOUTME: Unit controls for case-diagnostics.mjs: route shape, API reduction, code/row allowlists, fixed line grammar,
// ABOUTME: and that no id, body text, email or token can reach the line.
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  API_PATH_ALLOWLIST, routeShape, apiPathOf, classifyCode, rowCount, reduceResponse, caseLine, TESTID_ALLOWLIST, HEADING_ALLOWLIST,
  createCaseRecorder, captureCaseFailure, diagnosticFailedLine,
} from '../../../scripts/local-stack/quiz-lifecycle/case-diagnostics.mjs';

const COURSE = '9c000000-0000-4000-8000-000000000001';
const MODULE = '9c000000-0000-4000-8000-000000000002';
const ITEM = '9c001001-0000-4000-8000-000000000000';
const GRAMMAR = /^case-failure test=[a-z0-9-]+ route=\S+ ids=[a-z,]+ states=[a-z,-]+ headings=[a-z0-9,-]+( [a-z_.]+=(unseen|[A-Z]+:(\d+|none):[A-Z0-9a-z]+:(\d+|n\/a)(\|[A-Z]+:(\d+|none):[A-Z0-9a-z]+:(\d+|n\/a))*)){7} api_settled=(true|false)$/;

describe('routeShape', () => {
  it('keeps only the template and per-segment fixture booleans', () => {
    expect(routeShape(`http://127.0.0.1:8080/courses/${COURSE}/learn/${MODULE}/${ITEM}?x=secret`)).toEqual({
      template: '/courses/:c/learn/:m/:i', ids: [true, true, true],
    });
    expect(routeShape('http://127.0.0.1:8080/courses/abc/learn')).toEqual({ template: '/courses/:c/learn', ids: [false] });
    expect(routeShape('http://127.0.0.1:8080/login')).toEqual({ template: '/login', ids: [] });
    expect(routeShape('http://127.0.0.1:8080/profile/user@example.com')).toEqual({ template: 'other', ids: [] });
    expect(routeShape('not a url')).toEqual({ template: 'unparsable', ids: [] });
  });
});

describe('API reduction', () => {
  it('only allowlisted paths are recorded; query strings are ignored', () => {
    expect(apiPathOf(`http://127.0.0.1:54321/rest/v1/courses?id=eq.${COURSE}&select=*`)).toBe('/rest/v1/courses');
    expect(apiPathOf('http://127.0.0.1:54321/rest/v1/rpc/get_quiz_questions_for_taking')).toBe('/rest/v1/rpc/get_quiz_questions_for_taking');
    expect(apiPathOf('http://127.0.0.1:54321/auth/v1/token?grant_type=password')).toBeNull();
    expect(apiPathOf('http://127.0.0.1:54321/rest/v1/profiles')).toBeNull();
  });
  it('codes are allowlisted; anything else is "other"', () => {
    expect(classifyCode({ code: 'PGRST116', message: 'secret detail', details: COURSE })).toBe('PGRST116');
    expect(classifyCode({ code: 'XX999' })).toBe('other');
    expect(classifyCode([{ code: 'PGRST116' }])).toBe('none');
    expect(classifyCode(null)).toBe('none');
  });
  it('row count comes from Content-Range or array length; never the body', () => {
    expect(rowCount('*/0', null)).toBe(0);
    expect(rowCount('0-1/2', [{ id: COURSE }])).toBe(2);
    expect(rowCount(null, [{ id: 'a' }, { id: 'b' }])).toBe(2);
    expect(rowCount(null, { id: COURSE, title: 'x' })).toBe(1);
    expect(rowCount(null, null)).toBe('n/a');
  });
  it('H1 shape: a .single() on an unreadable course reduces to 406 PGRST116 n/a', () => {
    expect(reduceResponse('GET', 406, null, { code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested' }))
      .toEqual({ method: 'GET', status: 406, code: 'PGRST116', rows: 'n/a' });
    expect(reduceResponse('GET', 200, '0-0/1', [{ id: COURSE }])).toEqual({ method: 'GET', status: 200, code: 'none', rows: 1 });
  });
});

describe('caseLine', () => {
  const byPath = new Map([
    ['/rest/v1/courses', [reduceResponse('GET', 406, null, { code: 'PGRST116' })]],
    ['/rest/v1/modules', [reduceResponse('GET', 200, null, [{ id: MODULE, title: 'learner@example.com' }])]],
  ]);
  const line = caseLine({
    test: 'F2 resume: same attempt, saved answer',
    route: routeShape(`http://127.0.0.1:8080/courses/${COURSE}/learn/${MODULE}/${ITEM}`),
    present: [], shown: [HEADING_ALLOWLIST.indexOf('Course not found')], byPath, settled: true,
  });
  it('is one line in the fixed grammar and names the H1 signature', () => {
    expect(line).toMatch(GRAMMAR);
    expect(line).toContain('route=/courses/:c/learn/:m/:i ids=fixture,fixture,fixture states=none headings=course-not-found');
    expect(line).toContain('courses=GET:406:PGRST116:n/a');
    expect(line).toContain('modules=GET:200:none:1');
    expect(line).toContain('rpc.get_quiz_questions_for_taking=unseen');
  });
  it('carries no id, email, title or body text', () => {
    for (const leak of [COURSE, MODULE, ITEM, '9c00', 'learner@example.com', 'example', 'JSON object']) expect(line).not.toContain(leak);
  });
  it('control: a mounted player reads as a player state, not a heading', () => {
    const ok = caseLine({ test: 't', route: routeShape('http://h/courses/x/learn'), present: [TESTID_ALLOWLIST.indexOf('quiz-player-active')], shown: [], byPath: new Map(), settled: false });
    expect(ok).toContain('states=quiz-player-active headings=none');
    expect(ok).toMatch(GRAMMAR);
  });
  it('lists every allowlisted API path exactly once', () => {
    expect(line.split(' ').filter((t) => t.includes('=') && !/^(test|route|ids|states|headings|api_settled)=/.test(t))).toHaveLength(API_PATH_ALLOWLIST.length);
  });
});

describe('rowCount: only a finite, safe, non-negative integer is a count (safety review 23:34Z)', () => {
  it('a 400-digit Content-Range total is the fixed unknown, never Infinity', () => {
    const huge = '9'.repeat(400);
    expect(Number(huge)).toBe(Infinity); // the old path returned this
    expect(rowCount(`0-0/${huge}`, null)).toBe('n/a');
    expect(rowCount(`0-0/${huge}`, [{ id: 'a' }])).toBe('n/a'); // a header claim that is not a count is not replaced by the body
  });
  it('2^53 and above are unknown; the largest safe integer and 0 are counts', () => {
    expect(rowCount('0-0/9007199254740992', null)).toBe('n/a');
    expect(rowCount('0-0/9007199254740991', null)).toBe(9007199254740991);
    expect(rowCount('*/0', null)).toBe(0);
    expect(rowCount('0-0/-1', null)).toBe('n/a');
  });
});

/** A page double: request/response events in any order, with bodies released by the test. */
function fakePage() {
  const em = new EventEmitter() as EventEmitter & { url: () => string; evaluate: () => Promise<unknown> };
  em.url = () => 'http://127.0.0.1:8080/courses/x/learn';
  em.evaluate = async () => ({ present: [], shown: [] });
  const API = 'http://127.0.0.1:54321/rest/v1';
  const issue = (p: string, method = 'GET') => {
    const req = { url: () => `${API}${p}`, method: () => method };
    em.emit('request', req);
    let release!: (v: { status: number; json: unknown; range?: string }) => void;
    const body = new Promise<{ status: number; json: unknown; range?: string }>((r) => { release = r; });
    const respond = () => em.emit('response', {
      url: () => `${API}${p}`, request: () => req, status: () => statusBox.status,
      json: async () => (await body).json, allHeaders: async () => ({ 'content-range': (await body).range }),
    });
    const statusBox = { status: 200 };
    return { respond, finish: (status: number, json: unknown, range?: string) => { statusBox.status = status; release({ status, json, range }); } };
  };
  return { page: em as any, issue };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('createCaseRecorder capture boundary (safety review 23:34Z)', () => {
  it('a reduction that completes after freeze() never changes the returned evidence', async () => {
    const { page, issue } = fakePage();
    const rec = createCaseRecorder(page);
    const a = issue('/courses');
    a.respond(); a.finish(406, { code: 'PGRST116' });
    const late = issue('/courses');
    late.respond(); // body still pending at the boundary
    const snap = await rec.freeze(30);
    expect(snap.settled).toBe(false);
    expect(snap.incomplete).toBe(1);
    const before = JSON.stringify([...snap.byPath]);
    late.finish(200, [{ id: 'x' }]);
    await tick();
    expect(JSON.stringify([...snap.byPath])).toBe(before);
    expect(snap.byPath.get('/rest/v1/courses')).toEqual([{ method: 'GET', status: 406, code: 'PGRST116', rows: 'n/a' }]);
    expect(rec.lateDropped()).toBe(1);
  });

  it('an earlier settled snapshot is not mutated by later traffic, and freeze() is idempotent', async () => {
    const { page, issue } = fakePage();
    const rec = createCaseRecorder(page);
    const a = issue('/modules'); a.respond(); a.finish(200, [{ id: 'm' }]);
    const s1 = await rec.freeze(30);
    expect(s1.settled).toBe(true);
    const b = issue('/modules'); b.respond(); b.finish(200, [{}, {}]);
    await tick();
    expect(s1.byPath.get('/rest/v1/modules')).toHaveLength(1);
    expect(await rec.freeze(30)).toBe(s1);
    expect(page.listenerCount('response')).toBe(0); // intake detached at the boundary
    expect(page.listenerCount('request')).toBe(0);
  });

  it('returned reductions are deep copies and frozen', async () => {
    const { page, issue } = fakePage();
    const rec = createCaseRecorder(page);
    const a = issue('/courses'); a.respond(); a.finish(200, [{ id: 'c' }], '0-0/1');
    const snap = await rec.freeze(30);
    const list = snap.byPath.get('/rest/v1/courses')!;
    expect(Object.isFrozen(list)).toBe(true);
    expect(Object.isFrozen(list[0])).toBe(true);
    expect(() => { (list[0] as any).rows = 99; }).toThrow();
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('out-of-order completion keeps REQUEST order', async () => {
    const { page, issue } = fakePage();
    const rec = createCaseRecorder(page);
    const first = issue('/courses'); const second = issue('/courses');
    second.respond(); first.respond();
    second.finish(200, [{}, {}]); // completes first
    await tick();
    first.finish(406, { code: 'PGRST116' });
    const snap = await rec.freeze(50);
    expect(snap.settled).toBe(true);
    expect(snap.byPath.get('/rest/v1/courses')!.map((r) => r.status)).toEqual([406, 200]);
  });

  it('a request still unanswered at the boundary makes the snapshot unsettled; a failed request reads status none', async () => {
    const { page, issue } = fakePage();
    const rec = createCaseRecorder(page);
    issue('/quizzes'); // never answered
    const req = { url: () => 'http://127.0.0.1:54321/rest/v1/enrollments', method: () => 'GET' };
    page.emit('request', req); page.emit('requestfailed', req);
    const snap = await rec.freeze(20);
    expect(snap.settled).toBe(false);
    expect(snap.incomplete).toBe(1);
    expect(snap.byPath.has('/rest/v1/quizzes')).toBe(false);
    expect(snap.byPath.get('/rest/v1/enrollments')).toEqual([{ method: 'GET', status: 'none', code: 'none', rows: 'n/a' }]);
  });

  it('detach() is idempotent and releases both listeners without a freeze', () => {
    const { page } = fakePage();
    const rec = createCaseRecorder(page);
    expect(page.listenerCount('response')).toBe(1);
    rec.detach(); rec.detach();
    expect(page.listenerCount('response')).toBe(0);
    expect(page.listenerCount('request')).toBe(0);
    expect(page.listenerCount('requestfailed')).toBe(0);
  });
});

describe('captureCaseFailure never fails silently (safety review 23:34Z)', () => {
  it('a recorder that throws yields the fixed diagnostic-failed marker in the file', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'qlc-cf-'));
    try {
      const page: any = { url: () => 'http://h/x', evaluate: async () => ({ present: [], shown: [] }) };
      const line = await captureCaseFailure(page, { out, title: 'F2 resume', recorder: { freeze: async () => { throw new Error('boom secret'); } } as any });
      expect(line).toBe('case-failure test=f2-resume diagnostic=failed stage=freeze');
      expect(fs.readFileSync(path.join(out, 'case-diagnostics', 'f2-resume.txt'), 'utf8')).toBe(`${line}\n`);
      expect(line).not.toContain('boom');
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });

  it('an unwritable output directory prints the marker to stderr and does not throw', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qlc-cf-'));
    const blocker = path.join(dir, 'file');
    fs.writeFileSync(blocker, 'x'); // a FILE where the out directory should be
    const writes: string[] = [];
    const orig = process.stderr.write.bind(process.stderr);
    (process.stderr as any).write = (c: any) => { writes.push(String(c)); return true; };
    try {
      const page: any = { url: () => 'http://h/x', evaluate: async () => ({ present: [], shown: [] }) };
      const rec = { freeze: async () => ({ byPath: new Map(), settled: true, incomplete: 0 }) } as any;
      const line = await captureCaseFailure(page, { out: blocker, title: 'F3', recorder: rec });
      expect(line).toBe('case-failure test=f3 diagnostic=failed stage=write');
      expect(writes).toContain(`${line}\n`);
    } finally { (process.stderr as any).write = orig; fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('the marker grammar is fixed; unknown stages collapse to other', () => {
    expect(diagnosticFailedLine('A b', 'line')).toBe('case-failure test=a-b diagnostic=failed stage=line');
    expect(diagnosticFailedLine('A b', 'weird stage')).toBe('case-failure test=a-b diagnostic=failed stage=other');
  });
});

describe('session.fixture.ts wiring (safety review 23:34Z)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../../e2e/quiz-lifecycle/session.fixture.ts'), 'utf8');
  const learner = src.slice(src.indexOf('  learner: async'), src.indexOf('  snapshot: async'));
  it('the recorder is created before, and detached in a finally that encloses, every setup step and use()', () => {
    const created = learner.indexOf('createCaseRecorder(page)');
    const outerTry = learner.indexOf('try {', created);
    const finallyAt = learner.lastIndexOf('} finally {');
    for (const step of ['addInitScript', "page.goto('/login'", '#email', 'Sign In', 'await use(page)']) {
      const at = learner.indexOf(step);
      expect(at, step).toBeGreaterThan(outerTry);
      expect(at, step).toBeLessThan(finallyAt);
    }
    expect(learner.slice(finallyAt)).toContain('caseRecorder.detach()');
    expect(learner.slice(finallyAt)).toContain('recorder.detach()');
  });
  it('the capture result is not swallowed with a catch', () => {
    expect(learner).toContain('await captureCaseFailure(');
    expect(learner).not.toMatch(/captureCaseFailure\([^)]*\)\s*\.catch/);
  });
});
