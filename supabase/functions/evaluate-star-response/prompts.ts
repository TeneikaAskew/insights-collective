// ABOUTME: The two evaluation prompts. Extracted from index.ts so they can be
// ABOUTME: imported without booting the server — by tests, and by the re-scoring
// ABOUTME: probe, which must run the real prompt rather than a copy of it.
//
// These carry content instructions only. The SHAPE of the reply is the schema's
// job now (see schema.ts): the embedded JSON templates and the "Return ONLY the
// JSON object" lines that used to live here could silently disagree with it.

export function createAssessmentEvaluationPrompt(response: any, questionData: any, assessmentArea: string, rubricCriteria: any[]): string {
  const rubricText = rubricCriteria && rubricCriteria.length > 0 ?
    rubricCriteria.map(criteria =>
      `${criteria.performance_level} (Score: ${criteria.score}): ${criteria.criteria_description}`
    ).join('\n') :
    // The rubric's own vocabulary, so the prompt and the schema's enum agree.
    // This fallback used to say Exceptional/Strong/Adequate/Limited/Poor, words
    // `assesment_rubric` does not contain, and the stored assessment
    // evaluations duly came back labelled "Adequate" and "Strong".
    `Assessment scoring guidelines:
5 - Strength: consistently and clearly demonstrates ${assessmentArea}
4 - Mild Strength: demonstrates ${assessmentArea} with a minor gap
3 - Mixed: some evidence of ${assessmentArea}, inconsistent or generic
2 - Mild Concern: limited evidence of ${assessmentArea}
1 - Concern: no usable evidence of ${assessmentArea}`;

  return `You are an expert behavioral interviewer evaluating this STAR response for: ${assessmentArea}

Question: ${questionData.question}
Assessment Area: ${assessmentArea}

STAR Response:
Situation: ${response.situation}
Task: ${response.task}
Action: ${response.action}
Result: ${response.result}

Evaluation Criteria:
${rubricText}

SCORING:
Score each component against ${assessmentArea} using the levels above:
- Situation: how well the context demonstrates relevance to ${assessmentArea}
- Task: how clearly the challenge shows ${assessmentArea} requirements
- Action: how effectively the specific actions demonstrate ${assessmentArea}
- Result: how well the outcomes show impact and ${assessmentArea} success

FEEDBACK — BE SPECIFIC:
- Strengths: cite concrete details from the response, not generic praise
- Improvements: name the specific gap and why it weakens the answer for ${assessmentArea}
- Suggestions: actionable, with the reasoning behind each one, ideally showing how
  to quantify impact

Every strength, improvement and suggestion must reference something the candidate
actually wrote.`;
}

export function createStandardEvaluationPrompt(response: any, questionData: any): string {
  return `You are an expert interview coach evaluating this STAR response.

Question: ${questionData.question}
Target Competency: ${questionData.targetCompetency}

STAR Response:
Situation: ${response.situation}
Task: ${response.task}
Action: ${response.action}
Result: ${response.result}

SCORING:
Score each component on these anchors:
5 - Strength: specific, complete, and quantified
4 - Mild Strength: strong, with one minor gap
3 - Mixed: adequate but generic or missing detail
2 - Mild Concern: vague or incomplete
1 - Concern: missing or unusable

Judge each on its own terms:
- Situation: how well the context is established and relevant
- Task: how clearly the challenge and your responsibility are explained
- Action: how effectively the specific actions are described
- Result: how well outcomes are quantified and demonstrate impact

FEEDBACK — BE SPECIFIC:
- Strengths: cite concrete details from the response, not generic praise
- Improvements: name the specific gap and why it weakens the answer
- Suggestions: actionable, with the reasoning behind each one, ideally showing how
  to quantify impact

Every strength, improvement and suggestion must reference something the candidate
actually wrote.`;
}
