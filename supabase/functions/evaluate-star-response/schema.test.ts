// ABOUTME: Spec for the response schema — the structural invariants that make an
// ABOUTME: out-of-range or missing score impossible. Run: deno test
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { DEFAULT_PERFORMANCE_LEVELS, responseFormat, starEvaluationSchema } from './schema.ts';
import { SCORE_SCALE } from './scoring.ts';

type Obj = Record<string, any>;

/** Every object in the tree must be closed and fully required. */
function walkObjects(node: any, path: string, visit: (o: Obj, path: string) => void) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'object') {
    visit(node, path);
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      walkObjects(child, `${path}.${key}`, visit);
    }
  }
  if (node.type === 'array') walkObjects(node.items, `${path}[]`, visit);
}

Deno.test('every object is closed and lists every property as required', () => {
  for (const schema of [
    starEvaluationSchema({ assessment: false }).schema,
    starEvaluationSchema({ assessment: true }).schema,
  ]) {
    walkObjects(schema, 'root', (obj, path) => {
      // `strict: true` has no optional fields: anything not required, and
      // anything not closed, is a hole the model can produce a surprise through.
      assertEquals(obj.additionalProperties, false, `${path} is not closed`);
      assertEquals(
        [...(obj.required ?? [])].sort(),
        Object.keys(obj.properties ?? {}).sort(),
        `${path} does not require every property`,
      );
    });
  }
});

Deno.test('every score is an integer bounded to the rubric scale', () => {
  const { scores } = starEvaluationSchema({ assessment: false }).schema.properties as Obj;
  for (const field of ['situation', 'task', 'action', 'result']) {
    assertEquals(scores.properties[field], { type: 'integer', minimum: 1, maximum: SCORE_SCALE });
  }
});

// The server recomputes the mean, so asking the model for a number it then
// discards spends tokens and invites it to disagree with its own arithmetic —
// which is how the stored 8.2 came to sit beside a 9, 7, 8, 8.
Deno.test('overall is not asked for', () => {
  const { scores } = starEvaluationSchema({ assessment: false }).schema.properties as Obj;
  assertEquals('overall' in scores.properties, false);
});

Deno.test('the feedback counts the page depends on are enforced', () => {
  const { feedback } = starEvaluationSchema({ assessment: false }).schema.properties as Obj;
  assertEquals(feedback.properties.strengths.minItems, 3);
  assertEquals(feedback.properties.strengths.maxItems, 5);
  assertEquals(feedback.properties.improvements.minItems, 3);
  // The rail renders exactly three.
  assertEquals(feedback.properties.suggestions.minItems, 3);
  assertEquals(feedback.properties.suggestions.maxItems, 3);
});

Deno.test('the five analysis keys the page dereferences are all required', () => {
  const { analysis } = starEvaluationSchema({ assessment: false }).schema.properties as Obj;
  assertEquals(
    [...analysis.required].sort(),
    ['communication', 'completeness', 'impact', 'relevance', 'specificity'],
  );
});

Deno.test('the two variants differ only by assessment_evaluation', () => {
  const standard = Object.keys(starEvaluationSchema({ assessment: false }).schema.properties as Obj);
  const assessment = Object.keys(starEvaluationSchema({ assessment: true }).schema.properties as Obj);
  assertEquals(standard.sort(), ['analysis', 'feedback', 'scores']);
  assertEquals(assessment.sort(), ['analysis', 'assessment_evaluation', 'feedback', 'scores']);
});

// The prompt used to ask for "Exceptional|Strong|Adequate|Limited|Poor", a
// vocabulary `assesment_rubric` does not contain, and the stored assessment
// evaluations duly came back saying "Adequate" and "Strong".
Deno.test('performance_level is constrained to the rubric levels it was given', () => {
  const levels = ['Concern', 'Mild Concern', 'Mixed', 'Mild Strength', 'Strength'];
  const { assessment_evaluation } = starEvaluationSchema({ assessment: true, levels }).schema
    .properties as Obj;
  assertEquals(assessment_evaluation.properties.performance_level.enum, levels);
});

Deno.test('performance_level falls back to the canonical levels', () => {
  for (const levels of [undefined, []]) {
    const { assessment_evaluation } = starEvaluationSchema({ assessment: true, levels }).schema
      .properties as Obj;
    assertEquals(
      assessment_evaluation.properties.performance_level.enum,
      DEFAULT_PERFORMANCE_LEVELS,
    );
  }
});

Deno.test('responseFormat is the shape the Groq body expects', () => {
  const schema = starEvaluationSchema({ assessment: false });
  const format = responseFormat(schema) as Obj;
  assertEquals(format.type, 'json_schema');
  assertEquals(format.json_schema.name, 'star_evaluation');
  assert(format.json_schema.strict);
});
