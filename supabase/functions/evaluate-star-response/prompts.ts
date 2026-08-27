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

${CALIBRATION_RULES}

FEEDBACK — BE SPECIFIC:
- Strengths: cite concrete details from the response, not generic praise
- Improvements: name the specific gap and why it weakens the answer for ${assessmentArea}
- Suggestions: actionable, with the reasoning behind each one, ideally showing how
  to quantify impact

Every strength, improvement and suggestion must reference something the candidate
actually wrote.`;
}

// Calibration rules appended to BOTH prompts, after their band definitions.
// Each clause exists because the graded-ladder probe
// (scripts/probe/star-scoring-calibration.ts) showed the model drifting without
// it: scoring a component up because the rest of the story was vivid, and
// hugging 2-4 so hard that neither a 1 nor honest band-picking happened.
const CALIBRATION_RULES = `Score each component on its own text alone. A strong Result cannot raise a weak
Situation, and a vivid story elsewhere never compensates for a component that
contains no evidence itself. A component of one fragment or placeholder ("At my
job", "I ran some code", "It went well") earns the bottom score even though
words are present: text that is present but content-free is a 1, not a 2. Use
the whole scale — a practice tool that never returns a 1 or a 5 teaches
nothing — and when a component sits between two bands, pick the band whose
definition it actually meets rather than defaulting to the middle.`;

// The standard prompt's band anchors. Deliberately evidence-based — each band is
// defined by what the text contains, not by how it feels — because the model
// grades on vibes exactly where the anchors let it. Each boundary is hinged on
// one observable property, because that is what the graded-ladder probe showed
// the model actually applies:
//
//   1|2 hinges on retrievable content. Under the old anchor ("missing or
//   unusable") the model read "missing" literally, so any text at all — "At my
//   job." — earned a 2, and a 1 was unreachable in practice.
//
//   3|4 hinges on quantification. With both bands defined by adjectives
//   ("adequate", "strong"), a concrete-but-unquantified answer drifted up to 4.
//
//   4|5 hinges on judgment shown — validation, stakeholder handling, durable
//   change. Without that gate "specific, complete, and quantified" made 5 the
//   grade for any answer with numbers in it, and the two strongest rungs of the
//   ladder scored identically. The gate is stated as a cap ("numbers alone cap
//   at 4"), plus the no-inference rule, because as a mere description the model
//   credited judgment it had inferred rather than read.
const SCORING_ANCHORS = `Score each component 1-5 against these anchors:
5 - Strength: quantified AND shows judgment beyond execution — validating the
    work, navigating the people involved, or leaving durable change behind.
4 - Mild Strength: specific and quantified (numbers, counts, or time frames),
    but mechanical — competent execution with magnitudes, and nothing above
    execution: no validation, no stakeholder handling, no evidence the change
    stuck. Numbers alone cap a component at 4.
3 - Mixed: concrete and credible — real events, named systems or methods — but
    unquantified: nothing conveys the scale of the problem or the size of the
    outcome.
2 - Mild Concern: complete sentences that are interchangeable filler: no
    numbers, no named systems or stakeholders, no mechanism. The reader learns
    almost nothing that distinguishes this candidate.
1 - Concern: gives an interviewer nothing to probe — a fragment or placeholder
    with no retrievable content.

Score only what is written: if a quality has to be inferred, it is absent.

${CALIBRATION_RULES}`;

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
${SCORING_ANCHORS}

A component earns its 5 only when its own text clears the bar for that component:
- Situation: quantified scale AND the stakes — who cared, and what argument or
  cost made this matter
- Task: the candidate's own responsibility AND a constraint harder than a
  deadline — credibility, competing owners, a bar the deliverable had to clear
- Action: the concrete mechanism AND visible judgment around it — how the work
  was validated or how the people involved were brought along; a well-described
  method with neither caps at 4
- Result: quantified outcomes AND durability — a process, report, or definition
  that outlived the project; numbers whose effect simply persisted cap at 4

FEEDBACK — BE SPECIFIC:
- Strengths: cite concrete details from the response, not generic praise
- Improvements: name the specific gap and why it weakens the answer
- Suggestions: actionable, with the reasoning behind each one, ideally showing how
  to quantify impact

Every strength, improvement and suggestion must reference something the candidate
actually wrote.`;
}
