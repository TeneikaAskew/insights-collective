// ABOUTME: MOCKED unit controls for the quiz lifecycle readiness classifier (e2e/quiz-lifecycle/readiness-core.ts):
// ABOUTME: exact course-GET matching, allowlisted error codes, and a classification line that never carries ids or bodies.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  classifyCourseBody, isCourseGet, learnIds, readinessLine, HEADING_ALLOW, STATE_TESTIDS, classifyNavError, scenarioTitles,
  expectedItemTitle,
} from '../../../e2e/quiz-lifecycle/readiness-core';

const C = '9c000000-0000-4000-8000-000000000001';
const API = 'http://127.0.0.1:54321';
const empty = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, false]));

describe('quiz lifecycle readiness classifier', () => {
  it('matches only the app single-course GET for the expected course', () => {
    expect(isCourseGet('GET', `${API}/rest/v1/courses?select=id%2Ctitle&id=eq.${C}`, C)).toBe(true);
    expect(isCourseGet('HEAD', `${API}/rest/v1/courses?id=eq.${C}`, C)).toBe(false);
    expect(isCourseGet('GET', `${API}/rest/v1/courses?id=eq.9c002000-0000-4000-8000-0000000000c0`, C)).toBe(false);
    expect(isCourseGet('GET', `${API}/rest/v1/courses_x?id=eq.${C}`, C)).toBe(false);
    expect(isCourseGet('GET', `${API}/rest/v1/modules?course_id=eq.${C}`, C)).toBe(false);
  });

  it('classifies the H1-predicted shape (406 PGRST116; not observed in run 41359219343) and the ready shape', () => {
    expect(classifyCourseBody(406, '{"code":"PGRST116","details":"The result contains 0 rows","message":"x"}', C))
      .toEqual({ observed: true, status: 406, code: 'PGRST116', id_match: false });
    expect(classifyCourseBody(200, JSON.stringify({ id: C, title: 'QLC' }), C))
      .toEqual({ observed: true, status: 200, code: 'none', id_match: true });
    expect(classifyCourseBody(200, JSON.stringify({ id: 'other' }), C).id_match).toBe(false);
    expect(classifyCourseBody(500, '{"code":"XX999","message":"secret detail"}', C).code).toBe('other');
    expect(classifyCourseBody(200, 'not json', C)).toEqual({ observed: true, status: 200, code: 'none', id_match: false });
  });

  it('the line is fixed-format and carries no id, body text, heading text or URL', () => {
    const headings = { ...empty(HEADING_ALLOW), 'Course not found': true };
    const states = empty(STATE_TESTIDS);
    const get = classifyCourseBody(406, `{"code":"PGRST116","message":"row ${C} secret"}`, C);
    const line = readinessLine('open-26', { routeTemplate: true, courseMatch: true, itemMatch: true, get, headings, states });
    expect(line).toBe('QLC-READINESS case=open-26 nav=not_attempted route_template=true course_match=true item_match=true '
      + 'target_heading=false course_get[status=406 code=PGRST116 id_match=false] headings[h0=1,h1=0,h2=0,h3=0] '
      + 'states[loading=0,empty=0,active=0,review=0,exhausted=0]');
    for (const leak of [C, 'secret', 'Course not found', 'http', '/courses/']) expect(line).not.toContain(leak);
    expect(readinessLine('x y/z', { routeTemplate: false, courseMatch: false, itemMatch: false, get: { observed: false }, headings, states }))
      .toContain('case=x_y_z nav=not_attempted route_template=false course_match=false item_match=false target_heading=false course_get[not_observed]');
  });

  it('parses only the learn route template', () => {
    expect(learnIds(`/courses/${C}/learn/m/i`)).toEqual({ course: C, module: 'm', item: 'i' });
    expect(() => learnIds('/courses')).toThrow('not a learn path');
  });

  it('maps navigation errors to fixed tokens only', () => {
    expect(classifyNavError('page.goto: net::ERR_ABORTED at http://127.0.0.1:8080/courses/x')).toBe('aborted');
    expect(classifyNavError('page.goto: Timeout 30000ms exceeded.')).toBe('timeout');
    expect(classifyNavError('page.goto: net::ERR_CONNECTION_REFUSED at http://x')).toBe('failed');
  });

  it('derives every target item heading from the real fixture.sql (23 scenarios)', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../../scripts/local-stack/quiz-lifecycle/fixture.sql'), 'utf8');
    const titles = scenarioTitles(sql);
    expect(Object.keys(titles)).toHaveLength(23);
    expect(expectedItemTitle(titles, '9c001e01-0000-4000-8000-000000000000')).toBe('QLC R3 slow start B');
    expect(expectedItemTitle(titles, '9c002001-0000-4000-8000-000000000000')).toBe('QLC T62 refused 1440');
    expect(expectedItemTitle(titles, '9c009901-0000-4000-8000-000000000000')).toBeNull();
    expect(expectedItemTitle(titles, 'not-an-item')).toBeNull();
  });
});
