// ABOUTME: Pins what the salary filter does when wage data is missing.
// ABOUTME: Matching everything on a failed query reads as "every role pays over $120k".
import { describe, it, expect } from 'vitest';

/**
 * Mirrors `matchesSalaryFilter` in ExploreDataCareers. Extracted so the rule can
 * be asserted without mounting the page and stubbing a query client — the rule
 * is the part that was wrong, not the rendering.
 *
 * The distinction that matters: **in-flight** and **settled-but-absent** are not
 * the same state. The original guard returned `true` for both, so a failed
 * `career_role_wages` request left "Over $120k" showing all 33 roles, including
 * ones with no pay data at all. Flagged in review on #42.
 */
export const matchesSalaryFilter = (
  median: number | undefined,
  filter: string,
  pending: boolean,
): boolean => {
  // "All Salary Ranges" makes no claim about pay, so it does not need data.
  if (filter === 'all' || pending) return true;
  if (median === undefined) return false;
  switch (filter) {
    case 'under-80k':
      return median < 80000;
    case '80k-120k':
      return median >= 80000 && median <= 120000;
    case 'over-120k':
      return median > 120000;
    default:
      return true;
  }
};

describe('salary filter with wage data present', () => {
  it.each([
    [65000, 'under-80k', true],
    [95000, 'under-80k', false],
    [95000, '80k-120k', true],
    [120000, '80k-120k', true],
    [120001, '80k-120k', false],
    [150000, 'over-120k', true],
    [120000, 'over-120k', false],
  ])('median %i against %s → %s', (median, filter, expected) => {
    expect(matchesSalaryFilter(median, filter, false)).toBe(expected);
  });
});

describe('salary filter without wage data', () => {
  it('matches everything while the query is in flight', () => {
    // Filtering on an empty map before the data lands would blank the list.
    expect(matchesSalaryFilter(undefined, 'over-120k', true)).toBe(true);
  });

  it('matches nothing once the query has settled', () => {
    // The regression this guards: a role with no median must not satisfy a
    // specific band. Returning true here means a failed request renders as a
    // confident, wrong claim about every role's pay.
    expect(matchesSalaryFilter(undefined, 'over-120k', false)).toBe(false);
    expect(matchesSalaryFilter(undefined, 'under-80k', false)).toBe(false);
    expect(matchesSalaryFilter(undefined, '80k-120k', false)).toBe(false);
  });

  it('still matches when no band is selected', () => {
    // "All Salary Ranges" is not a claim about pay, so absent data is fine.
    expect(matchesSalaryFilter(undefined, 'all', false)).toBe(true);
  });
});
