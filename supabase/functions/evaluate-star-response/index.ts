
// ABOUTME: Edge function to evaluate STAR responses using AI and provide detailed feedback
// ABOUTME: Handles both assessment questions with rubric scoring and standard behavioral questions

// Follow Deno and Edge Functions v2 URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, handleError } from "../_shared/utils.ts";
import { requireUser } from "../_shared/auth.ts";
import { callGroq, GroqRateLimitError, rateLimitResponse } from "../_shared/groq.ts";
import { normalizeScores, SCORE_SCALE } from "./scoring.ts";
import { responseFormat, starEvaluationSchema } from "./schema.ts";
import { EvaluationResponseError, readEvaluation } from "./response.ts";

// Measured: 775 completion tokens for a standard evaluation, 1,581 for an
// assessment one, reasoning included. Named so the truncation log can report the
// ceiling it hit rather than leaving that to be looked up.
const MAX_TOKENS = 3000;

const GROQ = Deno.env.get("GROQ");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function createAssessmentEvaluationPrompt(response: any, questionData: any, assessmentArea: string, rubricCriteria: any[]): string {
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

function createStandardEvaluationPrompt(response: any, questionData: any): string {
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

async function evaluateStarResponse(responseId: string, callerId: string) {
  console.log(`[evaluate-star-response] Starting evaluation for response ID: ${responseId}`);

  try {
    // Create Supabase client with service role key for admin access
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    console.log(`[evaluate-star-response] Supabase client created successfully`);

    // Fetch the STAR response first
    console.log(`[evaluate-star-response] Fetching STAR response with ID: ${responseId}`);
    const { data: starResponse, error: responseError } = await supabase
      .from("star_responses")
      .select("*")
      .eq("id", responseId)
      .single();

    if (responseError) {
      console.error(`[evaluate-star-response] Error fetching STAR response:`, responseError);
      throw handleError(responseError);
    }

    if (!starResponse) {
      console.error(`[evaluate-star-response] STAR response not found with ID: ${responseId}`);
      throw new Error("STAR response not found");
    }

    // The client above is service-role and bypasses RLS, so ownership has to be
    // re-checked here. Without it, a bare response id was enough to read anyone's
    // interview answers and overwrite their feedback.
    if (starResponse.user_id !== callerId) {
      console.warn(`[evaluate-star-response] Caller ${callerId} does not own response ${responseId}`);
      throw new Error("STAR response not found");
    }

    console.log(`[evaluate-star-response] STAR response fetched successfully`);

    // Get the related question based on question_id
    let questionData = null;
    let targetCompetency = "Behavioral competency";
    let questionText = "Behavioral interview question";
    let isAssessmentQuestion = false;
    let assessmentArea = null;

    // Get the question from study guide questions
    if (starResponse.question_id) {
      console.log(`[evaluate-star-response] Fetching related question with ID: ${starResponse.question_id}`);
      
      const { data: studyGuides, error: studyGuidesError } = await supabase
        .from("study_guides")
        .select("questions, assessment_areas")
        .eq("user_id", starResponse.user_id);
        
      if (studyGuidesError) {
        console.warn(`[evaluate-star-response] Error fetching study guides: ${studyGuidesError.message}`);
      } else if (studyGuides && studyGuides.length > 0) {
        // Look through all questions in all study guides for this user
        for (const guide of studyGuides) {
          if (guide.questions && Array.isArray(guide.questions)) {
            const matchingQuestion = guide.questions.find(q => q.id === starResponse.question_id);
            if (matchingQuestion) {
              console.log(`[evaluate-star-response] Found matching question in study guide`);
              questionData = matchingQuestion;
              questionText = matchingQuestion.question || questionText;
              targetCompetency = matchingQuestion.targetCompetency || targetCompetency;
              isAssessmentQuestion = matchingQuestion.isAssessmentQuestion || false;
              assessmentArea = matchingQuestion.assessmentArea;
              break;
            }
          }
        }
      }

      if (!questionData) {
        console.warn(`[evaluate-star-response] Could not find question in study guides, using defaults`);
      }
    }

    // Make the defaults the warning above promises real. They were computed and
    // then never used: the null questionData went straight into
    // createStandardEvaluationPrompt, which reads `questionData.question`, so
    // the function answered 500 on a path it had explicitly decided to survive.
    //
    // Not a synthetic case. It is reached whenever a saved answer outlives the
    // study guide it came from — regenerate a guide for the same job and the
    // question ids change, so every earlier answer stops resolving — and by any
    // response stored with no question_id at all.
    if (!questionData) {
      questionData = { question: questionText, targetCompetency };
    }

    // Get rubric criteria if it's an assessment question
    let rubricCriteria = [];
    if (isAssessmentQuestion && assessmentArea) {
      console.log(`[evaluate-star-response] Fetching rubric criteria for assessment area: ${assessmentArea}`);
      const { data: rubric, error: rubricError } = await supabase
        .from('assesment_rubric')
        .select('*')
        .eq('assessment_area', assessmentArea)
        .order('score', { ascending: true });
        
      if (rubricError) {
        console.warn(`[evaluate-star-response] Error fetching rubric: ${rubricError.message}`);
      } else {
        rubricCriteria = rubric || [];
        console.log(`[evaluate-star-response] Found ${rubricCriteria.length} rubric criteria`);
      }
    }

    // Create the appropriate evaluation prompt
    const evaluationPrompt = isAssessmentQuestion ? 
      createAssessmentEvaluationPrompt(starResponse, questionData, assessmentArea, rubricCriteria) :
      createStandardEvaluationPrompt(starResponse, questionData);
      
    console.log(`[evaluate-star-response] Using ${isAssessmentQuestion ? 'assessment' : 'standard'} evaluation prompt`);

    // Call the AI model to evaluate the STAR response
    console.log(`[evaluate-star-response] Calling AI API to evaluate STAR response`);

    // The shape is a constraint now, not a request. The decoder enforces the
    // integer bounds, so a score outside 1-5 and a missing field are both
    // impossible rather than something to repair after the fact.
    const evaluationSchema = isAssessmentQuestion
      ? starEvaluationSchema({
          assessment: true,
          // The rubric's own level names, so the enum matches what this response
          // was actually scored against.
          levels: rubricCriteria.map((criteria: any) => criteria.performance_level).filter(Boolean),
        })
      : starEvaluationSchema({ assessment: false });

    const result = await callGroq(GROQ!, {
        // Replaces llama3-8b-8192, decommissioned 2025-08-30, which had been
        // returning 400 on every submission and 500ing this function since.
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: isAssessmentQuestion ?
              `You are an expert behavioral interviewer specializing in evaluating responses against specific assessment competencies. You understand the nuanced behavioral indicators that distinguish different performance levels. Provide specific, actionable feedback with concrete examples from the actual response content.` :
              `You are an interview coach specializing in evaluating STAR (Situation, Task, Action, Result) responses. Provide detailed, objective feedback with specific examples from the actual response content and actionable suggestions.`
          },
          {
            role: "user",
            content: evaluationPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: MAX_TOKENS,
        response_format: responseFormat(evaluationSchema)
    }, "evaluate-star-response");

    console.log(`[evaluate-star-response] AI API response received successfully`);

    // Checks how generation ended before trusting the content, so a run that hit
    // the token ceiling is reported as truncation instead of as a parse failure.
    const feedbackData = readEvaluation(result, MAX_TOKENS) as any;

    // The schema already forbids anything but an integer 1-5, so this is an
    // assertion, not a repair. If it ever fires, the constraint did not hold and
    // that is worth failing loudly over — silently turning a 9 into a 5 would
    // leave nobody any the wiser.
    const scored = normalizeScores(feedbackData.scores);
    if (!scored.ok) {
      console.error(
        `[evaluate-star-response] Schema-constrained scores violated 1-${SCORE_SCALE}: ${scored.reasons.join("; ")}`,
        feedbackData.scores,
      );
      throw new EvaluationResponseError(
        "invalid_scores",
        `The model returned a score outside 1-${SCORE_SCALE} (${scored.reasons.join("; ")}).`,
      );
    }

    feedbackData.scores = scored.scores;
    console.log(`[evaluate-star-response] Scores:`, feedbackData.scores);

    // Assessment scores used to be doubled into a 10-point display, which is where
    // the all-even feedback came from: a rubric defining only levels 1-5 can never
    // produce a 3, 5, 7 or 9 out of 10. Both question types now keep the rubric's
    // scale, and this stamp tells the UI which denominator to draw. Feedback saved
    // before this change carries no stamp and keeps rendering out of 10.
    feedbackData.score_scale = SCORE_SCALE;

    // The four hand-rolled shape checks that used to live here — feedback present,
    // strengths non-empty, improvements non-empty, at least three suggestions —
    // are now expressed in the schema as `required` and `minItems`, where the
    // decoder enforces them instead of the server discovering the violation after
    // the tokens are already spent. `performance_score` is bounded there too.

    console.log(`[evaluate-star-response] Feedback data structure validated:`, {
      has_scores: !!feedbackData?.scores,
      has_analysis: !!feedbackData?.analysis,
      has_feedback: !!feedbackData?.feedback,
      overall_score: feedbackData?.scores?.overall,
      is_assessment: isAssessmentQuestion,
      strengths_count: feedbackData?.feedback?.strengths?.length || 0,
      improvements_count: feedbackData?.feedback?.improvements?.length || 0,
      suggestions_count: feedbackData?.feedback?.suggestions?.length || 0
    });

    // Update the STAR response with the feedback
    console.log(`[evaluate-star-response] Updating STAR response with feedback`);
    // `.select().single()` stays: on an UPDATE that matches no row PostgREST
    // answers PGRST116 rather than a silent success, so it is the check that the
    // feedback actually landed. Only the returned row is unused.
    const { error: updateError } = await supabase
      .from("star_responses")
      .update({ 
        ai_feedback: feedbackData,
        assessment_area: assessmentArea,
        is_assessment_question: isAssessmentQuestion
      })
      .eq("id", responseId)
      .select()
      .single();

    if (updateError) {
      console.error(`[evaluate-star-response] Error updating STAR response:`, updateError);
      throw handleError(updateError);
    }

    console.log(`[evaluate-star-response] STAR response updated successfully with feedback`);
    return feedbackData;
  } catch (error) {
    console.error(`[evaluate-star-response] Unexpected error:`, error);
    throw handleError(error);
  }
}

serve(async (req) => {
  console.log(`[evaluate-star-response] Received ${req.method} request`);
  const startTime = new Date().getTime();
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log(`[evaluate-star-response] Handling OPTIONS preflight request`);
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const requestData = await req.json();
    console.log(`[evaluate-star-response] Request received with data:`, {
      has_responseId: !!requestData.responseId
    });
    
    const { responseId } = requestData;

    if (!responseId) {
      console.error(`[evaluate-star-response] Missing STAR response ID in request`);
      return new Response(
        JSON.stringify({ error: "STAR response ID is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`[evaluate-star-response] Processing request for STAR response ID: ${responseId}`);
    const feedbackData = await evaluateStarResponse(responseId, auth.user.id);
    console.log(`[evaluate-star-response] Evaluation completed successfully, returning response`);
    console.log("Ending time: ", new Date().toISOString());
    console.log("Time taken: ", new Date().getTime() - startTime);

    return new Response(JSON.stringify({ ai_feedback: feedbackData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    // A rate limit is not a failure: the request was well formed and the model
    // is willing, the per-minute token budget just has not refreshed yet.
    // Answering 429 with retryAfterMs lets the client wait it out and retry;
    // collapsing it into a 500 told the user the service was down when it was
    // not, and threw the work away.
    if (error instanceof GroqRateLimitError) {
      return rateLimitResponse(error, corsHeaders);
    }

    // Same idea, different cause: a truncated or malformed evaluation is a
    // specific, nameable failure, and telling the user which one it was is the
    // difference between "try again" being advice and being a shrug. The client
    // reads `error` off the body via functionErrorMessage().
    if (error instanceof EvaluationResponseError) {
      console.error(`[evaluate-star-response] ${error.code}: ${error.message}`);
      return new Response(
        JSON.stringify({ code: error.code, error: error.message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.error(`[evaluate-star-response] Error in edge function:`, error);
    
    return new Response(
      JSON.stringify({ error: (error instanceof Error && error.message) || "Failed to evaluate STAR response" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
