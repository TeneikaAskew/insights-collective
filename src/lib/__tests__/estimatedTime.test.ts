// ABOUTME: Contract for the single "Estimated time" reading of courses.estimated_hours.
// ABOUTME: Missing/invalid/zero render nothing; rounding and bucket edges are exact.
import { describe, it, expect } from 'vitest';
import { formatEstimatedHours, matchesEstimatedTime, validEstimatedHours } from '@/lib/estimatedTime';

describe('formatEstimatedHours', () => {
  it.each([null, undefined, NaN, 0, -1, '', 'abc', Infinity])('renders nothing for %s', (v) => {
    expect(formatEstimatedHours(v)).toBeNull();
  });
  it.each([
    [0.04, 'Under 0.1 hours'],
    [0.05, '0.1 hours'],
    [1, '1 hour'],
    [1.04, '1 hour'],
    [1.05, '1.1 hours'],
    [4, '4 hours'],
    [4.25, '4.3 hours'],
    [12.5, '12.5 hours'],
    [40, '40 hours'],
    ['3.5', '3.5 hours'],
  ])('%s -> %s', (v, want) => {
    expect(formatEstimatedHours(v)).toBe(want);
  });
});

describe('matchesEstimatedTime', () => {
  it.each([
    [1.94, 'lt2', true], [1.95, 'lt2', false], [1.95, '2to5', true], [1.99, '2to5', true], [2, 'lt2', false], [2, '2to5', true], [4.94, '2to5', true], [4.95, '5to10', true], [5, '2to5', false],
    [5, '5to10', true], [9.94, '5to10', true], [9.95, 'gte10', true], [10, '5to10', false], [10, 'gte10', true], [100, 'gte10', true],
    [0.5, 'lt2', true],
  ])('%s in %s is %s', (h, b, want) => {
    expect(matchesEstimatedTime(h, b)).toBe(want);
  });
  it('a course with no estimate (missing, invalid or 0) matches only "all"', () => {
    for (const h of [null, undefined, NaN, 0, -3]) {
      expect(matchesEstimatedTime(h, 'all')).toBe(true);
      for (const b of ['lt2', '2to5', '5to10', 'gte10']) expect(matchesEstimatedTime(h, b)).toBe(false);
    }
  });
  it('a value never sits in a bucket that contradicts its displayed text', () => {
    for (let h = 0.01; h < 12; h += 0.01) {
      const shown = Number(formatEstimatedHours(h)!.replace(/^Under /, '').split(' ')[0]);
      for (const [b, lo, hi] of [['lt2', 0, 2], ['2to5', 2, 5], ['5to10', 5, 10], ['gte10', 10, Infinity]] as const) {
        if (matchesEstimatedTime(h, b)) expect(shown >= lo && shown < hi || shown === 0.1 && lo === 0).toBe(true);
      }
    }
  });
  it('an unknown bucket matches nothing', () => {
    expect(matchesEstimatedTime(3, 'weeks')).toBe(false);
  });
  it('0 is "no estimate", distinct from a small positive estimate', () => {
    expect(validEstimatedHours(0)).toBeNull();
    expect(validEstimatedHours(0.01)).toBe(0.01);
  });
});
