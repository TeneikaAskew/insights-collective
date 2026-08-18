// Guards the challenge test data seeded by supabase/migrations, which no other
// test covers: it is SQL, so typecheck and the component tests never read it.
//
// The bug this exists for: Two Sum's `[-1,0,1,2], 1` case had TWO right answers
// ([0,3] and [1,2]) while compare_mode is 'exact'. The canonical single-pass
// hash map returns [1,2], so the challenge failed everyone who solved it the
// standard way. It surfaced only because an AI-judged submission came back 3/4
// and the judge turned out to be correct.
//
// A test case with more than one valid answer is unfixable at grading time —
// whichever value is stored, some correct solution disagrees with it. So the
// assertion is on the data, not on the grader.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = 'supabase/migrations';

/** The seeded challenges, read from whichever migration last wrote each one. */
function twoSumCases(): Array<{ input: string; expected: string }> {
  // Later migrations override earlier ones, so scan in version order and keep
  // the last block that carries Two Sum's cases.
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let latest: Array<{ input: string; expected: string }> | null = null;
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    // Every Two Sum case list starts with the [2,7,11,15] case. Anchor the end
    // on the SQL cast, not on the first `]` — that one closes an expected value
    // like "[0, 1]", and a lazy match there yields unparseable JSON.
    const block = sql.match(/'(\[\s*\{"input": "\[2,7,11,15\], 9".*?\])'::jsonb/s);
    if (block) {
      try {
        latest = JSON.parse(block[1]);
      } catch {
        // A block we cannot parse is itself worth failing on below.
        latest = null;
      }
    }
  }
  return latest ?? [];
}

/** Parse `"[2,7,11,15], 9"` into its list and target. */
function parseInput(input: string): { nums: number[]; target: number } {
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
function canonicalSolution(nums: number[], target: number): number[] {
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need)!, i];
    seen.set(nums[i], i);
  }
  return [];
}

describe('Two Sum challenge test data', () => {
  const cases = twoSumCases();

  it('is present and parseable in the migrations', () => {
    expect(cases.length).toBeGreaterThanOrEqual(4);
  });

  it.each(cases.map((c, i) => [i + 1, c] as const))(
    'case %i has exactly one valid answer',
    (_n, testCase) => {
      const { nums, target } = parseInput(testCase.input);
      const pairs = validPairs(nums, target);
      // More than one and the stored expectation is arbitrary; zero and the
      // challenge is unsolvable.
      expect(pairs).toHaveLength(1);
    },
  );

  it.each(cases.map((c, i) => [i + 1, c] as const))(
    'case %i is what the canonical hash-map solution returns',
    (_n, testCase) => {
      const { nums, target } = parseInput(testCase.input);
      expect(canonicalSolution(nums, target)).toEqual(JSON.parse(testCase.expected));
    },
  );
});
