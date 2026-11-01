// ABOUTME: Unit controls for case-diagnostics.mjs: route shape, API reduction, code/row allowlists, fixed line grammar,
// ABOUTME: and that no id, body text, email or token can reach the line.
import { describe, it, expect } from 'vitest';
import {
  API_PATH_ALLOWLIST, routeShape, apiPathOf, classifyCode, rowCount, reduceResponse, caseLine, TESTID_ALLOWLIST, HEADING_ALLOWLIST,
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
