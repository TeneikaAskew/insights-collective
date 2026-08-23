// ABOUTME: Spec for STAR score normalisation — the rules that decide what a user
// ABOUTME: is shown when the model misbehaves. Run: deno test
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { clampScore, normalizeScores, SCORE_SCALE } from './scoring.ts';

Deno.test('the scale is the rubric\'s own 1-5', () => {
  assertEquals(SCORE_SCALE, 5);
});

Deno.test('clampScore repairs what the model can plausibly get wrong', () => {
  // Out of range. The model has returned a 9 and an 8.2 under a 1-5 prompt, and
  // the bar is drawn as a percentage of the scale, so an unclamped 9 overflows.
  assertEquals(clampScore(9), 5);
  assertEquals(clampScore(8.2), 5);
  assertEquals(clampScore(10), 5);
  assertEquals(clampScore(0), 1);
  assertEquals(clampScore(-3), 1);

  // In range, fractional.
  assertEquals(clampScore(3.4), 3);
  assertEquals(clampScore(3.5), 4);
  assertEquals(clampScore(2.5), 3);

  // Quoted numbers — models do this.
  assertEquals(clampScore('4'), 4);
  assertEquals(clampScore('2.6'), 3);

  // Already correct.
  assertEquals(clampScore(1), 1);
  assertEquals(clampScore(5), 5);
});

Deno.test('clampScore refuses what it cannot honestly repair', () => {
  // Scoring any of these 1 would tell the user their answer was the worst
  // possible when the model simply failed to produce a score.
  for (const bad of [null, undefined, '', '   ', 'n/a', '4abc', NaN, Infinity, -Infinity]) {
    assertEquals(clampScore(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
  // Number() coerces these to finite numbers (0, 0, 1, 0, 5). Rejecting by type
  // is what stops a malformed payload from being scored.
  for (const bad of [{}, [], true, false, [5]]) {
    assertEquals(clampScore(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

Deno.test('normalizeScores recomputes the overall as the average', () => {
  // The model's own overall is ignored — here it claims 1 and the components say 5.
  assertEquals(
    normalizeScores({ situation: 5, task: 5, action: 5, result: 5, overall: 1 }),
    { situation: 5, task: 5, action: 5, result: 5, overall: 5 },
  );
  // Mixed components producing an odd overall: impossible under the old scale,
  // which doubled a 1-5 rubric and so could only ever emit even numbers.
  assertEquals(
    normalizeScores({ situation: 4, task: 3, action: 4, result: 2 }),
    { situation: 4, task: 3, action: 4, result: 2, overall: 3 },
  );
  // Out-of-range components are clamped before they reach the average.
  assertEquals(
    normalizeScores({ situation: 9, task: 8.2, action: 0, result: 3 }),
    { situation: 5, task: 5, action: 1, result: 3, overall: 4 },
  );
});

Deno.test('normalizeScores rejects a payload it cannot score', () => {
  assertEquals(normalizeScores(undefined), null);
  assertEquals(normalizeScores(null), null);
  assertEquals(normalizeScores({}), null);
  // One missing component is enough: the page renders all four.
  assertEquals(normalizeScores({ situation: 4, task: 4, action: 4 }), null);
  assertEquals(normalizeScores({ situation: 4, task: 4, action: 4, result: null }), null);
});
