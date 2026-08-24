// ABOUTME: The JSON Schema the model must answer in, so an out-of-range or
// ABOUTME: missing score cannot be produced rather than being repaired after.
// ABOUTME: Sent as `response_format: {type: "json_schema"}` on the Groq call.

import { SCORE_SCALE } from "./scoring.ts";

// The rubric's own level names, in score order. Used when `assesment_rubric`
// returns nothing for an area — the prompt used to ask for
// "Exceptional|Strong|Adequate|Limited|Poor", a vocabulary the rubric it was
// scoring against does not contain, and the six stored assessment evaluations
// duly came back saying "Adequate" and "Strong".
export const DEFAULT_PERFORMANCE_LEVELS = [
  "Concern",
  "Mild Concern",
  "Mixed",
  "Mild Strength",
  "Strength",
];

// The decoder enforces `minimum`/`maximum`, so this is the whole reason a 9 is
// impossible. Verified against openai/gpt-oss-120b: told to emit 9s and 10s it
// returned 5s, and with the bound set to 3 it returned 3s.
const score = { type: "integer", minimum: 1, maximum: SCORE_SCALE };

const text = { type: "string" };

function object(properties: Record<string, unknown>) {
  return {
    type: "object",
    properties,
    // `strict: true` has no notion of an optional field: everything listed must
    // also be required, and nothing outside the list may appear.
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function stringList(minItems: number, maxItems: number) {
  return { type: "array", items: text, minItems, maxItems };
}

// `overall` is deliberately absent. The server recomputes it as the average of
// the four components, so asking the model for it spends tokens on a number that
// is thrown away and invites it to disagree with its own arithmetic.
const scores = object({
  situation: score,
  task: score,
  action: score,
  result: score,
});

const analysis = object({
  completeness: text,
  specificity: text,
  relevance: text,
  impact: text,
  communication: text,
});

// The page renders exactly three suggestions and iterates the other two lists,
// so the counts the prompt used to request in prose are expressed here instead,
// where they are enforced.
const feedback = object({
  strengths: stringList(3, 5),
  improvements: stringList(3, 5),
  suggestions: stringList(3, 3),
});

export interface EvaluationSchema {
  name: string;
  strict: boolean;
  schema: Record<string, unknown>;
}

/**
 * The response schema for a STAR evaluation.
 *
 * Two shapes rather than one optional field: a standard behavioural question has
 * no assessment area, and `strict: true` would force the model to invent
 * rubric commentary for it.
 */
export function starEvaluationSchema(
  options: { assessment: false } | { assessment: true; levels?: string[] },
): EvaluationSchema {
  if (!options.assessment) {
    return {
      name: "star_evaluation",
      strict: true,
      schema: object({ scores, analysis, feedback }),
    };
  }

  const levels = options.levels?.length ? options.levels : DEFAULT_PERFORMANCE_LEVELS;

  const assessment_evaluation = object({
    performance_level: { type: "string", enum: levels },
    performance_score: score,
    competency_demonstration: text,
    behavioral_indicators: stringList(2, 5),
    development_areas: stringList(2, 5),
  });

  return {
    name: "star_assessment_evaluation",
    strict: true,
    schema: object({ scores, assessment_evaluation, analysis, feedback }),
  };
}

/** The `response_format` body field for a Groq chat completion. */
export function responseFormat(schema: EvaluationSchema) {
  return { type: "json_schema", json_schema: schema };
}
