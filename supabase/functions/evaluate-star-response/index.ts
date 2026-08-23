
// ABOUTME: Edge function to evaluate STAR responses using AI and provide detailed feedback
// ABOUTME: Handles both assessment questions with rubric scoring and standard behavioral questions

// Follow Deno and Edge Functions v2 URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, handleError, safeParseJSON } from "../_shared/utils.ts";
import { requireUser } from "../_shared/auth.ts";
import { callGroq, GroqRateLimitError, rateLimitResponse } from "../_shared/groq.ts";
import { clampScore, normalizeScores, SCORE_SCALE } from "./scoring.ts";

const GROQ = Deno.env.get("GROQ");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function createAssessmentEvaluationPrompt(response: any, questionData: any, assessmentArea: string, rubricCriteria: any[]): string {
  const rubricText = rubricCriteria && rubricCriteria.length > 0 ? 
    rubricCriteria.map(criteria => 
      `${criteria.performance_level} (Score: ${criteria.score}): ${criteria.criteria_description}`
    ).join('\n') : 
    `Assessment scoring guidelines:
Performance Level 5: Exceptional demonstration with clear impact and leadership
Performance Level 4: Strong demonstration with good examples and results  
Performance Level 3: Adequate demonstration with some examples
Performance Level 2: Limited demonstration with weak examples
Performance Level 1: Poor demonstration with insufficient examples`;
    
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

CRITICAL SCORING INSTRUCTIONS:
1. Score each component (situation, task, action, result) individually on a 1-5 scale based on:
   - Situation: How well context demonstrates relevance to ${assessmentArea}
   - Task: How clearly the challenge/responsibility shows ${assessmentArea} requirements
   - Action: How effectively specific actions demonstrate ${assessmentArea} competency
   - Result: How well outcomes show impact and ${assessmentArea} success
2. The overall score MUST be calculated as: (situation + task + action + result) / 4
3. Round the overall score to the nearest integer (1-5)

FEEDBACK REQUIREMENTS - BE VERY SPECIFIC:
- Strengths: Provide exactly 3-5 SPECIFIC examples with concrete details from the response
- Improvements: Provide exactly 3-5 SPECIFIC areas that need enhancement with clear explanations
- Suggestions: Provide exactly 3 ACTIONABLE suggestions with detailed reasoning

Return your evaluation in this exact JSON format:
{
  "scores": {
    "situation": number (1-5),
    "task": number (1-5),
    "action": number (1-5),
    "result": number (1-5),
    "overall": number (1-5)
  },
  "assessment_evaluation": {
    "performance_level": "Exceptional|Strong|Adequate|Limited|Poor",
    "performance_score": number (1-5),
    "competency_demonstration": "How well they demonstrated ${assessmentArea}",
    "behavioral_indicators": ["specific behaviors observed"],
    "development_areas": ["specific areas where ${assessmentArea} could be strengthened"]
  },
  "analysis": {
    "completeness": "Comment on whether all STAR elements show ${assessmentArea} competency",
    "specificity": "Comment on concrete examples and details related to ${assessmentArea}",
    "relevance": "Comment on relevance to ${assessmentArea}",
    "impact": "Comment on impact and results achieved in ${assessmentArea}",
    "communication": "Comment on clarity and structure"
  },
  "feedback": {
    "strengths": [
      "Clearly demonstrated [specific example from response] which shows strong ${assessmentArea}",
      "Effectively described [specific action] resulting in [specific outcome]",
      "Provided quantifiable results such as [specific metric or achievement]"
    ],
    "improvements": [
      "The situation could better establish the ${assessmentArea} context by [specific improvement]",
      "The task description needs more clarity about your specific ${assessmentArea} responsibilities",
      "Actions could be more detailed about how you specifically demonstrated ${assessmentArea}",
      "Results section lacks specific metrics showing ${assessmentArea} impact"
    ],
    "suggestions": [
      "Add specific metrics to quantify your ${assessmentArea} impact - instead of general statements, use concrete numbers like 'increased efficiency by 25%' or 'reduced timeline by 3 weeks'",
      "Strengthen the action section by describing your specific ${assessmentArea} approach - explain your thought process, decision-making criteria, and how you prioritized tasks",
      "Enhance the result section by including both immediate and long-term outcomes - mention lessons learned, process improvements, or how this experience improved your ${assessmentArea} skills"
    ]
  }
}

Return ONLY the JSON object with no additional explanation or text.`;
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

CRITICAL SCORING INSTRUCTIONS:
1. Score each component (situation, task, action, result) individually on a 1-5 scale based on:
   - Situation: How well the context is established and relevant
   - Task: How clearly the challenge/responsibility is explained
   - Action: How effectively specific actions are described
   - Result: How well outcomes are quantified and demonstrate impact
2. Use these anchors for every component score:
   5 - Strength: specific, complete, and quantified
   4 - Mild Strength: strong, with one minor gap
   3 - Mixed: adequate but generic or missing detail
   2 - Mild Concern: vague or incomplete
   1 - Concern: missing or unusable
3. The overall score MUST be calculated as: (situation + task + action + result) / 4
4. Round the overall score to the nearest integer (1-5)

FEEDBACK REQUIREMENTS - BE VERY SPECIFIC:
- Strengths: Provide exactly 3-5 SPECIFIC examples with concrete details from the response
- Improvements: Provide exactly 3-5 SPECIFIC areas that need enhancement with clear explanations
- Suggestions: Provide exactly 3 ACTIONABLE suggestions with detailed reasoning

Evaluate this STAR response and provide feedback in the following JSON format:
{
  "scores": {
    "situation": number (1-5),
    "task": number (1-5),
    "action": number (1-5),
    "result": number (1-5),
    "overall": number (1-5)
  },
  "analysis": {
    "completeness": "Comment on whether all STAR elements are present and complete",
    "specificity": "Comment on level of detail and concrete examples provided",
    "relevance": "Comment on relevance to the target competency",
    "impact": "Comment on how well the response demonstrates measurable impact",
    "communication": "Comment on clarity and logical flow of the response"
  },
  "feedback": {
    "strengths": [
      "Provided clear timeline showing [specific timeframe or milestone]",
      "Demonstrated specific skills such as [exact skill/tool/method mentioned]",
      "Achieved measurable results including [specific metric or outcome]"
    ],
    "improvements": [
      "Situation section lacks specific context about [missing detail]",
      "Task description needs clarification about your individual role versus team responsibilities",
      "Action section could include more details about your specific approach and decision-making process",
      "Results section needs quantifiable metrics to demonstrate impact"
    ],
    "suggestions": [
      "Add specific metrics and timelines - instead of 'improved performance,' state 'increased team productivity by 30% over 6 months through implementation of new workflow system'",
      "Describe your individual contributions more clearly - explain what you personally did versus what the team accomplished collectively",
      "Include lessons learned and follow-up actions - mention what you would do differently next time or how this experience influenced future decisions"
    ]
  }
}

Return ONLY the JSON object with no additional explanation or text.`;
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

    const result = await callGroq(GROQ!, {
        // Replaces llama3-8b-8192, decommissioned 2025-08-30, which had been
        // returning 400 on every submission and 500ing this function since.
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: isAssessmentQuestion ? 
              `You are an expert behavioral interviewer specializing in evaluating responses against specific assessment competencies. You understand the nuanced behavioral indicators that distinguish different performance levels. You MUST calculate the overall score as the exact mathematical average of the 4 component scores. Provide specific, actionable feedback with concrete examples from the actual response content.` :
              `You are an interview coach specializing in evaluating STAR (Situation, Task, Action, Result) responses. You MUST calculate the overall score as the exact mathematical average of the 4 component scores. Provide detailed, objective feedback with specific examples from the actual response content and actionable suggestions.`
          },
          {
            role: "user",
            content: evaluationPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 3000
    }, "evaluate-star-response");

    console.log(`[evaluate-star-response] AI API response received successfully`);

    const content = result.choices[0].message.content;
    console.log(`[evaluate-star-response] Retrieved content length: ${content?.length || 0}`);

    // Extract JSON from the response using our improved parser
    const parsedResult = safeParseJSON(content);
    
    if (!parsedResult.success || !parsedResult.data) {
      console.error(`[evaluate-star-response] Failed to parse AI response as JSON`);
      console.error(`[evaluate-star-response] Raw AI response:`, content);
      throw new Error("Failed to parse AI response");
    }
    
    const feedbackData = parsedResult.data;

    // Normalise the scores before anything stores or renders them. The model's
    // own overall has disagreed with its own components (an 8.2 next to a 9, 7, 8,
    // 8), and the prompt asks for the average, so the average is what it gets.
    const normalizedScores = normalizeScores(feedbackData.scores);
    if (!normalizedScores) {
      console.error(`[evaluate-star-response] Unusable component scores:`, feedbackData.scores);
      throw new Error("AI response missing valid scores");
    }

    console.log(`[evaluate-star-response] Raw model scores:`, feedbackData.scores);
    feedbackData.scores = normalizedScores;
    console.log(`[evaluate-star-response] Normalised to 1-${SCORE_SCALE}:`, feedbackData.scores);

    // Assessment scores used to be doubled into a 10-point display, which is where
    // the all-even feedback came from: a rubric defining only levels 1-5 can never
    // produce a 3, 5, 7 or 9 out of 10. Both question types now keep the rubric's
    // scale, and this stamp tells the UI which denominator to draw. Feedback saved
    // before this change carries no stamp and keeps rendering out of 10.
    feedbackData.score_scale = SCORE_SCALE;

    // Metadata, not rendered anywhere, so an unusable value is dropped rather
    // than failing an otherwise-good evaluation.
    if (feedbackData.assessment_evaluation?.performance_score != null) {
      const performance = clampScore(feedbackData.assessment_evaluation.performance_score);
      if (performance !== null) {
        feedbackData.assessment_evaluation.performance_score = performance;
      }
    }

    // Validate feedback structure
    if (!feedbackData.feedback) {
      console.error(`[evaluate-star-response] Missing feedback object in AI response`);
      throw new Error("AI response missing feedback structure");
    }

    if (!feedbackData.feedback.strengths || !Array.isArray(feedbackData.feedback.strengths) || feedbackData.feedback.strengths.length === 0) {
      console.error(`[evaluate-star-response] Missing or empty strengths array`);
      throw new Error("AI response missing strengths feedback");
    }

    if (!feedbackData.feedback.improvements || !Array.isArray(feedbackData.feedback.improvements) || feedbackData.feedback.improvements.length === 0) {
      console.error(`[evaluate-star-response] Missing or empty improvements array`);
      throw new Error("AI response missing improvements feedback");
    }

    if (!feedbackData.feedback.suggestions || !Array.isArray(feedbackData.feedback.suggestions) || feedbackData.feedback.suggestions.length < 3) {
      console.error(`[evaluate-star-response] Missing or insufficient suggestions array`);
      throw new Error("AI response missing required 3 suggestions");
    }

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
