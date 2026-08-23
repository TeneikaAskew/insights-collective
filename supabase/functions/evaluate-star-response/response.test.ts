// ABOUTME: Spec for reading the model's reply — each way generation can end gets
// ABOUTME: its own named failure instead of one generic one. Run: deno test
import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { EvaluationResponseError, readEvaluation } from './response.ts';

const MAX_TOKENS = 3000;

function completion(finish_reason: string, content: unknown, usage?: unknown) {
  return { choices: [{ finish_reason, message: { content } }], usage };
}

function codeOf(result: unknown): string {
  const error = assertThrows(() => readEvaluation(result, MAX_TOKENS), EvaluationResponseError);
  return (error as EvaluationResponseError).code;
}

Deno.test('a completed reply parses', () => {
  const payload = { scores: { situation: 4, task: 3, action: 4, result: 2 } };
  assertEquals(readEvaluation(completion('stop', JSON.stringify(payload)), MAX_TOKENS), payload);
});

// This is the case that used to surface as "Failed to parse AI response". The
// content is a JSON fragment with no closing brace, so the old first-`{`-to-last-`}`
// salvage failed on it and the user was told to try again with no hint that the
// real problem was length.
Deno.test('truncation is reported as truncation', () => {
  const cut = completion('length', '{"scores": {"situation": 4', {
    completion_tokens: 3000,
    completion_tokens_details: { reasoning_tokens: 2800 },
  });
  assertEquals(codeOf(cut), 'truncated');
});

Deno.test('any other ending names itself', () => {
  assertEquals(codeOf(completion('content_filter', '{}')), 'unexpected_finish');
  assertEquals(codeOf(completion('tool_calls', '{}')), 'unexpected_finish');
});

Deno.test('an empty choices array does not throw a TypeError', () => {
  assertEquals(codeOf({ choices: [] }), 'empty_response');
  assertEquals(codeOf({}), 'empty_response');
});

Deno.test('empty or non-string content is refused', () => {
  for (const content of ['', '   ', null, undefined, 42, { already: 'parsed' }]) {
    assertEquals(codeOf(completion('stop', content)), 'empty_response');
  }
});

// With a json_schema response format this should be unreachable. If it ever
// fires, the constraint did not hold, and re-admitting the greedy regex salvage
// would hide exactly that.
Deno.test('unparseable content fails loudly rather than being salvaged', () => {
  assertEquals(codeOf(completion('stop', 'Here is my evaluation: {"scores": {}} — hope it helps!')), 'unparseable');
});
