// Guards the challenge test data seeded by supabase/migrations, which nothing
// else covers: it is SQL, so typecheck and the component tests never read it.
//
// Two real defects motivate this, and they fail in opposite directions:
//
//   Two Sum          `[-1,0,1,2]` target 1 had TWO right answers ([0,3] and
//                    [1,2]) under compare_mode 'exact', so the canonical
//                    single-pass hash map was graded WRONG. Data that FAILS
//                    correct solutions.
//
//   Pandas Filter    specified as "exceeds" the threshold, but no case put a
//                    value ON the threshold, so `>=` passed everything. Data
//                    that PASSES incorrect solutions.
//
// Both are unfixable at grading time — the grader can only compare against what
// it was given — so the assertions are on the data itself.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = 'supabase/migrations';

interface TestCase {
  input: string;
  expected: string;
  hidden?: boolean;
}

/**
 * Replay the migrations to get a challenge's final test_cases.
 *
 * Migrations touch this data three ways and all of them have to be honoured, or
 * the test reads a state the database was never in:
 *
 *   INSERT ... VALUES (... '[...]'::jsonb ...)   the original seed
 *   SET test_cases = '[...]'                     wholesale replacement
 *   SET test_cases = test_cases || '[...]'       append
 *
 * `marker` identifies the challenge by a substring of its seeded cases;
 * `family` recognises later appends, which do not repeat the marker.
 */
function casesFor(marker: string, family: RegExp): TestCase[] {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let cases: TestCase[] = [];

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');

    // End on the SQL cast, not on the first `]` — that one closes an expected
    // value like "[0, 1]", and a lazy match there yields unparseable JSON.
    for (const match of sql.matchAll(/'(\[.*?\])'::jsonb/gs)) {
      // Migrations double single quotes for SQL; undo that before parsing.
      const json = match[1].replace(/''/g, "'");

      let parsed: TestCase[];
      try {
        parsed = JSON.parse(json);
      } catch {
        continue; // not a test_cases array — constraints, hints, and so on
      }
      if (!Array.isArray(parsed) || !parsed.every((c) => typeof c?.input === 'string')) continue;

      const before = sql.slice(Math.max(0, match.index - 80), match.index);
      const isAppend = /test_cases\s*=\s*test_cases\s*\|\|\s*$/.test(before);

      if (isAppend) {
        // Only ours if we are already tracking this challenge and the appended
        // rows are the same shape of input.
        if (cases.length > 0 && parsed.every((c) => family.test(c.input))) {
          cases = [...cases, ...parsed];
        }
      } else if (parsed.some((c) => c.input.includes(marker))) {
        cases = parsed;
      }
    }
  }
  return cases;
}

// ---------------------------------------------------------------- Two Sum ---

const TWO_SUM_MARKER = '[2,7,11,15], 9';

function parseTwoSumInput(input: string): { nums: number[]; target: number } {
  const match = input.match(/^\s*\[([^\]]*)\]\s*,\s*(-?\d+)\s*$/);
  if (!match) throw new Error(`unparseable Two Sum input: ${input}`);
  return {
    nums: match[1].split(',').map((n) => Number(n.trim())),
    target: Number(match[2]),
  };
}

function validPairs(nums: number[], target: number): number[][] {
  const pairs: number[][] = [];
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) pairs.push([i, j]);
    }
  }
  return pairs;
}

/** The textbook answer: return as soon as the complement has been seen. */
function canonicalTwoSum(nums: number[], target: number): number[] {
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need)!, i];
    seen.set(nums[i], i);
  }
  return [];
}

describe('Two Sum challenge test data', () => {
  const cases = casesFor(TWO_SUM_MARKER, /^\s*\[[-\d,\s]*\]\s*,\s*-?\d+\s*$/);

  it('is present and parseable in the migrations', () => {
    expect(cases.length).toBeGreaterThanOrEqual(4);
  });

  it.each(cases.map((c, i) => [i + 1, c] as const))(
    'case %i has exactly one valid answer',
    (_n, testCase) => {
      const { nums, target } = parseTwoSumInput(testCase.input);
      // More than one and the stored expectation is arbitrary; zero and the
      // challenge is unsolvable.
      expect(validPairs(nums, target)).toHaveLength(1);
    },
  );

  it.each(cases.map((c, i) => [i + 1, c] as const))(
    'case %i is what the canonical hash-map solution returns',
    (_n, testCase) => {
      const { nums, target } = parseTwoSumInput(testCase.input);
      expect(canonicalTwoSum(nums, target)).toEqual(JSON.parse(testCase.expected));
    },
  );
});

// --------------------------------------------------------- Pandas filter ---

const FILTER_MARKER = "'sales': [100,200,50,300]";

function parseFilterInput(input: string): { sales: number[]; threshold: number } {
  const sales = input.match(/'sales':\s*\[([^\]]*)\]/);
  const threshold = input.match(/,\s*(\d+)\s*$/);
  if (!sales || !threshold) throw new Error(`unparseable filter input: ${input}`);
  return {
    sales: sales[1].split(',').map((n) => Number(n.trim())),
    threshold: Number(threshold[1]),
  };
}

describe('Pandas DataFrame Filter challenge test data', () => {
  const cases = casesFor(FILTER_MARKER, /pd\.DataFrame/);

  it('is present and parseable in the migrations', () => {
    expect(cases.length).toBeGreaterThanOrEqual(4);
  });

  it('exercises the threshold boundary, so ">=" cannot pass as ">"', () => {
    // The only input on which the two operators differ is one where a value
    // sits exactly on the threshold. Without it the suite cannot tell them apart.
    const boundaryTested = cases.some((c) => {
      const { sales, threshold } = parseFilterInput(c.input);
      return sales.includes(threshold);
    });
    expect(boundaryTested).toBe(true);
  });

  it.each(cases.map((c, i) => [i + 1, c] as const))(
    'case %i expects strictly-greater rows',
    (_n, testCase) => {
      const { sales, threshold } = parseFilterInput(testCase.input);
      const expected = JSON.parse(testCase.expected) as Array<{ sales: number }>;
      expect(expected.map((r) => r.sales)).toEqual(sales.filter((s) => s > threshold));
    },
  );
});
