// ABOUTME: Spec for STAR score validation — what a schema-constrained model is
// ABOUTME: allowed to return, and what disqualifies an evaluation. Run: deno test
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { assertScore, normalizeScores, SCORE_SCALE } from './scoring.ts';

Deno.test('the scale is the rubric\'s own 1-5', () => {
  assertEquals(SCORE_SCALE, 5);
});

Deno.test('assertScore accepts exactly the integers the schema allows', () => {
  for (const valid of [1, 2, 3, 4, 5]) {
    assertEquals(assertScore(valid), valid);
  }
});

// Every one of these used to be silently repaired: 9 and 8.2 clamped to 5, 0 and
// -3 raised to 1, "4" coerced, 3.5 rounded. That repair was compensating for a
// prompt that only *asked* for 1-5. The response format now constrains the
// decoder, so a value outside the scale means the constraint failed — and
// turning it into a 5 would hide that from everyone.
Deno.test('assertScore rejects what the schema should have prevented', () => {
  for (const outOfRange of [0, -3, 6, 9, 10]) {
    assertEquals(assertScore(outOfRange), null, `expected null for ${outOfRange}`);
  }
  for (const fractional of [3.5, 8.2, 2.6]) {
    assertEquals(assertScore(fractional), null, `expected null for ${fractional}`);
  }
  // A strict integer field cannot emit a quoted number, so accepting one would
  // be accepting a broken contract.
  for (const quoted of ['4', '2.6', '', '  ', 'n/a']) {
    assertEquals(assertScore(quoted), null, `expected null for ${JSON.stringify(quoted)}`);
  }
  // Number() turns these into finite numbers (0, 0, 1, 0, 5), which is why
  // acceptance is by type rather than by coercion.
  for (const wrongType of [null, undefined, {}, [], true, false, [5], NaN, Infinity]) {
    assertEquals(assertScore(wrongType), null, `expected null for ${JSON.stringify(wrongType)}`);
  }
});

Deno.test('normalizeScores computes the overall as the average', () => {
  const result = normalizeScores({ situation: 4, task: 3, action: 4, result: 2 });
  assert(result.ok);
  // A mixed set producing an odd overall — impossible under the old scale, which
  // doubled a 1-5 rubric and so could only ever emit even numbers.
  assertEquals(result.scores, { situation: 4, task: 3, action: 4, result: 2, overall: 3 });
});

Deno.test('normalizeScores ignores an overall the model volunteers', () => {
  // `overall` is not in the schema, but nothing stops a payload carrying one.
  const result = normalizeScores({ situation: 5, task: 5, action: 5, result: 5, overall: 1 });
  assert(result.ok);
  assertEquals(result.scores.overall, 5);
});

Deno.test('normalizeScores reaches both ends of the scale', () => {
  const floor = normalizeScores({ situation: 1, task: 1, action: 1, result: 1 });
  assert(floor.ok);
  assertEquals(floor.scores.overall, 1);

  const ceiling = normalizeScores({ situation: 5, task: 5, action: 5, result: 5 });
  assert(ceiling.ok);
  assertEquals(ceiling.scores.overall, SCORE_SCALE);
});

Deno.test('normalizeScores names the field and the value it rejected', () => {
  const result = normalizeScores({ situation: 9, task: 3, action: 4, result: 2 });
  assert(!result.ok);
  assertEquals(result.reasons, ['situation was 9, outside 1-5']);
});

Deno.test('normalizeScores collects every violation, not just the first', () => {
  // One log line should describe the whole payload rather than leading to a
  // fix-one-rerun loop.
  const result = normalizeScores({ situation: 9, task: '3', action: 4.5 });
  assert(!result.ok);
  assertEquals(result.reasons, [
    'situation was 9, outside 1-5',
    'task was "3" (string), not a number',
    'action was 4.5, not a whole number',
    'result was missing',
  ]);
});

Deno.test('normalizeScores rejects a payload with no scores at all', () => {
  for (const empty of [undefined, null, {}]) {
    const result = normalizeScores(empty);
    assert(!result.ok, `expected rejection for ${JSON.stringify(empty)}`);
    assertEquals(result.reasons.length, 4);
  }
});
