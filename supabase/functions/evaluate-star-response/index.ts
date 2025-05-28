
// Follow Deno and Edge Functions v2 URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, handleError, safeParseJSON } from "../_shared/utils.ts";

const TOGETHER_API_KEY = Deno.env.get("TOGETHER_API_KEY");
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
    
  return `Evaluate this STAR response for the Assessment Area: ${assessmentArea}

Question: ${questionData.question}
Assessment Area: ${assessmentArea}

STAR Response:
Situation: ${response.situation}
Task: ${response.task}  
Action: ${response.action}
Result: ${response.result}

Evaluation Criteria:
${rubricText}

Evaluate this response against the assessment area of ${assessmentArea}. Provide scores on a 1-5 scale (which will be converted to 1-10 for display consistency).

Return your evaluation in this exact JSON format:
{
  "scores": {
    "situation": number (1-5), // How well the situation demonstrates relevant context
    "task": number (1-5), // How clearly the challenge/responsibility is explained  
    "action": number (1-5), // How effectively specific actions are described
    "result": number (1-5), // How well outcomes and impact are quantified
    "overall": number (1-5) // Overall demonstration of the assessment competency
  },
  "assessment_evaluation": {
    "performance_level": "Exceptional|Strong|Adequate|Limited|Poor",
    "performance_score": number (1-5), // Based on rubric criteria
    "competency_demonstration": string, // How well they demonstrated this assessment area
    "behavioral_indicators": [string], // Specific behaviors observed
    "development_areas": [string] // Areas where competency could be strengthened
  },
  "analysis": {
    "completeness": string, // Comment on whether all STAR elements show competency
    "specificity": string, // Comment on concrete examples and details
    "relevance": string, // Comment on relevance to the assessment area  
    "impact": string, // Comment on impact and results achieved
    "communication": string // Comment on clarity and structure
  },
  "feedback": {
    "strengths": [string], // 3-5 specific strengths demonstrated
    "improvements": [string], // 3-5 areas to strengthen competency demonstration  
    "suggestions": [string] // 3-5 actionable suggestions for better examples
  }
}

Return ONLY the JSON object with no additional explanation or text.`;
}

function createStandardEvaluationPrompt(response: any, questionData: any): string {
  return `Please evaluate this STAR response for the following interview question:

Question: ${questionData.question}
Target Competency: ${questionData.targetCompetency}

STAR Response:
Situation: ${response.situation}
Task: ${response.task}
Action: ${response.action} 
Result: ${response.result}

Evaluate this STAR response and provide feedback in the following JSON format:
{
  "scores": {
    "situation": number (1-10), // How well the situation is described
    "task": number (1-10), // How clearly the task/challenge is explained
    "action": number (1-10), // How effectively actions are described
    "result": number (1-10), // How well the outcomes are quantified
    "overall": number (1-10) // Overall score for the STAR response
  },
  "analysis": {
    "completeness": string, // Comment on whether all STAR elements are present
    "specificity": string, // Comment on level of detail and concrete examples
    "relevance": string, // Comment on relevance to the target competency
    "impact": string, // Comment on how well the response demonstrates impact
    "communication": string // Comment on clarity and conciseness
  },
  "feedback": {
    "strengths": [string], // 3-5 specific strengths of this response
    "improvements": [string], // 3-5 specific areas for improvement
    "suggestions": [string] // 3-5 actionable suggestions to enhance this response
  }
}

Return ONLY the JSON object with no additional explanation or text.`;
}

async function evaluateStarResponse(responseId: string) {
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

    // Get rubric criteria if it's an assessment question
    let rubricCriteria = [];
    if (isAssessmentQuestion && assessmentArea) {
      console.log(`[evaluate-star-response] Fetching rubric criteria for assessment area: ${assessmentArea}`);
      const { data: rubric, error: rubricError } = await supabase
        .from('assesment_rubric')
        .select('*')
        .eq('assessment_area', assessmentArea);
        
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

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: isAssessmentQuestion ? 
              `You are an expert behavioral interviewer specializing in evaluating responses against specific assessment competencies. You understand the nuanced behavioral indicators that distinguish different performance levels.` :
              `You are an interview coach specializing in evaluating STAR (Situation, Task, Action, Result) responses. Provide detailed, objective feedback on interview responses.`
          },
          {
            role: "user",
            content: evaluationPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[evaluate-star-response] AI API error status: ${response.status}`);
      console.error(`[evaluate-star-response] AI API error body:`, errorData);
      throw new Error(`AI API error: ${response.status}`);
    }

    console.log(`[evaluate-star-response] AI API response received successfully`);

    // Parse the AI response
    const result = await response.json();
    const content = result.choices[0].message.content;
    console.log(`[evaluate-star-response] Retrieved content length: ${content?.length || 0}`);

    // Extract JSON from the response using our improved parser
    const parsedResult = safeParseJSON(content);
    
    if (!parsedResult.success || !parsedResult.data) {
      console.error(`[evaluate-star-response] Failed to parse AI response as JSON`);
      throw new Error("Failed to parse AI response");
    }
    
    const feedbackData = parsedResult.data;

    // Convert 5-point scale to 10-point scale if it's an assessment question
    if (isAssessmentQuestion && feedbackData.scores) {
      console.log(`[evaluate-star-response] Converting scores from 5-point to 10-point scale`);
      feedbackData.scores = {
        situation: (feedbackData.scores.situation || 0) * 2,
        task: (feedbackData.scores.task || 0) * 2, 
        action: (feedbackData.scores.action || 0) * 2,
        result: (feedbackData.scores.result || 0) * 2,
        overall: (feedbackData.scores.overall || 0) * 2
      };
      
      // Add assessment-specific scoring
      if (feedbackData.assessment_evaluation) {
        feedbackData.assessment_evaluation.performance_score = feedbackData.assessment_evaluation.performance_score * 2;
      }
    }

    console.log(`[evaluate-star-response] Feedback data structure validated:`, {
      has_scores: !!feedbackData?.scores,
      has_analysis: !!feedbackData?.analysis,
      has_feedback: !!feedbackData?.feedback,
      overall_score: feedbackData?.scores?.overall,
      is_assessment: isAssessmentQuestion
    });

    // Update the STAR response with the feedback
    console.log(`[evaluate-star-response] Updating STAR response with feedback`);
    const { data: updatedResponse, error: updateError } = await supabase
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
    const feedbackData = await evaluateStarResponse(responseId);
    console.log(`[evaluate-star-response] Evaluation completed successfully, returning response`);
    console.log("Ending time: ", new Date().toISOString());
    console.log("Time taken: ", new Date().getTime() - startTime);

    return new Response(JSON.stringify({ ai_feedback: feedbackData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error(`[evaluate-star-response] Error in edge function:`, error);
    
    return new Response(
      JSON.stringify({ error: error.message || "Failed to evaluate STAR response" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
