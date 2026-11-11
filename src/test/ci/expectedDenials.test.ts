// ABOUTME: Controls for the bounded expected-denial declaration used by the shared console-errors fixture.
// ABOUTME: OLD (no declaration) keeps the two T62 denials fatal; NEW consumes exactly them; every deviation stays fatal.
import { describe, expect, it } from 'vitest';
import { declarationProblem, partitionExpectedDenials } from '../../../scripts/e2e/expected-denials.mjs';
import { structuralIssues } from '../../integrations/supabase/issue-triage';

const ROUTE = '/courses/9c002000-0000-4000-8000-0000000000c0/learn/9c002000-0000-4000-8000-0000000000d0/9c002001-0000-4000-8000-000000000000';
const AFTER = Date.parse('2026-11-02T01:22:29.000Z');
// The exact shape recorded by run 41371698351 (T62 1440): two refusals, start then Retry.
const denial = (at: string, over: Record<string, unknown> = {}) => ({
  kind: 'error', method: 'POST', target: 'rpc/start_quiz_attempt', status: 403, code: '42501',
  message: 'You do not have access to this quiz.', route: ROUTE, at, ...over,
}) as never;
const RUN = [denial('2026-11-02T01:22:29.309Z'), denial('2026-11-02T01:22:29.560Z')];
const DECL = { method: 'POST', target: 'rpc/start_quiz_attempt', status: 403, code: '42501', message: 'You do not have access to this quiz.', route: ROUTE, count: 2, after: AFTER };

describe('expected denials (shared observer)', () => {
  it('OLD: with no declaration the run\'s two refusals are structural and stay fatal', () => {
    const s = structuralIssues(RUN);
    expect(s).toHaveLength(2);
    const r = partitionExpectedDenials(s, []);
    expect(r.unexpected).toHaveLength(2);
    expect(r.problems).toEqual([]);
  });
  it('NEW: the exact declaration consumes exactly those two and nothing else', () => {
    const r = partitionExpectedDenials(structuralIssues(RUN), [DECL]);
    expect(r.unexpected).toEqual([]);
    expect(r.consumed).toHaveLength(2);
    expect(r.problems).toEqual([]);
  });
  it.each([
    ['count too low (1 declared, 2 observed)', { ...DECL, count: 1 }],
    ['count too high (3 declared, 2 observed)', { ...DECL, count: 3 }],
    ['other route (identity)', { ...DECL, route: ROUTE.replace('9c0020', '9c0022') }],
    ['other target', { ...DECL, target: 'rpc/submit_quiz_attempt' }],
    ['other method', { ...DECL, method: 'GET' }],
    ['other message', { ...DECL, message: 'Permission denied.' }],
    ['phase: refusals before `after`', { ...DECL, after: Date.parse('2026-11-02T01:22:30.000Z') }],
  ])('a mismatched declaration (%s) is itself a failure and consumes nothing', (_n, d) => {
    const r = partitionExpectedDenials(structuralIssues(RUN), [d]);
    expect(r.problems).toHaveLength(1);
    expect(r.unexpected).toHaveLength(2);
  });
  it('a third, undeclared refusal makes the exact count fail', () => {
    const r = partitionExpectedDenials(structuralIssues([...RUN, denial('2026-11-02T01:22:31.000Z')]), [DECL]);
    expect(r.problems).toHaveLength(1);
    expect(r.unexpected).toHaveLength(3);
  });
  it('an unrelated structural issue stays fatal next to a met declaration', () => {
    const other = denial('2026-11-02T01:22:29.700Z', { target: 'quiz_submissions', method: 'GET', code: '42703', status: 400, message: 'column x does not exist' });
    const r = partitionExpectedDenials(structuralIssues([...RUN, other]), [DECL]);
    expect(r.problems).toEqual([]);
    expect(r.unexpected).toEqual([other]);
  });
  it('an empty-write on the same target is never consumed', () => {
    const ew = { kind: 'empty-write', method: 'POST', target: 'rpc/start_quiz_attempt', status: 200, route: ROUTE, at: '2026-11-02T01:22:29.400Z' } as never;
    const r = partitionExpectedDenials(structuralIssues([...RUN, ew]), [DECL]);
    expect(r.unexpected).toEqual([ew]);
  });
  it.each([
    ['status 401', { ...DECL, status: 401 }, 'status'],
    ['code 42703 (not a denial)', { ...DECL, code: '42703' }, 'code'],
    ['code PGRST116', { ...DECL, code: 'PGRST116' }, 'code'],
    ['wildcard target', { ...DECL, target: 'rpc/*' }, 'target'],
    ['route pattern', { ...DECL, route: '.*' }, 'route'],
    ['count 0', { ...DECL, count: 0 }, 'count'],
    ['missing after', { ...DECL, after: undefined }, 'keys'],
    ['extra key', { ...DECL, any: true }, 'keys'],
    ['non-integer after', { ...DECL, after: 1.5 }, 'after'],
  ])('only an exact 403/42501 declaration is accepted (%s)', (_n, d, why) => {
    const clean = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined));
    expect(declarationProblem(clean)).toBe(why);
    const r = partitionExpectedDenials(structuralIssues(RUN), [clean]);
    expect(r.problems).toEqual([`expected-denial #1 rejected: ${why}`]);
    expect(r.unexpected).toHaveLength(2);
  });
  it('two declarations cannot consume the same issue twice', () => {
    const half = { ...DECL, count: 2 };
    const r = partitionExpectedDenials(structuralIssues(RUN), [half, half]);
    expect(r.problems).toHaveLength(1);
    expect(r.unexpected).toEqual([]);
  });
});
